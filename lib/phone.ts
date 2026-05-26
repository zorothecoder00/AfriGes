/**
 * Normalisation des numéros de téléphone en format E.164.
 *
 * Pays supportés avec auto-détection des formats locaux :
 *   Togo (+228)          : 8 chiffres  — ex: 90123456, 70123456
 *   Bénin (+229)         : 8 chiffres  — ex: 60123456, 90123456, 51123456
 *   Côte d'Ivoire (+225) : 10 chiffres — ex: 0102345678  (format post-2021)
 *   Cameroun (+237)      : 9 chiffres  — ex: 690123456   (secondaire)
 *
 * Ambiguïté Togo / Bénin :
 *   Les numéros locaux à 8 chiffres sans indicatif sont indiscernables entre
 *   Togo (7x/9x) et Bénin (5x/6x/9x). La variable d'environnement
 *   DEFAULT_PHONE_PREFIX (ex: "228" ou "229") est utilisée comme fallback.
 *   Défaut : "228" (Togo).
 *
 * Exemples de formats reconnus (tous → E.164) :
 *   "90 12 34 56"      → +22890123456
 *   "090123456"        → +22890123456
 *   "22890123456"      → +22890123456
 *   "+22890123456"     → +22890123456  (déjà E.164)
 *   "0102345678"       → +2250102345678
 *   "+2250102345678"   → +2250102345678
 */
export function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");

  // ── Déjà en E.164 ─────────────────────────────────────────────────────────
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;

  // ── Avec indicatif connu, sans le + ───────────────────────────────────────
  if (/^228\d{8}$/.test(cleaned))  return `+${cleaned}`;  // Togo      11 ch.
  if (/^229\d{8}$/.test(cleaned))  return `+${cleaned}`;  // Bénin     11 ch.
  if (/^225\d{10}$/.test(cleaned)) return `+${cleaned}`;  // CIV       13 ch.
  if (/^237\d{9}$/.test(cleaned))  return `+${cleaned}`;  // Cameroun  12 ch.

  // ── Côte d'Ivoire local (format depuis 2021) ───────────────────────────────
  // 10 chiffres commençant par 0, ex: 0102345678 → +2250102345678
  // Note: exclut "06xxxxxxxx" (10 ch.) qui est le préfixe Cameroun avec 0
  if (/^0[0-57-9]\d{8}$/.test(cleaned)) return `+225${cleaned}`;

  // ── Cameroun local (secondaire) ────────────────────────────────────────────
  // 9 chiffres commençant par 6, ou "06xxxxxxxx" (10 ch. avec 0 préfixe)
  if (/^6\d{8}$/.test(cleaned))  return `+237${cleaned}`;
  if (/^06\d{8}$/.test(cleaned)) return `+237${cleaned.slice(1)}`;

  // ── Togo / Bénin local ─────────────────────────────────────────────────────
  // 8 chiffres (ex: 90123456) ou 9 chiffres avec 0 préfixe (ex: 090123456)
  const defaultPrefix = process.env.DEFAULT_PHONE_PREFIX ?? "228";
  if (/^\d{8}$/.test(cleaned))   return `+${defaultPrefix}${cleaned}`;
  if (/^0\d{8}$/.test(cleaned))  return `+${defaultPrefix}${cleaned.slice(1)}`;

  // ── Générique : indicatif déjà présent (10–15 chiffres sans +) ────────────
  if (/^\d{10,15}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}
