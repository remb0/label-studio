import { useCallback } from "react";
import nl from "./locales/nl.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import de from "./locales/de.json" with { type: "json" };
import fr from "./locales/fr.json" with { type: "json" };
import es from "./locales/es.json" with { type: "json" };
import { create } from "zustand";

export const LANGUAGES = ["nl", "en", "de", "fr", "es"] as const;
export type Language = (typeof LANGUAGES)[number];
type Dictionary = Record<string, string>;
export const messages: Record<Language, Dictionary> = { nl, en, de, fr, es };

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem("label-studio:lang");
    if (LANGUAGES.includes(stored as Language)) return stored as Language;
  } catch {
    /* no storage */
  }
  const browser =
    typeof navigator === "undefined"
      ? "en"
      : (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGUAGES.includes(browser as Language) ? (browser as Language) : "en";
}
export const useLanguage = create<{
  language: Language;
  setLanguage: (lang: Language) => void;
}>((set) => ({
  language: initialLanguage(),
  setLanguage: (requested) => {
    const language = LANGUAGES.includes(requested) ? requested : "en";
    try {
      localStorage.setItem("label-studio:lang", language);
    } catch {
      /* optional */
    }
    if (typeof document !== "undefined")
      document.documentElement.lang = language;
    set({ language });
  },
}));
export function t(
  language: Language,
  key: UiMessage,
  values?: MessageValues,
): string {
  if (typeof key !== "string")
    return key.items
      ? key.items.map((item) => t(language, item)).join(", ")
      : t(language, key.key, key.values);
  const dictionary = messages[language] ?? messages.en;
  const text = Object.hasOwn(dictionary, key)
    ? dictionary[key]
    : Object.hasOwn(messages.en, key)
      ? messages.en[key]
      : key;
  return text.replace(/\{(\w+)\}/g, (token, name: string) => {
    const value = values?.[name];
    return value === undefined
      ? token
      : typeof value === "number"
        ? formatNumber(language, value)
        : typeof value === "string"
          ? value
          : t(language, value);
  });
}

export const LOCALES: Record<Language, string> = {
  nl: "nl-NL",
  en: "en-GB",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
};
export function formatNumber(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(LOCALES[language] ?? LOCALES.en, options).format(
    value,
  );
}
export function formatDate(
  language: Language,
  value: number | string | Date,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(
    LOCALES[language] ?? LOCALES.en,
    options ?? { dateStyle: "medium", timeStyle: "short" },
  ).format(new Date(value));
}

/** Subscribe each translated surface so open dialogs update without remounting. */
export function useT() {
  const language = useLanguage((state) => state.language);
  return useCallback(
    (key: UiMessage, values?: MessageValues) => t(language, key, values),
    [language],
  );
}

export type UiMessage =
  string | { key: string; values?: MessageValues; items?: UiMessage[] };
export type MessageValues = {
  [name: string]: string | number | Exclude<UiMessage, string>;
};
export function message(
  key: string,
  values?: MessageValues,
): Exclude<UiMessage, string> {
  return { key, values };
}
export class LocalizedError extends Error {
  readonly localized: UiMessage;
  constructor(key: string, values?: MessageValues) {
    super(t("nl", key, values));
    this.localized = message(key, values);
  }
}
/** Preserve translation metadata across async state and custom events. */
export function errorMessage(error: unknown): UiMessage {
  if (error instanceof LocalizedError) return error.localized;
  const text = error instanceof Error ? error.message : String(error);
  return Object.hasOwn(messages.en, text)
    ? text
    : message("externalError", { detail: text });
}

export function formatRelativeTime(
  language: Language,
  value: number,
  now = Date.now(),
) {
  const seconds = (value - now) / 1000;
  const [divisor, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(seconds) < 60
      ? [1, "second"]
      : Math.abs(seconds) < 3600
        ? [60, "minute"]
        : Math.abs(seconds) < 86400
          ? [3600, "hour"]
          : [86400, "day"];
  return new Intl.RelativeTimeFormat(LOCALES[language], {
    numeric: "auto",
  }).format(Math.trunc(seconds / divisor), unit);
}

export function asMessage(value: UiMessage): Exclude<UiMessage, string> {
  return typeof value === "string" ? message(value) : value;
}
export function messageList(items: UiMessage[]): Exclude<UiMessage, string> {
  return { key: "", items };
}

export function useNumberFormatter() {
  const language = useLanguage((s) => s.language);
  return useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(language, value, options),
    [language],
  );
}

/** Resolve a message at the time an imperative action runs. */
export function translate(key: UiMessage, values?: MessageValues) {
  return t(useLanguage.getState().language, key, values);
}
