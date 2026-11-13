import { create } from "zustand";
import { useEditorV2Store } from "../store/editor-store.ts";
import { usePrinterStore } from "../store/printer-store.ts";
import { useFavorites, FAVORITES_KEY, parseFavorites } from "./favorites.ts";
import {
  useLanguage,
  LANGUAGES,
  LocalizedError,
  type Language,
} from "./i18n.ts";
import {
  validateSavedLabel,
  persistLibrary,
  mergeLabelSets,
  loadDeletedLabels,
  saveDeletedLabels,
  sanitizeDeletedLabels,
  type DeletedLabels,
  type Library,
  type SavedLabel,
} from "./library.ts";
import {
  loadModelPrinterSettings,
  sanitizeModelPrinterSettings,
  saveModelPrinterSettings,
} from "./printer-profiles.ts";
import {
  loadModelCalibrations,
  sanitizeModelCalibrations,
  saveModelCalibrations,
} from "../features/calibration/calibration.ts";
import {
  loadPrinterVerifications,
  mergePrinterVerifications,
  sanitizePrinterVerifications,
  savePrinterVerifications,
} from "../features/calibration/verification.ts";

const endpoint = (
  import.meta.env.VITE_ACCOUNT_API_URL as string | undefined
)?.replace(/\/$/, "");
export const cloudConfigured = Boolean(endpoint);
export type CloudSession = {
  user: { id: string; email?: string; isAdmin: boolean };
};

function sessionFromResponse(value: Record<string, unknown>): CloudSession {
  const user = value.user as
    { id?: unknown; email?: unknown; is_admin?: unknown } | undefined;
  if (typeof user?.id !== "string") throw new Error("Ongeldige accountsessie.");
  return {
    user: {
      id: user.id,
      email: typeof user.email === "string" ? user.email : undefined,
      isAdmin: user.is_admin === true,
    },
  };
}

let current: CloudSession | null = null;
export function clearCloudSession() {
  current = null;
}
export function getCloudSession() {
  return current;
}

export async function accountApi(path: string, init: RequestInit = {}) {
  if (!cloudConfigured)
    throw new Error("Cloudaccounts zijn niet geconfigureerd.");
  const response = await fetch(endpoint + path, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      (data as { error?: string } | null)?.error ||
        `Accountfout ${response.status}`,
    );
  return data;
}

export async function restoreCloudSession(): Promise<CloudSession | null> {
  if (!cloudConfigured) return null;
  try {
    const value = (await accountApi("/auth/session")) as Record<
      string,
      unknown
    >;
    current = sessionFromResponse(value);
    return current;
  } catch {
    clearCloudSession();
    return null;
  }
}
export async function ensureSession(): Promise<CloudSession | null> {
  return current || restoreCloudSession();
}

function validateCredentials(email: string, password: string) {
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("Vul een geldig e-mailadres in.");
  if (password.length < 8)
    throw new Error("Gebruik een wachtwoord van minimaal 8 tekens.");
}

export async function registerCloudAccount(
  email: string,
  password: string,
): Promise<CloudSession> {
  validateCredentials(email, password);
  const data = (await accountApi("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })) as Record<string, unknown>;
  current = sessionFromResponse(data);
  return current;
}

export async function loginCloudAccount(
  email: string,
  password: string,
): Promise<CloudSession> {
  validateCredentials(email, password);
  const data = (await accountApi("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })) as Record<string, unknown>;
  current = sessionFromResponse(data);
  return current;
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error("Vul een geldig e-mailadres in.");
  const result = (await accountApi("/auth/password/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  })) as { delivery_configured?: boolean };
  if (!result.delivery_configured)
    throw new Error(
      "Wachtwoordherstel per e-mail is nog niet ingesteld door de beheerder.",
    );
}

export async function updateCloudPassword(
  password: string,
  token: string,
): Promise<void> {
  if (password.length < 8)
    throw new Error("Gebruik een wachtwoord van minimaal 8 tekens.");
  await accountApi("/auth/password/update", {
    method: "POST",
    body: JSON.stringify({ password, token }),
  });
  clearCloudSession();
}

export async function logoutCloud() {
  stopAutoSyncTimer();
  if (cloudConfigured)
    await accountApi("/auth/logout", { method: "POST" }).catch(() => {});
  clearCloudSession();
  clearSyncState();
}

// ---- Account management ----

export async function changeCloudPassword(
  currentPassword: string,
  password: string,
): Promise<void> {
  if (password.length < 8)
    throw new Error("Gebruik een wachtwoord van minimaal 8 tekens.");
  await accountApi("/auth/password/change", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, password }),
  });
}

/** Everything the account holds, as a JSON file download. */
export async function exportCloudAccount(): Promise<void> {
  const data = await accountApi("/account/export");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `label-studio-account-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Permanently deletes the account; local data in this browser stays. */
export async function deleteCloudAccount(password: string): Promise<void> {
  await accountApi("/account/delete", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  stopAutoSyncTimer();
  clearCloudSession();
  clearSyncState();
}

// ---- Moderation (admins only) ----

export type ModerationQueue = {
  reports: Array<Record<string, unknown> & { id: string }>;
  proposals: Array<Record<string, unknown> & { id: string }>;
};

export async function loadModerationQueue(): Promise<ModerationQueue> {
  return (await accountApi("/admin/moderation")) as ModerationQueue;
}

export async function moderate(
  kind: "report" | "proposal",
  id: string,
  status: "approved" | "rejected",
): Promise<void> {
  await accountApi("/admin/moderation", {
    method: "POST",
    body: JSON.stringify({ kind, id, status }),
  });
}

// ---- What is synced ----

const MAPPINGS_KEY = "label-studio-mappings";
const COPIES_KEY = "tp.copies";
const SYNC_KEY = "label-studio:account-sync:v1";
const AUTOSYNC_KEY = "label-studio:account-autosync:v1";
const THEMES = ["cyan", "amber", "graphite", "violet", "forest", "paper"];
const MAX_REQUEST_BYTES = 4_000_000;

function readMappings(): unknown[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(MAPPINGS_KEY) || "[]",
    );
    return Array.isArray(value) ? value.slice(0, 100) : [];
  } catch {
    return [];
  }
}

function readCopies(): number {
  try {
    const value = parseInt(localStorage.getItem(COPIES_KEY) || "1", 10);
    return Number.isInteger(value) && value >= 1 && value <= 999 ? value : 1;
  } catch {
    return 1;
  }
}

export type AccountSettings = {
  preferences: Record<string, unknown>;
  mappingProfiles: unknown[];
};

/**
 * Preferences and settings that follow the user. Bluetooth device IDs,
 * per-device calibration, CSV rows and print jobs deliberately stay local.
 */
export function buildSettings(): AccountSettings {
  const editor = useEditorV2Store.getState();
  const printer = usePrinterStore.getState();
  return {
    preferences: {
      theme: editor.theme,
      mode: editor.mode,
      uiScale: editor.uiScale,
      gridVisible: editor.gridVisible,
      rulersVisible: editor.rulersVisible,
      language: useLanguage.getState().language,
      preferredPrinterModel: printer.preferredModelId,
      printerSettings: printer.settings,
      printerModelSettings: loadModelPrinterSettings(),
      modelCalibrations: loadModelCalibrations(),
      printerVerifications: loadPrinterVerifications(),
      copies: readCopies(),
      favorites: useFavorites.getState().ids,
    },
    mappingProfiles: readMappings(),
  };
}

export function applySettings(data: Partial<AccountSettings>) {
  const editor = useEditorV2Store.getState();
  const p =
    data.preferences && typeof data.preferences === "object"
      ? data.preferences
      : {};
  if (typeof p.theme === "string" && THEMES.includes(p.theme))
    editor.setTheme(p.theme);
  if (p.mode === "dark" || p.mode === "light") editor.setMode(p.mode);
  if (typeof p.uiScale === "number" && Number.isFinite(p.uiScale))
    editor.setUiScale(Math.max(0.8, Math.min(1.4, p.uiScale)));
  if (typeof p.gridVisible === "boolean")
    useEditorV2Store.setState({ gridVisible: p.gridVisible });
  if (typeof p.rulersVisible === "boolean")
    useEditorV2Store.setState({ rulersVisible: p.rulersVisible });
  if (LANGUAGES.includes(p.language as Language))
    useLanguage.getState().setLanguage(p.language as Language);
  if (
    typeof p.preferredPrinterModel === "string" ||
    p.preferredPrinterModel === null
  )
    usePrinterStore
      .getState()
      .selectPreferredModel(p.preferredPrinterModel as string | null);
  if (p.printerSettings && typeof p.printerSettings === "object") {
    const settings = p.printerSettings as Record<string, unknown>;
    usePrinterStore.getState().updateSettings({
      ...([1, 2, 3].includes(Number(settings.density))
        ? { density: Number(settings.density) as 1 | 2 | 3 }
        : {}),
      ...(settings.paperType === "gap" || settings.paperType === "continuous"
        ? { paperType: settings.paperType }
        : {}),
      ...(["floyd-steinberg", "threshold", "none"].includes(
        String(settings.ditherMode),
      )
        ? {
            ditherMode: settings.ditherMode as
              "floyd-steinberg" | "threshold" | "none",
          }
        : {}),
      ...(Number.isFinite(settings.threshold) &&
      Number(settings.threshold) >= 0 &&
      Number(settings.threshold) <= 255
        ? { threshold: Number(settings.threshold) }
        : {}),
    });
  }
  const modelSettings = sanitizeModelPrinterSettings(p.printerModelSettings);
  if (Object.keys(modelSettings).length)
    saveModelPrinterSettings({
      ...loadModelPrinterSettings(),
      ...modelSettings,
    });
  const calibrations = sanitizeModelCalibrations(p.modelCalibrations);
  if (Object.keys(calibrations).length)
    saveModelCalibrations({ ...loadModelCalibrations(), ...calibrations });
  const verifications = sanitizePrinterVerifications(p.printerVerifications);
  if (Object.keys(verifications).length)
    savePrinterVerifications(
      mergePrinterVerifications(loadPrinterVerifications(), verifications),
    );
  if (
    typeof p.copies === "number" &&
    Number.isInteger(p.copies) &&
    p.copies >= 1 &&
    p.copies <= 999
  ) {
    try {
      localStorage.setItem(COPIES_KEY, String(p.copies));
    } catch {
      /* optional */
    }
  }
  // Favorites are additive: a star set on any device is kept.
  const favorites = parseFavorites(
    JSON.stringify({
      version: 1,
      ids: [
        ...useFavorites.getState().ids,
        ...(Array.isArray(p.favorites) ? p.favorites : []),
      ],
    }),
  );
  useFavorites.setState({ ids: favorites });
  try {
    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify({ version: 1, ids: favorites }),
    );
  } catch {
    /* optional */
  }
  if (Array.isArray(data.mappingProfiles) && data.mappingProfiles.length) {
    try {
      localStorage.setItem(
        MAPPINGS_KEY,
        JSON.stringify(data.mappingProfiles.slice(0, 100)),
      );
    } catch {
      /* optional */
    }
  }
}

// ---- Incremental sync ----

type SyncState = {
  userId: string;
  /** Server cursor: only changes after it are returned. */
  cursor: number | null;
  /** Local edits after this client time have not been uploaded yet. */
  uploadedUpTo: number;
  settingsRevision: number | null;
  /** Fingerprint of the settings last sent or received. */
  settingsHash: string | null;
  lastSyncedAt: string | null;
};

function freshState(userId: string): SyncState {
  return {
    userId,
    cursor: null,
    uploadedUpTo: 0,
    settingsRevision: null,
    settingsHash: null,
    lastSyncedAt: null,
  };
}

function loadSyncState(userId: string): SyncState {
  try {
    const value = JSON.parse(
      localStorage.getItem(SYNC_KEY) || "null",
    ) as SyncState | null;
    if (value && value.userId === userId)
      return { ...freshState(userId), ...value };
  } catch {
    /* fall through */
  }
  return freshState(userId);
}

function saveSyncState(state: SyncState) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(state));
  } catch {
    /* optional: the next sync is then a full one */
  }
}

function clearSyncState() {
  try {
    localStorage.removeItem(SYNC_KEY);
  } catch {
    /* optional */
  }
  useAccountSync.setState({ lastSyncedAt: null, status: "idle", error: "" });
}

function settingsHash(settings: AccountSettings): string {
  return JSON.stringify(settings);
}

type RemoteLabel = { id: string; changedAt: number; payload: unknown };
type SyncResponse = {
  labels: RemoteLabel[];
  settings: { payload: AccountSettings; revision: number } | null;
  settings_conflict: boolean;
  cursor: number;
  synced_at: string;
};

/** Converts server rows to labels + tombstones; invalid labels are skipped. */
export function parseRemoteLabels(rows: unknown): {
  labels: SavedLabel[];
  deleted: DeletedLabels;
  skipped: number;
} {
  const labels: SavedLabel[] = [];
  const deleted: DeletedLabels = {};
  let skipped = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const { id, changedAt, payload } = (row ?? {}) as RemoteLabel;
    if (typeof id !== "string" || !id || id.length > 200) {
      skipped += 1;
      continue;
    }
    if (payload === null) {
      if (Number.isFinite(changedAt)) deleted[id] = changedAt;
      continue;
    }
    try {
      labels.push({
        ...validateSavedLabel(payload, { keepTimestamps: true }),
        id,
      });
    } catch {
      skipped += 1;
    }
  }
  return { labels, deleted: sanitizeDeletedLabels(deleted), skipped };
}

/**
 * Merges labels and tombstones from the account into this browser. A label
 * that is open with unsaved edits is never replaced: either the sync stops
 * (manual) or the local version is kept until it is saved (automatic).
 */
function mergeIntoLocal(
  remoteLabels: SavedLabel[],
  remoteDeleted: DeletedLabels,
  onDirtyConflict: "throw" | "keepLocal",
) {
  const deleted = { ...loadDeletedLabels() };
  for (const [id, at] of Object.entries(remoteDeleted))
    deleted[id] = Math.max(deleted[id] ?? 0, at);
  saveDeletedLabels(deleted);

  const editor = useEditorV2Store.getState();
  let labels = mergeLabelSets(editor.library.labels, remoteLabels, deleted);
  const currentId = editor.currentLabelId;
  const before = editor.library.labels.find((l) => l.id === currentId);
  let after = labels.find((l) => l.id === currentId);
  let currentChanged =
    !!currentId && (!after || after.updatedAt !== before?.updatedAt);
  if (currentChanged && editor.currentLabelDirty) {
    if (onDirtyConflict === "throw")
      throw new Error(
        "Sla je huidige ontwerp eerst op voordat je cloudgegevens ophaalt.",
      );
    if (before) {
      labels = [before, ...labels.filter((l) => l.id !== before.id)];
      after = before;
    }
    currentChanged = false;
  }
  const unchanged =
    labels.length === editor.library.labels.length &&
    labels.every((label) =>
      editor.library.labels.some(
        (l) => l.id === label.id && l.updatedAt === label.updatedAt,
      ),
    );
  if (unchanged) return;
  const ids = new Set(labels.map((l) => l.id));
  const library: Library = {
    labels,
    recent: editor.library.recent.filter((id) => ids.has(id)),
    currentLabelId: after ? editor.library.currentLabelId : null,
  };
  useEditorV2Store.setState({ library });
  persistLibrary(library);
  if (currentChanged) {
    if (after) useEditorV2Store.getState().openLabel(after.id);
    else useEditorV2Store.getState().newLabel();
  }
}

/** Splits uploads into requests that stay under the server's body limit. */
export function chunkLabels(
  labels: SavedLabel[],
  maxBytes = MAX_REQUEST_BYTES,
) {
  const chunks: SavedLabel[][] = [];
  let currentChunk: SavedLabel[] = [];
  let size = 0;
  for (const label of labels) {
    const bytes = JSON.stringify(label).length;
    if (bytes > 2_000_000)
      throw new LocalizedError("labelTooLargeForAccount", { name: label.name });
    if (currentChunk.length && size + bytes > maxBytes) {
      chunks.push(currentChunk);
      currentChunk = [];
      size = 0;
    }
    currentChunk.push(label);
    size += bytes;
  }
  if (currentChunk.length) chunks.push(currentChunk);
  return chunks;
}

export type SyncMode =
  /** Automatic/background: account settings win a conflict. */
  | "auto"
  /** "Opslaan in account": this device's settings overwrite the account. */
  | "push"
  /** "Laden uit account": the account's settings replace this device's. */
  | "pull";

export type SyncResult = { labels: number; skipped: number };

type SyncStatus = "idle" | "syncing" | "error";
export const useAccountSync = create<{
  status: SyncStatus;
  error: string;
  lastSyncedAt: string | null;
  autoSync: boolean;
  setAutoSync: (value: boolean) => void;
}>((set) => ({
  status: "idle",
  error: "",
  lastSyncedAt: null,
  autoSync: (() => {
    try {
      return localStorage.getItem(AUTOSYNC_KEY) !== "off";
    } catch {
      return true;
    }
  })(),
  setAutoSync: (autoSync) => {
    try {
      localStorage.setItem(AUTOSYNC_KEY, autoSync ? "on" : "off");
    } catch {
      /* optional */
    }
    set({ autoSync });
    if (autoSync) scheduleAutoSync(0);
    else stopAutoSyncTimer();
  },
}));

let running: Promise<SyncResult> | null = null;

/**
 * Two-way incremental sync. Labels merge per label (newest edit wins,
 * deletions are kept); settings use the server revision to detect conflicts.
 */
export function syncCloudData(mode: SyncMode = "auto"): Promise<SyncResult> {
  // Serialise syncs; a manual sync waits for a running automatic one.
  const next = (running ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => runSync(mode));
  running = next;
  void next.finally(() => {
    if (running === next) running = null;
  });
  return next;
}

async function runSync(mode: SyncMode): Promise<SyncResult> {
  const session = await ensureSession();
  if (!session) throw new Error("Log eerst in.");
  useAccountSync.setState({ status: "syncing", error: "" });
  try {
    const state = loadSyncState(session.user.id);
    const uploadMark = Date.now();
    const editor = useEditorV2Store.getState();
    const changed = editor.library.labels.filter(
      (label) => label.updatedAt > state.uploadedUpTo,
    );
    const deleted = Object.fromEntries(
      Object.entries(loadDeletedLabels()).filter(
        ([, at]) => at > state.uploadedUpTo,
      ),
    );
    const chunks = chunkLabels(changed);
    if (!chunks.length) chunks.push([]);

    const local = buildSettings();
    const localHash = settingsHash(local);
    // Settings are sent when they changed here, or when this device pushes.
    // A device that never synced first adopts the account's settings.
    const sendSettings =
      mode === "push" ||
      (mode === "auto" &&
        state.settingsRevision !== null &&
        localHash !== state.settingsHash);

    let skipped = 0;
    let response: SyncResponse | null = null;
    for (const [index, labels] of chunks.entries()) {
      const last = index === chunks.length - 1;
      response = (await accountApi("/account/sync", {
        method: "POST",
        body: JSON.stringify({
          labels,
          deleted: index === 0 ? deleted : {},
          since: state.cursor,
          ...(last && sendSettings
            ? {
                settings: {
                  payload: local,
                  base_revision: state.settingsRevision,
                },
              }
            : {}),
        }),
      })) as SyncResponse;
      const remote = parseRemoteLabels(response.labels);
      skipped += remote.skipped;
      mergeIntoLocal(
        remote.labels,
        remote.deleted,
        mode === "auto" ? "keepLocal" : "throw",
      );
    }
    if (!response) throw new Error("Geen antwoord van de accountserver.");

    // An explicit push overwrites newer account settings after one retry.
    if (mode === "push" && response.settings_conflict && response.settings) {
      response = (await accountApi("/account/sync", {
        method: "POST",
        body: JSON.stringify({
          since: response.cursor,
          settings: {
            payload: local,
            base_revision: response.settings.revision,
          },
        }),
      })) as SyncResponse;
    }

    const remoteSettings = response.settings;
    let revision = remoteSettings?.revision ?? null;
    let hash = state.settingsHash;
    if (remoteSettings) {
      const adopt =
        mode === "pull" ||
        response.settings_conflict ||
        (mode === "auto" && state.settingsRevision === null);
      if (adopt) applySettings(remoteSettings.payload);
      hash = settingsHash(adopt ? buildSettings() : local);
    } else if (mode !== "pull") {
      // First device on this account: store its settings.
      const created = (await accountApi("/account/sync", {
        method: "POST",
        body: JSON.stringify({
          since: response.cursor,
          settings: { payload: local, base_revision: null },
        }),
      })) as SyncResponse;
      revision = created.settings?.revision ?? null;
      hash = localHash;
      response = created;
    }

    const next: SyncState = {
      userId: session.user.id,
      cursor: response.cursor,
      uploadedUpTo: uploadMark,
      settingsRevision: revision,
      settingsHash: hash,
      lastSyncedAt: response.synced_at,
    };
    saveSyncState(next);
    useAccountSync.setState({
      status: "idle",
      lastSyncedAt: response.synced_at,
    });
    return {
      labels: useEditorV2Store.getState().library.labels.length,
      skipped,
    };
  } catch (error) {
    useAccountSync.setState({
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** "Opslaan in account": merge labels both ways, this device's settings win. */
export const uploadCloudData = () => syncCloudData("push");
/** "Laden uit account": merge labels both ways, the account's settings win. */
export const downloadCloudData = () => syncCloudData("pull");

// ---- Automatic sync ----

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribers: Array<() => void> = [];

function stopAutoSyncTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function scheduleAutoSync(delayMs = 4000) {
  if (!getCloudSession() || !useAccountSync.getState().autoSync) return;
  stopAutoSyncTimer();
  timer = setTimeout(() => {
    timer = null;
    void syncCloudData("auto").catch(() => {
      /* status is shown on the account page; retried on the next change */
    });
  }, delayMs);
}

/**
 * Starts background sync: once when a session exists, then a few seconds
 * after labels, preferences or printer settings change.
 */
export function startAccountAutoSync(): () => void {
  if (!cloudConfigured) return () => {};
  for (const stop of unsubscribers) stop();
  const watch = <T>(
    subscribe: (listener: (state: T, previous: T) => void) => () => void,
    pick: (state: T) => unknown[],
  ) =>
    subscribe((state, previous) => {
      const a = pick(state);
      const b = pick(previous);
      if (a.some((value, index) => value !== b[index])) scheduleAutoSync();
    });
  unsubscribers = [
    watch(useEditorV2Store.subscribe, (s) => [
      s.library.labels,
      s.theme,
      s.mode,
      s.uiScale,
      s.gridVisible,
      s.rulersVisible,
    ]),
    watch(usePrinterStore.subscribe, (s) => [s.settings, s.preferredModelId]),
    watch(useFavorites.subscribe, (s) => [s.ids]),
    watch(useLanguage.subscribe, (s) => [s.language]),
  ];
  const onOnline = () => scheduleAutoSync(0);
  const onVisible = () => {
    if (document.visibilityState === "visible") scheduleAutoSync(0);
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  void restoreCloudSession().then((session) => {
    if (session) {
      useAccountSync.setState({
        lastSyncedAt: loadSyncState(session.user.id).lastSyncedAt,
      });
      scheduleAutoSync(0);
    }
  });
  return () => {
    for (const stop of unsubscribers) stop();
    unsubscribers = [];
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    stopAutoSyncTimer();
  };
}

/** Called after login/registration: first sync adopts the account's settings. */
export function syncAfterSignIn(): Promise<SyncResult> {
  const session = getCloudSession();
  if (session)
    useAccountSync.setState({
      lastSyncedAt: loadSyncState(session.user.id).lastSyncedAt,
    });
  return syncCloudData("auto");
}
