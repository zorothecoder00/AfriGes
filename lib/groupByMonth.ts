// lib/groupByMonth.ts
// Regroupement générique d'une liste par mois (année + mois) avec sous-total.
// Utilisé pour classer les crédits clients et les remboursements/encaissements
// par mois dans les onglets d'encaissement (caissier, RVC, agent terrain, admin).

export type MonthGroup<T> = {
  key: string;     // "2026-06" (triable) ou "0000-00" pour date inconnue
  label: string;   // "Juin 2026"
  items: T[];
  total: number;   // somme des montants (0 si pas d'accesseur de montant)
  count: number;
};

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function monthLabel(d: Date): string {
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Regroupe `items` par mois selon la date renvoyée par `getDate`, en ordre
 * décroissant (mois le plus récent en premier). Les dates invalides/absentes
 * sont rassemblées dans un groupe « Date inconnue » placé en dernier.
 */
export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  getAmount?: (item: T) => number,
): MonthGroup<T>[] {
  const map = new Map<string, MonthGroup<T>>();

  for (const item of items) {
    const raw = getDate(item);
    const d = raw != null ? new Date(raw) : null;
    const valid = d != null && !isNaN(d.getTime());
    const key = valid
      ? `${d!.getFullYear()}-${String(d!.getMonth() + 1).padStart(2, "0")}`
      : "0000-00";

    let g = map.get(key);
    if (!g) {
      g = { key, label: valid ? monthLabel(d!) : "Date inconnue", items: [], total: 0, count: 0 };
      map.set(key, g);
    }
    g.items.push(item);
    g.count += 1;
    if (getAmount) g.total += getAmount(item) || 0;
  }

  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}
