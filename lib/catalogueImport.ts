/**
 * Import/Export du catalogue (Catalogue §17/§18) — définitions partagées.
 * Décrit les colonnes canoniques d'un fichier d'import produits, la
 * normalisation des en-têtes (tolérante aux accents/casse/libellés) et la
 * coercition des valeurs. Sans accès base (réutilisé client + serveur).
 */

export interface ColonneImport {
  key: string;       // champ canonique
  label: string;     // libellé humain (en-tête du modèle)
  exemple: string;   // valeur d'exemple pour le modèle
  requis?: boolean;  // requis à la création
  aliases?: string[]; // en-têtes alternatifs acceptés
}

export const COLONNES_IMPORT: ColonneImport[] = [
  { key: "codeProduit",   label: "Code produit",   exemple: "PRD-000001", aliases: ["code", "code_produit"] },
  { key: "reference",     label: "Référence",      exemple: "REF-123", aliases: ["ref"] },
  { key: "nom",           label: "Nom",            exemple: "Riz parfumé 5kg", requis: true, aliases: ["designation", "libelle", "produit"] },
  { key: "nomCommercial", label: "Nom commercial", exemple: "", aliases: ["nom_commercial"] },
  { key: "description",   label: "Description",    exemple: "" },
  { key: "codeBarre",     label: "Code-barres",    exemple: "6001234567890", aliases: ["ean", "gencod", "code_barre", "codebarre"] },
  { key: "prixUnitaire",  label: "Prix vente",     exemple: "4500", requis: true, aliases: ["prix", "prix_vente", "pvente", "prixunitaire"] },
  { key: "prixAchat",     label: "Prix achat",     exemple: "3800", aliases: ["cout", "prix_achat", "pachat"] },
  { key: "famille",       label: "Famille",        exemple: "Alimentaire" },
  { key: "categorie",     label: "Catégorie",      exemple: "Céréales", aliases: ["categories"] },
  { key: "marque",        label: "Marque",         exemple: "AfriBrand" },
  { key: "uniteVente",    label: "Unité de vente", exemple: "Sac", aliases: ["unite", "unite_vente"] },
  { key: "alerteStock",   label: "Seuil d'alerte", exemple: "10", aliases: ["seuil", "alerte", "alerte_stock"] },
];

/** Normalise un en-tête : minuscules, sans accents ni séparateurs. */
export function normaliserEntete(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Index de résolution en-tête normalisé → clé canonique.
const INDEX_ENTETE: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const c of COLONNES_IMPORT) {
    idx[normaliserEntete(c.label)] = c.key;
    idx[normaliserEntete(c.key)] = c.key;
    for (const a of c.aliases ?? []) idx[normaliserEntete(a)] = c.key;
  }
  return idx;
})();

/** Résout un en-tête de fichier vers une clé canonique (ou null si inconnu). */
export function resoudreEntete(entete: string): string | null {
  return INDEX_ENTETE[normaliserEntete(entete)] ?? null;
}

/**
 * Transforme une matrice (1ʳᵉ ligne = en-têtes) en lignes canoniques
 * `{ cle: valeur }`, en ignorant les colonnes non reconnues et les lignes vides.
 */
export function matriceVersLignes(matrice: (string | number | null)[][]): Record<string, string>[] {
  if (matrice.length < 2) return [];
  const [entetes, ...corps] = matrice;
  const mapping = entetes.map((e) => resoudreEntete(String(e ?? "")));
  const lignes: Record<string, string>[] = [];
  for (const row of corps) {
    const obj: Record<string, string> = {};
    let vide = true;
    row.forEach((cell, i) => {
      const key = mapping[i];
      if (!key) return;
      const v = cell == null ? "" : String(cell).trim();
      if (v !== "") { obj[key] = v; vide = false; }
    });
    if (!vide) lignes.push(obj);
  }
  return lignes;
}

/** Parse un nombre tolérant (virgule décimale, espaces, séparateurs milliers). */
export function parseNombre(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/\s/g, "").replace(/ /g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/** Lignes du modèle d'import (en-têtes + une ligne d'exemple). */
export function modeleImportRows(): (string | number)[][] {
  return [
    COLONNES_IMPORT.map((c) => c.label),
    COLONNES_IMPORT.map((c) => c.exemple),
  ];
}
