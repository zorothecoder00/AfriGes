// components/ui/statCardTheme.ts
// Classes Tailwind écrites en toutes lettres (le JIT ne détecte pas les
// template strings interpolées type `from-${hue}-50`) pour habiller les
// StatCard/KpiCard locaux des dashboards (admin + user) : dégradé de fond,
// barre d'accent, bordure/ombre au survol, texte teinté.

export interface StatCardHue {
  wrap: string;   // ex. "from-blue-50 border-blue-100 hover:shadow-blue-200/60 hover:border-blue-300"
  bar: string;    // ex. "bg-blue-500"
  text: string;   // ex. "text-blue-700"
  labelText: string; // ex. "text-blue-700/80"
}

export const STAT_CARD_HUES: Record<string, StatCardHue> = {
  red:     { wrap: "from-red-50 border-red-100 hover:shadow-red-200/60 hover:border-red-300",             bar: "bg-red-500",     text: "text-red-700",     labelText: "text-red-700/80" },
  rose:    { wrap: "from-rose-50 border-rose-100 hover:shadow-rose-200/60 hover:border-rose-300",         bar: "bg-rose-500",    text: "text-rose-700",    labelText: "text-rose-700/80" },
  orange:  { wrap: "from-orange-50 border-orange-100 hover:shadow-orange-200/60 hover:border-orange-300", bar: "bg-orange-500",  text: "text-orange-700",  labelText: "text-orange-700/80" },
  amber:   { wrap: "from-amber-50 border-amber-100 hover:shadow-amber-200/60 hover:border-amber-300",     bar: "bg-amber-500",   text: "text-amber-700",   labelText: "text-amber-700/80" },
  yellow:  { wrap: "from-yellow-50 border-yellow-100 hover:shadow-yellow-200/60 hover:border-yellow-300",  bar: "bg-yellow-500",  text: "text-yellow-700",  labelText: "text-yellow-700/80" },
  green:   { wrap: "from-green-50 border-green-100 hover:shadow-green-200/60 hover:border-green-300",     bar: "bg-green-500",   text: "text-green-700",   labelText: "text-green-700/80" },
  emerald: { wrap: "from-emerald-50 border-emerald-100 hover:shadow-emerald-200/60 hover:border-emerald-300", bar: "bg-emerald-500", text: "text-emerald-700", labelText: "text-emerald-700/80" },
  teal:    { wrap: "from-teal-50 border-teal-100 hover:shadow-teal-200/60 hover:border-teal-300",         bar: "bg-teal-500",    text: "text-teal-700",    labelText: "text-teal-700/80" },
  sky:     { wrap: "from-sky-50 border-sky-100 hover:shadow-sky-200/60 hover:border-sky-300",             bar: "bg-sky-500",     text: "text-sky-700",     labelText: "text-sky-700/80" },
  blue:    { wrap: "from-blue-50 border-blue-100 hover:shadow-blue-200/60 hover:border-blue-300",         bar: "bg-blue-500",    text: "text-blue-700",    labelText: "text-blue-700/80" },
  indigo:  { wrap: "from-indigo-50 border-indigo-100 hover:shadow-indigo-200/60 hover:border-indigo-300", bar: "bg-indigo-500",  text: "text-indigo-700",  labelText: "text-indigo-700/80" },
  violet:  { wrap: "from-violet-50 border-violet-100 hover:shadow-violet-200/60 hover:border-violet-300", bar: "bg-violet-500",  text: "text-violet-700",  labelText: "text-violet-700/80" },
  purple:  { wrap: "from-purple-50 border-purple-100 hover:shadow-purple-200/60 hover:border-purple-300", bar: "bg-purple-500",  text: "text-purple-700",  labelText: "text-purple-700/80" },
  fuchsia: { wrap: "from-fuchsia-50 border-fuchsia-100 hover:shadow-fuchsia-200/60 hover:border-fuchsia-300", bar: "bg-fuchsia-500", text: "text-fuchsia-700", labelText: "text-fuchsia-700/80" },
  pink:    { wrap: "from-pink-50 border-pink-100 hover:shadow-pink-200/60 hover:border-pink-300",         bar: "bg-pink-500",    text: "text-pink-700",    labelText: "text-pink-700/80" },
  cyan:    { wrap: "from-cyan-50 border-cyan-100 hover:shadow-cyan-200/60 hover:border-cyan-300",         bar: "bg-cyan-500",    text: "text-cyan-700",    labelText: "text-cyan-700/80" },
  slate:   { wrap: "from-slate-50 border-slate-200 hover:shadow-slate-200/60 hover:border-slate-300",     bar: "bg-slate-400",   text: "text-slate-700",   labelText: "text-slate-600/90" },
  gray:    { wrap: "from-gray-50 border-gray-200 hover:shadow-gray-200/60 hover:border-gray-300",         bar: "bg-gray-400",    text: "text-gray-700",    labelText: "text-gray-600/90" },
  brand:   { wrap: "from-brand-50 border-brand-100 hover:shadow-brand-200/60 hover:border-brand-300",     bar: "bg-brand-500",   text: "text-brand-700",   labelText: "text-brand-700/80" },
  primary: { wrap: "from-primary-50 border-primary-100 hover:shadow-primary-200/60 hover:border-primary-300", bar: "bg-primary-500", text: "text-primary-700", labelText: "text-primary-700/80" },
};

/** Extrait le nom de teinte Tailwind d'une classe (`text-blue-600`, `bg-blue-50`…). */
export function extractHue(cls: string | undefined | null): string {
  return cls?.match(/(?:text|bg|border)-([a-z]+)-\d+/)?.[1] ?? "slate";
}

/** Résout la teinte à partir d'une ou plusieurs classes candidates (1ʳᵉ trouvée). */
export function getStatCardHue(...classes: (string | undefined | null)[]): StatCardHue {
  for (const cls of classes) {
    const hue = cls?.match(/(?:text|bg|border)-([a-z]+)-\d+/)?.[1];
    if (hue && STAT_CARD_HUES[hue]) return STAT_CARD_HUES[hue];
  }
  return STAT_CARD_HUES.slate;
}
