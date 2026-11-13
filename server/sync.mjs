// Pure validation for the account sync API (no database access, unit-tested).

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const MAX_LABELS_PER_REQUEST = 1000;
export const MAX_LABEL_BYTES = 2_000_000;
export const MAX_SETTINGS_BYTES = 512_000;
const DAY_MS = 86_400_000;

function validTime(value, now) {
  return Number.isSafeInteger(value) && value >= 0 && value <= now + DAY_MS;
}

/**
 * Normalises a sync request. Labels and deletions become one list of changes:
 * `{ id, changedAt, payload }` where `payload === null` is a deletion.
 */
export function parseSyncRequest(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError(400, "Ongeldige synchronisatie.");
  const changes = new Map();
  const labels = Array.isArray(input.labels) ? input.labels : [];
  const deleted =
    input.deleted &&
    typeof input.deleted === "object" &&
    !Array.isArray(input.deleted)
      ? Object.entries(input.deleted)
      : [];
  if (labels.length + deleted.length > MAX_LABELS_PER_REQUEST)
    throw new HttpError(413, "Te veel labels in één verzoek.");

  const put = (change) => {
    const existing = changes.get(change.id);
    // Same rule as the database: newest wins, a deletion wins a tie.
    if (
      !existing ||
      change.changedAt > existing.changedAt ||
      (change.changedAt === existing.changedAt && change.payload === null)
    )
      changes.set(change.id, change);
  };

  for (const label of labels) {
    const id = label?.id;
    if (typeof id !== "string" || !id || id.length > 200)
      throw new HttpError(400, "Ongeldige label-ID.");
    if (!validTime(label.updatedAt, now))
      throw new HttpError(400, "Ongeldige wijzigingstijd.");
    const encoded = JSON.stringify(label);
    if (encoded.length > MAX_LABEL_BYTES)
      throw new HttpError(413, "Een label is te groot voor accountopslag.");
    put({ id, changedAt: label.updatedAt, payload: encoded });
  }
  for (const [id, at] of deleted) {
    if (!id || id.length > 200) throw new HttpError(400, "Ongeldige label-ID.");
    if (!validTime(at, now))
      throw new HttpError(400, "Ongeldige verwijdertijd.");
    put({ id, changedAt: at, payload: null });
  }

  let settings = null;
  if (input.settings !== undefined && input.settings !== null) {
    const payload = input.settings.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new HttpError(400, "Ongeldige instellingen.");
    const encoded = JSON.stringify(payload);
    if (encoded.length > MAX_SETTINGS_BYTES)
      throw new HttpError(413, "Instellingen zijn te groot.");
    const base = input.settings.base_revision;
    if (base !== null && base !== undefined && !Number.isSafeInteger(base))
      throw new HttpError(400, "Ongeldige revisie.");
    settings = { payload: encoded, baseRevision: base ?? null };
  }

  const since = input.since;
  if (since !== undefined && since !== null && !validTime(since, now))
    throw new HttpError(400, "Ongeldige synchronisatiecursor.");

  return { changes: [...changes.values()], settings, since: since ?? null };
}

/** Splits legacy single-document account data into the per-label model. */
export function legacySnapshotToChanges(payload) {
  const changes = [];
  const labels = Array.isArray(payload?.library?.labels)
    ? payload.library.labels
    : [];
  for (const label of labels.slice(0, MAX_LABELS_PER_REQUEST)) {
    if (typeof label?.id !== "string" || !label.id || label.id.length > 200)
      continue;
    const changedAt = Number.isSafeInteger(label.updatedAt)
      ? label.updatedAt
      : 0;
    changes.push({ id: label.id, changedAt, payload: JSON.stringify(label) });
  }
  const deleted =
    payload?.deletedLabels && typeof payload.deletedLabels === "object"
      ? payload.deletedLabels
      : {};
  for (const [id, at] of Object.entries(deleted))
    if (id && id.length <= 200 && Number.isSafeInteger(at))
      changes.push({ id, changedAt: at, payload: null });
  const settings = {
    preferences:
      payload?.preferences && typeof payload.preferences === "object"
        ? payload.preferences
        : {},
    mappingProfiles: Array.isArray(payload?.mappingProfiles)
      ? payload.mappingProfiles.slice(0, 100)
      : [],
  };
  return { changes, settings };
}

export function adminEmails(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
