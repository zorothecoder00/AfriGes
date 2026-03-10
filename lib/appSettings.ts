/**
 * Gestionnaire de paramètres applicatifs côté client.
 * Source de vérité : base de données (via /api/superadmin/settings).
 * Cache local : localStorage pour éviter un appel API à chaque render.
 */

const STORAGE_KEY = "afriges_app_settings";

// Mapping devise label → code ISO 4217 pour Intl.NumberFormat
export const DEVISE_ISO_MAP: Record<string, string> = {
  FCFA: "XOF",
  XOF:  "XOF",
  XAF:  "XAF",
  EUR:  "EUR",
  USD:  "USD",
  GBP:  "GBP",
  NGN:  "NGN",
  GHS:  "GHS",
  MAD:  "MAD",
  TND:  "TND",
  DZD:  "DZD",
  EGP:  "EGP",
  KES:  "KES",
};

// Mapping code langue → locale BCP 47
export const LANGUE_LOCALE_MAP: Record<string, string> = {
  fr: "fr-FR",
  en: "en-US",
  ar: "ar-DZ",
};

// ─── Lecture ──────────────────────────────────────────────────────────────────

export function getStoredSettings(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getStoredSetting(key: string, fallback = ""): string {
  return getStoredSettings()[key] ?? fallback;
}

// ─── Écriture + application ───────────────────────────────────────────────────

export function persistSettings(settings: Record<string, string>) {
  if (typeof window === "undefined") return;
  const current = getStoredSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
  applySettingsToDOM(settings);
}

// ─── Application DOM ──────────────────────────────────────────────────────────

export function applySettingsToDOM(settings: Record<string, string>) {
  if (typeof window === "undefined") return;

  // Thème
  const theme = settings["platform.theme"];
  if (theme) {
    const html = document.documentElement;
    // Toujours réinitialiser avant d'appliquer
    html.removeAttribute("data-theme");

    if (theme === "dark") {
      html.setAttribute("data-theme", "dark");
    } else if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      html.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      // "light" ou toute autre valeur → mode clair
      html.setAttribute("data-theme", "light");
    }
  }

  // Langue
  const langue = settings["platform.langue"];
  if (langue) {
    document.documentElement.lang = langue;
    // Sens de lecture : RTL pour l'arabe, LTR sinon
    document.documentElement.dir = langue === "ar" ? "rtl" : "ltr";
  }

  // Nom de la plateforme (titre navigateur)
  const nom = settings["platform.nom"];
  if (nom && document.title) {
    // Met à jour le titre seulement si la page n'a pas de titre spécifique
    if (document.title === "AfriGes" || document.title === "Create Next App") {
      document.title = nom;
    }
  }
}

export function initAppSettings() {
  const stored = getStoredSettings();
  applySettingsToDOM(stored);
}

// ─── Helpers formatage ────────────────────────────────────────────────────────

export function getDeviseMeta(): { iso: string; label: string } {
  const stored = getStoredSetting("platform.devise", "FCFA");
  const upper = stored.toUpperCase();
  const iso = DEVISE_ISO_MAP[upper] ?? null;
  return { iso: iso ?? stored, label: stored };
}

export function getLocale(): string {
  const langue = getStoredSetting("platform.langue", "fr");
  return LANGUE_LOCALE_MAP[langue] ?? "fr-FR";
}
