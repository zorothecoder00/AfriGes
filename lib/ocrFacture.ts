// lib/ocrFacture.ts
//
// Extraction heuristique de facture fournisseur PDF (CDC IA/Automatisation §51),
// SANS appel à un service d'IA externe (choix explicite : aucune clé API/coût
// récurrent). Texte brut extrait via `pdf-parse`, puis motifs regex pour
// repérer fournisseur/date/numéro/montants/lignes. C'est une PROPOSITION,
// jamais une certitude : tout champ non détecté reste `null` plutôt que
// d'inventer une valeur — c'est à l'appelant (API /api/comptable/ocr/analyser)
// de présenter ces champs au comptable pour relecture/correction avant toute
// création d'écriture, qui reste TOUJOURS en statut BROUILLON (jamais validée
// automatiquement — voir lib/comptabilite/moteur.ts::creerEcriture).
//
// Module pur : ne touche ni Prisma ni la session — testable indépendamment,
// et importable sans risque de traîner du code serveur non désiré.
import { PDFParse } from "pdf-parse";

export interface LigneFactureExtraite {
  designation: string;
  quantite: number | null;
  prixUnitaire: number | null;
  montant: number | null;
}

export interface DonneesFactureExtraites {
  texteBrut: string;
  fournisseurDetecte: string | null;
  dateDetectee: string | null; // ISO (YYYY-MM-DD) si parsable
  numeroDetecte: string | null;
  montantHT: number | null;
  montantTVA: number | null;
  montantTTC: number | null;
  lignes: LigneFactureExtraite[];
}

/** Parse un nombre au format FR ("1 234,56" ou "1234.56") en float. */
function parserMontant(brut: string): number | null {
  const nettoye = brut.replace(/[^\d,.\s]/g, "").trim();
  if (!nettoye) return null;
  // "1 234,56" → "1234.56" ; "1234.56" reste inchangé.
  const normalise = nettoye.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const n = Number(normalise);
  return Number.isFinite(n) ? n : null;
}

/** Cherche le premier montant après un des motifs donnés (insensible à la casse). */
function chercherMontant(texte: string, motifs: string[]): number | null {
  for (const motif of motifs) {
    const re = new RegExp(`${motif}[^\\d]{0,15}([\\d\\s]+[.,]\\d{2})`, "i");
    const m = texte.match(re);
    if (m) {
      const v = parserMontant(m[1]);
      if (v != null) return v;
    }
  }
  return null;
}

/** Convertit "dd/mm/yyyy" ou "dd-mm-yyyy" ou "dd.mm.yyyy" en ISO (YYYY-MM-DD). */
function normaliserDate(jour: string, mois: string, annee: string): string | null {
  const a = annee.length === 2 ? `20${annee}` : annee;
  const j = jour.padStart(2, "0");
  const m = mois.padStart(2, "0");
  const d = new Date(`${a}-${m}-${j}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  return `${a}-${m}-${j}`;
}

function detecterDate(texte: string): string | null {
  const m = texte.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/);
  if (!m) return null;
  return normaliserDate(m[1], m[2], m[3]);
}

function detecterNumero(texte: string): string | null {
  const m = texte.match(/(?:facture|invoice)\s*n?[°ºo]?\s*:?\s*([A-Z0-9][\w\-/]{2,20})/i);
  return m ? m[1].trim() : null;
}

/** Heuristique : la première ligne non vide qui n'est pas un mot-clé de facture est probablement le fournisseur. */
function detecterFournisseur(texte: string): string | null {
  const MOTS_CLES_IGNORES = /^(facture|invoice|devis|bon de|n[°ºo]|date|client|adresse|tel|email|siret|rccm|nif)/i;
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const ligne of lignes.slice(0, 8)) {
    if (ligne.length < 3 || ligne.length > 80) continue;
    if (MOTS_CLES_IGNORES.test(ligne)) continue;
    if (/^\d+$/.test(ligne)) continue;
    return ligne;
  }
  return null;
}

/**
 * Détection best-effort de lignes tabulaires "désignation … qté … prix … montant".
 * Renvoie `[]` (jamais de ligne inventée) si aucun motif exploitable n'est trouvé.
 */
function detecterLignes(texte: string): LigneFactureExtraite[] {
  const lignes: LigneFactureExtraite[] = [];
  const LIGNE_RE = /^(.{3,60}?)\s+(\d+(?:[.,]\d+)?)\s+(\d[\d\s]*[.,]\d{2})\s+(\d[\d\s]*[.,]\d{2})\s*$/;
  for (const brute of texte.split(/\r?\n/)) {
    const m = brute.trim().match(LIGNE_RE);
    if (!m) continue;
    const quantite = parserMontant(m[2]);
    const prixUnitaire = parserMontant(m[3]);
    const montant = parserMontant(m[4]);
    if (quantite == null || prixUnitaire == null || montant == null) continue;
    lignes.push({ designation: m[1].trim(), quantite, prixUnitaire, montant });
  }
  return lignes;
}

/** Extrait le texte brut d'un PDF (Node.js — pdf-parse/pdfjs-dist). */
export async function extraireTextePdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const resultat = await parser.getText();
    return resultat.text;
  } finally {
    await parser.destroy();
  }
}

/**
 * Extraction heuristique complète d'une facture fournisseur PDF. Ne lève pas
 * d'exception sur un document mal formé — retourne des champs `null`/`[]`
 * plutôt qu'une erreur, pour que le comptable puisse toujours saisir
 * manuellement à partir de ce qui a été trouvé.
 */
export async function extraireDonneesFacture(buffer: Buffer): Promise<DonneesFactureExtraites> {
  let texteBrut = "";
  try {
    texteBrut = await extraireTextePdf(buffer);
  } catch {
    texteBrut = "";
  }

  return {
    texteBrut,
    fournisseurDetecte: texteBrut ? detecterFournisseur(texteBrut) : null,
    dateDetectee: texteBrut ? detecterDate(texteBrut) : null,
    numeroDetecte: texteBrut ? detecterNumero(texteBrut) : null,
    montantHT: texteBrut ? chercherMontant(texteBrut, ["total\\s*ht", "montant\\s*ht", "\\bht\\b"]) : null,
    montantTVA: texteBrut ? chercherMontant(texteBrut, ["tva"]) : null,
    montantTTC: texteBrut ? chercherMontant(texteBrut, ["total\\s*ttc", "montant\\s*ttc", "net\\s*[àa]\\s*payer", "\\bttc\\b"]) : null,
    lignes: texteBrut ? detecterLignes(texteBrut) : [],
  };
}
