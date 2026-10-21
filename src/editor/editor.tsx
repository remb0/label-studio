import { useRef, useCallback, useEffect } from "react";
import type Konva from "konva";
import { TopChrome } from "./top-chrome/top-chrome.tsx";
import { Canvas } from "./canvas/canvas.tsx";
import { Inspector } from "./inspector/inspector.tsx";
import { StatusBar } from "./status-bar.tsx";
import { Dock } from "./dock/dock.tsx";
import { PrintProgressToast } from "./print-progress-toast.tsx";
import { Palette } from "./palette/palette.tsx";
import { useKeyboardShortcuts, setPrintFn } from "../lib/keyboard.ts";
import { useEditorV2Store } from "../store/editor-store.ts";
import { getPrinter } from "../hooks/use-web-bluetooth.ts";
import type { RawImageData } from "@thermoprint/core";
import { getDevice } from "@thermoprint/core";
import { usePrinterStore } from "../store/printer-store.ts";
import { toPixels } from "../label/document.ts";
import { acquirePrintSession } from "../lib/print-session.ts";
import { GettingStarted } from "../features/start/GettingStarted.tsx";

function captureLabel(
  stage: Konva.Stage,
  widthPx: number,
  heightPx: number,
): HTMLCanvasElement {
  const layer = stage.findOne("#label-group") as Konva.Layer | undefined;
  if (!layer) throw new Error("Labelcanvas ontbreekt.");
  const origLayerX = layer.x();
  const origLayerY = layer.y();
  const originalScale = layer.scale();
  const paper = layer.findOne("#label-paper");
  const originalShadow = paper?.getAttr("shadowEnabled");
  const transformers = layer.find("Transformer");
  const visibility = transformers.map((node) => node.visible());
  try {
    layer.position({ x: 0, y: 0 });
    layer.scale({ x: 1, y: 1 });
    paper?.setAttr("shadowEnabled", false);
    transformers.forEach((node) => node.hide());
    const raw = layer.toCanvas({
      x: 0,
      y: 0,
      width: widthPx,
      height: heightPx,
      pixelRatio: 1,
    });
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(raw, 0, 0);
    return canvas;
  } finally {
    layer.position({ x: origLayerX, y: origLayerY });
    layer.scale(originalScale);
    paper?.setAttr("shadowEnabled", originalShadow);
    transformers.forEach((node, i) => node.visible(visibility[i]));
    stage.batchDraw();
  }
}

function rotateCanvas90CW(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = src.height;
  dst.height = src.width;
  const ctx = dst.getContext("2d")!;
  ctx.translate(dst.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return dst;
}

export function Editor() {
  const stageRef = useRef<Konva.Stage>(null);

  useKeyboardShortcuts();

  useEffect(() => {
    const exportPng = async () => {
      const stage = stageRef.current;
      if (!stage) return;
      if (useEditorV2Store.getState().editingTextId)
        (document.activeElement as HTMLElement | null)?.blur();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const { label, currentLabelName } = useEditorV2Store.getState();
      const canvas = captureLabel(stage, label.widthPx, label.heightPx);
      const link = document.createElement("a");
      link.download = `${currentLabelName.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    window.addEventListener("label-studio:export-png", exportPng);
    return () =>
      window.removeEventListener("label-studio:export-png", exportPng);
  }, []);

  // Warn on close with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (useEditorV2Store.getState().currentLabelDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const print = useCallback(async (copies: number): Promise<boolean> => {
    const printer = getPrinter();
    const stage = stageRef.current;

    // Need both a connected printer and a stage to print for real
    if (!printer || !stage) return false;
    const release = acquirePrintSession();
    if (!release) throw new Error("Er is al een printopdracht actief.");
    try {
      const { label, printSettings, paperType, rollDirection, editingTextId } =
        useEditorV2Store.getState();
      if (editingTextId) (document.activeElement as HTMLElement | null)?.blur();

      // Deselect to avoid selection handles in the capture
      useEditorV2Store.getState().clearSelection();

      // Wait a frame for Konva to re-render without selection handles
      await new Promise((r) => requestAnimationFrame(r));

      // Capture the label region at 1:1 pixel resolution
      const raw = captureLabel(stage, label.widthPx, label.heightPx);
      const oriented =
        rollDirection === "horizontal" ? rotateCanvas90CW(raw) : raw;
      const profile = getDevice(usePrinterStore.getState().modelId ?? "");
      const physicalDpi = profile?.dpi ?? 203;
      // Document DPI determines editing resolution; profile DPI describes the physical head.
      const canvas = document.createElement("canvas");
      canvas.width = toPixels(
        rollDirection === "horizontal" ? label.heightMm : label.widthMm,
        physicalDpi,
      );
      canvas.height = toPixels(
        rollDirection === "horizontal" ? label.widthMm : label.heightMm,
        physicalDpi,
      );
      const headWidth =
        profile?.printWidth ?? usePrinterStore.getState().settings.printWidth;
      if (canvas.width > headWidth)
        throw new Error(
          `Label is ${canvas.width} px breed; deze printer ondersteunt ${headWidth} px. Pas de labelmaat of doorvoerrichting aan.`,
        );
      canvas
        .getContext("2d")!
        .drawImage(oriented, 0, 0, canvas.width, canvas.height);
      const rotatedW = canvas.width;
      const rotatedH = canvas.height;

      // Send at the label's natural pixel size — no padding to print head width.
      // The printer handles positioning; padding would 4x the data for narrow labels.
      const ctx = canvas.getContext("2d")!;
      const imgData = ctx.getImageData(0, 0, rotatedW, rotatedH);
      const imageData: RawImageData = {
        data: imgData.data,
        width: rotatedW,
        height: rotatedH,
      };

      // Listen for real progress events from the printer
      const offProgress = (p: { bytesSent: number; totalBytes: number }) => {
        useEditorV2Store.setState({ printProgress: p });
      };
      printer.on("progress", offProgress);

      try {
        // Send to the real printer
        await printer.print(imageData, {
          density: printSettings.density,
          paperType,
          copies,
          dither: printSettings.ditherMode as
            "floyd-steinberg" | "threshold" | "none",
          threshold: printSettings.threshold,
        });
      } finally {
        printer.off("progress", offProgress);
      }

      return true;
    } finally {
      release();
    }
  }, []);

  // Register print fn for keyboard shortcut
  useEffect(() => {
    setPrintFn(print);
    return () => setPrintFn(null);
  }, [print]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-ink-950 text-ink-100">
      <TopChrome onPrint={print} />
      <div className="relative flex-1 min-h-0 flex flex-col">
        <Canvas ref={stageRef} />
        <GettingStarted />
        <Inspector />
        <Dock />
        <PrintProgressToast />
        <StatusBar />
      </div>
      <Palette />
    </div>
  );
}
