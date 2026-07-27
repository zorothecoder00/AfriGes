/**
 * lib/diffChamps.ts — Calcule les champs réellement modifiés entre l'ancien
 * et le nouvel état d'un enregistrement (CDC §15 "ancienne valeur / nouvelle
 * valeur"). Ignore les champs non présents dans `nouveau` (édition partielle).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diffChamps(ancien: Record<string, any>, nouveau: Record<string, any>): Record<string, { avant: unknown; apres: unknown }> {
  const diff: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const key of Object.keys(nouveau)) {
    const avant = ancien[key] ?? null;
    const apres = nouveau[key] ?? null;
    const avantStr = avant instanceof Date ? avant.toISOString() : String(avant);
    const apresStr = apres instanceof Date ? apres.toISOString() : String(apres);
    if (avantStr !== apresStr) diff[key] = { avant, apres };
  }
  return diff;
}
