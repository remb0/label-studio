import { useState } from "react";
import { Printer } from "lucide-react";
import { getPrinterImage } from "./printer-images.ts";

export function PrinterModelImage({
  modelId,
  name,
}: {
  modelId: string;
  name: string;
}) {
  const photo = getPrinterImage(modelId);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showPhoto = photo && failedSrc !== photo.src;
  return (
    <span
      className={`printer-model-image ${showPhoto ? "has-photo" : "no-photo"}`}
      data-image-model={modelId}
    >
      {showPhoto ? (
        <img
          src={photo.src}
          alt={`Productfoto ${name}`}
          width={88}
          height={88}
          decoding="async"
          onError={() => setFailedSrc(photo.src)}
        />
      ) : (
        <>
          <Printer size={28} aria-hidden="true" />
          <span>
            {photo ? "Foto niet beschikbaar" : "Foto nog niet bevestigd"}
          </span>
        </>
      )}
    </span>
  );
}
