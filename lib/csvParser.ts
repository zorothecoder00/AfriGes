// lib/csvParser.ts
//
// Parseur CSV minimal (sans dépendance) : détecte automatiquement le séparateur
// (`;` ou `,`), gère les champs entre guillemets, retourne un tableau d'objets
// indexés par l'en-tête. Utilisé pour l'import du relevé bancaire (CDC §19) et
// l'import comptable générique (CDC §47).
export interface LigneCsv {
  [colonne: string]: string;
}

function detecterSeparateur(premiereLigne: string): string {
  const virgules = (premiereLigne.match(/,/g) ?? []).length;
  const points_virgules = (premiereLigne.match(/;/g) ?? []).length;
  return points_virgules > virgules ? ";" : ",";
}

function parserLigne(ligne: string, separateur: string): string[] {
  const champs: string[] = [];
  let courant = "";
  let dansGuillemets = false;

  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i];
    if (c === '"') {
      if (dansGuillemets && ligne[i + 1] === '"') { courant += '"'; i++; }
      else dansGuillemets = !dansGuillemets;
    } else if (c === separateur && !dansGuillemets) {
      champs.push(courant.trim());
      courant = "";
    } else {
      courant += c;
    }
  }
  champs.push(courant.trim());
  return champs;
}

/** Parse un CSV avec en-tête en tableau d'objets { colonne: valeur }. Ignore les lignes vides. */
export function parserCsv(contenu: string): LigneCsv[] {
  const lignes = contenu.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lignes.length === 0) return [];

  const separateur = detecterSeparateur(lignes[0]);
  const entetes = parserLigne(lignes[0], separateur).map((e) => e.trim());

  return lignes.slice(1).map((ligne) => {
    const valeurs = parserLigne(ligne, separateur);
    const obj: LigneCsv = {};
    entetes.forEach((entete, i) => { obj[entete] = (valeurs[i] ?? "").trim(); });
    return obj;
  });
}

/** Parse un nombre depuis une chaîne CSV : accepte "1 234,56", "1234.56", "" → 0. */
export function parserNombreCsv(valeur: string | undefined): number {
  if (!valeur) return 0;
  const nettoye = valeur.replace(/\s/g, "").replace(",", ".");
  const n = Number(nettoye);
  return isNaN(n) ? 0 : n;
}

/** Parse une date depuis une chaîne CSV : accepte ISO (2026-01-15) ou français (15/01/2026). */
export function parserDateCsv(valeur: string | undefined): Date | null {
  if (!valeur) return null;
  const v = valeur.trim();
  const frMatch = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frMatch) {
    const [, j, m, a] = frMatch;
    return new Date(Number(a), Number(m) - 1, Number(j));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
