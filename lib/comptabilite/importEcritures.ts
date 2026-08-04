// lib/comptabilite/importEcritures.ts
//
// Import comptable générique (CDC §47) : Excel/CSV → aperçu de validation avant
// tout import réel ("500 lignes détectées, 495 OK, 3 comptes inconnus, 2
// écritures déséquilibrées"), puis import effectif limité aux groupes valides
// (import strictement bloqué tant qu'il reste des groupes en erreur, sauf
// dérogation explicite `forcerImportPartiel`). Format attendu (en-tête) :
// Date,Journal,Compte,Libelle,Debit,Credit,Reference,Tiers,Analytique — les
// lignes partageant la même Reference forment une seule écriture.
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { parserCsv, parserNombreCsv, parserDateCsv, type LigneCsv } from "@/lib/csvParser";
import { creerEcriture, journalValide } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

export interface LigneImportBrute {
  ligneNumero: number;
  date: Date | null;
  journal: string;
  compteNumero: string;
  libelle: string;
  debit: number;
  credit: number;
  reference: string;
  tiers: string | null;
  analytiqueCode: string | null;
}

function ligneDepuisRow(row: LigneCsv, ligneNumero: number): LigneImportBrute {
  return {
    ligneNumero,
    date: parserDateCsv(row["Date"] ?? row["date"]),
    journal: (row["Journal"] ?? row["journal"] ?? "").trim().toUpperCase(),
    compteNumero: (row["Compte"] ?? row["compte"] ?? "").trim(),
    libelle: row["Libelle"] ?? row["Libellé"] ?? row["libelle"] ?? "",
    debit: parserNombreCsv(row["Debit"] ?? row["Débit"] ?? row["debit"]),
    credit: parserNombreCsv(row["Credit"] ?? row["Crédit"] ?? row["credit"]),
    reference: (row["Reference"] ?? row["Référence"] ?? row["reference"] ?? "").trim(),
    tiers: row["Tiers"] ?? row["tiers"] ?? null,
    analytiqueCode: (row["Analytique"] ?? row["analytique"] ?? "").trim() || null,
  };
}

export function parserImportCsv(contenu: string): LigneImportBrute[] {
  const rows = parserCsv(contenu);
  return rows.map((row, i) => ligneDepuisRow(row, i + 2));
}

/** Import Excel (.xlsx) — même mapping de colonnes que le CSV (CDC §47 : "prévoir l'import Excel/CSV"). */
export async function parserImportXlsx(buffer: Buffer): Promise<LigneImportBrute[]> {
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const feuille = workbook.worksheets[0];
  if (!feuille || feuille.rowCount < 2) return [];

  const entetes: string[] = [];
  feuille.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    entetes[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const lignes: LigneImportBrute[] = [];
  for (let r = 2; r <= feuille.rowCount; r++) {
    const row = feuille.getRow(r);
    if (row.cellCount === 0) continue;
    const obj: LigneCsv = {};
    entetes.forEach((entete, i) => {
      if (!entete) return;
      const cell = row.getCell(i + 1);
      const v = cell.value;
      if (v instanceof Date) obj[entete] = v.toISOString().slice(0, 10);
      else if (v && typeof v === "object" && "result" in v) obj[entete] = String((v as { result: unknown }).result ?? "");
      else obj[entete] = v == null ? "" : String(v);
    });
    lignes.push(ligneDepuisRow(obj, r));
  }
  return lignes;
}

export interface GroupeImportApercu {
  reference: string;
  nbLignes: number;
  totalDebit: number;
  totalCredit: number;
  equilibre: boolean;
  journal: string;
  journalValide: boolean;
  comptesInconnus: string[];
  dateInvalide: boolean;
  sectionsInconnues: string[];
  erreurs: string[];
}

export interface ApercuImport {
  totalLignes: number;
  totalGroupes: number;
  groupesValides: number;
  groupesEnErreur: number;
  groupes: GroupeImportApercu[];
}

/** Regroupe les lignes brutes par référence et valide chaque groupe (comptes, équilibre, journal, date) — sans rien écrire en base. */
export async function previsualiserImport(tx: TxClient, lignes: LigneImportBrute[]): Promise<ApercuImport> {
  const parReference = new Map<string, LigneImportBrute[]>();
  for (const l of lignes) {
    const cle = l.reference || `SANS-REF-${l.ligneNumero}`;
    const liste = parReference.get(cle) ?? [];
    liste.push(l);
    parReference.set(cle, liste);
  }

  const tousComptes = [...new Set(lignes.map((l) => l.compteNumero).filter(Boolean))];
  const comptesExistants = await tx.compteComptable.findMany({
    where: { numero: { in: tousComptes }, actif: true },
    select: { numero: true },
  });
  const numerosExistants = new Set(comptesExistants.map((c) => c.numero));

  const tousCodesAnalytiques = [...new Set(lignes.map((l) => l.analytiqueCode).filter((c): c is string => !!c))];
  const sectionsExistantes = tousCodesAnalytiques.length
    ? await tx.sectionAnalytique.findMany({ where: { code: { in: tousCodesAnalytiques }, actif: true }, select: { code: true } })
    : [];
  const codesAnalytiquesExistants = new Set(sectionsExistantes.map((s) => s.code));

  const groupes: GroupeImportApercu[] = [];
  for (const [reference, groupe] of parReference) {
    const totalDebit = groupe.reduce((s, l) => s + l.debit, 0);
    const totalCredit = groupe.reduce((s, l) => s + l.credit, 0);
    const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;
    const journal = groupe[0].journal;
    const journalEstValide = await journalValide(tx, journal);
    const comptesInconnus = [...new Set(groupe.map((l) => l.compteNumero).filter((n) => n && !numerosExistants.has(n)))];
    const dateInvalide = groupe.some((l) => !l.date);
    const sectionsInconnues = [...new Set(groupe.map((l) => l.analytiqueCode).filter((c): c is string => !!c && !codesAnalytiquesExistants.has(c)))];

    const erreurs: string[] = [];
    if (!equilibre) erreurs.push(`Déséquilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`);
    if (!journalEstValide) erreurs.push(`Journal "${journal}" invalide`);
    if (comptesInconnus.length > 0) erreurs.push(`Compte(s) inconnu(s) : ${comptesInconnus.join(", ")}`);
    if (dateInvalide) erreurs.push("Date invalide sur au moins une ligne");
    if (sectionsInconnues.length > 0) erreurs.push(`Section(s) analytique(s) inconnue(s) : ${sectionsInconnues.join(", ")}`);

    groupes.push({
      reference, nbLignes: groupe.length, totalDebit, totalCredit, equilibre,
      journal, journalValide: journalEstValide, comptesInconnus, dateInvalide, sectionsInconnues, erreurs,
    });
  }

  const groupesValides = groupes.filter((g) => g.erreurs.length === 0).length;
  return {
    totalLignes: lignes.length,
    totalGroupes: groupes.length,
    groupesValides,
    groupesEnErreur: groupes.length - groupesValides,
    groupes: groupes.sort((a, b) => a.reference.localeCompare(b.reference)),
  };
}

/**
 * Importe réellement les écritures : uniquement les groupes 100% valides
 * (l'aperçu doit avoir été consulté au préalable). Par défaut, STRICTEMENT
 * bloqué tant qu'il reste un groupe en erreur (CDC §47 : "l'import ne doit
 * être validé qu'après correction") — passer `forcerImportPartiel: true` pour
 * importer quand même les groupes valides en ignorant les autres (dérogation
 * explicite, tracée dans `groupesIgnores`).
 */
export async function confirmerImport(
  tx: TxClient,
  lignes: LigneImportBrute[],
  userId: number,
  opts?: { forcerImportPartiel?: boolean },
): Promise<{ ecrituresCreees: number; groupesIgnores: string[]; bloque?: boolean }> {
  const apercu = await previsualiserImport(tx, lignes);
  if (apercu.groupesEnErreur > 0 && !opts?.forcerImportPartiel) {
    return { ecrituresCreees: 0, groupesIgnores: apercu.groupes.filter((g) => g.erreurs.length > 0).map((g) => g.reference), bloque: true };
  }

  const parReference = new Map<string, LigneImportBrute[]>();
  for (const l of lignes) {
    const cle = l.reference || `SANS-REF-${l.ligneNumero}`;
    const liste = parReference.get(cle) ?? [];
    liste.push(l);
    parReference.set(cle, liste);
  }

  const tousCodesAnalytiques = [...new Set(lignes.map((l) => l.analytiqueCode).filter((c): c is string => !!c))];
  const sections = tousCodesAnalytiques.length
    ? await tx.sectionAnalytique.findMany({ where: { code: { in: tousCodesAnalytiques }, actif: true }, select: { id: true, code: true } })
    : [];
  const sectionIdParCode = new Map(sections.map((s) => [s.code, s.id]));

  let ecrituresCreees = 0;
  const groupesIgnores: string[] = [];

  for (const g of apercu.groupes) {
    if (g.erreurs.length > 0) { groupesIgnores.push(g.reference); continue; }
    const groupe = parReference.get(g.reference)!;

    const id = await creerEcriture(tx, {
      journal: groupe[0].journal,
      date: groupe[0].date!,
      libelle: groupe[0].libelle || `Import — ${g.reference}`,
      userId,
      reference: `IMPORT-${g.reference}`,
      lignes: groupe.map((l) => ({
        numero: l.compteNumero,
        debit: l.debit,
        credit: l.credit,
        // Tiers (CDC §47) : pas de champ dédié sur LigneEcriture pour un tiers
        // texte libre issu d'un import générique — repris dans le libellé pour
        // ne pas le perdre, plutôt que de l'ignorer silencieusement.
        libelle: l.tiers && !l.libelle.includes(l.tiers) ? `${l.libelle} — ${l.tiers}` : l.libelle,
        sectionAnalytiqueId: l.analytiqueCode ? (sectionIdParCode.get(l.analytiqueCode) ?? null) : null,
      })),
    });

    if (id) ecrituresCreees++;
    else groupesIgnores.push(g.reference);
  }

  return { ecrituresCreees, groupesIgnores };
}
