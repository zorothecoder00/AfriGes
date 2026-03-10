export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";

  // Lecture dynamique de la devise et de la locale (client uniquement)
  let iso = "XOF";
  let label = "FCFA";
  let locale = "fr-FR";

  if (typeof window !== "undefined") {
    try {
      const stored: Record<string, string> = JSON.parse(
        localStorage.getItem("afriges_app_settings") ?? "{}"
      );
      const devise = stored["platform.devise"];
      if (devise) {
        const upper = devise.toUpperCase();
        const ISO_MAP: Record<string, string> = {
          FCFA: "XOF", XOF: "XOF", XAF: "XAF",
          EUR: "EUR", USD: "USD", GBP: "GBP",
          NGN: "NGN", GHS: "GHS", MAD: "MAD",
          TND: "TND", DZD: "DZD", EGP: "EGP", KES: "KES",
        };
        iso   = ISO_MAP[upper] ?? devise;
        label = devise;
      }
      const langMap: Record<string, string> = { fr: "fr-FR", en: "en-US", ar: "ar-DZ" };
      const lang = stored["platform.langue"];
      if (lang) locale = langMap[lang] ?? "fr-FR";
    } catch { /* ignore */ }
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: iso,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    // Fallback si le code ISO n'est pas reconnu par Intl
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)} ${label}`;
  }
}

export function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("fr-FR").format(num);
}

function getDynamicLocale(): string {
  if (typeof window === "undefined") return "fr-FR";
  try {
    const stored: Record<string, string> = JSON.parse(
      localStorage.getItem("afriges_app_settings") ?? "{}"
    );
    const langMap: Record<string, string> = { fr: "fr-FR", en: "en-US", ar: "ar-DZ" };
    return langMap[stored["platform.langue"]] ?? "fr-FR";
  } catch {
    return "fr-FR";
  }
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString(getDynamicLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString(getDynamicLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString(getDynamicLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
