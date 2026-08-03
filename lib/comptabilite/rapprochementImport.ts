// lib/comptabilite/rapprochementImport.ts
//
// Rapprochement bancaire ligne à ligne (CDC §19) : import du relevé (CSV, Excel
// ou OFX), puis proposition automatique de correspondances avec les écritures
// déjà passées sur le compte de trésorerie — le comptable confirme toujours
// avant rapprochement (jamais automatique et silencieux).
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { parserCsv, parserNombreCsv, parserDateCsv, type LigneCsv } from "@/lib/csvParser";

type TxClient = Prisma.TransactionClient;

export interface LigneReleveImport {
  date: Date;
  libelle: string;
  reference: string | null;
  debit: number;
  credit: number;
}

/** Mapping colonnes → LigneReleveImport, partagé par les imports CSV et Excel (même en-têtes attendues). */
function lignesDepuisRowsObjets(rows: LigneCsv[]): { lignes: LigneReleveImport[]; erreurs: string[] } {
  const lignes: LigneReleveImport[] = [];
  const erreurs: string[] = [];

  rows.forEach((row, i) => {
    const dateStr = row["Date"] ?? row["date"];
    const date = parserDateCsv(dateStr);
    if (!date) { erreurs.push(`Ligne ${i + 2} : date invalide ("${dateStr ?? ""}")`); return; }

    const libelle = row["Libelle"] ?? row["Libellé"] ?? row["libelle"] ?? "";
    const debit = parserNombreCsv(row["Debit"] ?? row["Débit"] ?? row["debit"]);
    const credit = parserNombreCsv(row["Credit"] ?? row["Crédit"] ?? row["credit"]);
    const reference = row["Reference"] ?? row["Référence"] ?? row["reference"] ?? null;

    if (debit <= 0 && credit <= 0) { erreurs.push(`Ligne ${i + 2} : ni débit ni crédit renseigné`); return; }

    lignes.push({ date, libelle, reference: reference || null, debit, credit });
  });

  return { lignes, erreurs };
}

/**
 * Format CSV attendu (en-tête, séparateur `,` ou `;` auto-détecté) :
 * Date;Libelle;Debit;Credit;Reference — Date au format ISO ou JJ/MM/AAAA.
 */
export function parserReleveCsv(contenu: string): { lignes: LigneReleveImport[]; erreurs: string[] } {
  return lignesDepuisRowsObjets(parserCsv(contenu));
}

/**
 * Format Excel attendu : mêmes en-têtes que le CSV (Date, Libelle, Debit,
 * Credit, Reference), sur la 1ʳᵉ feuille du classeur, 1ʳᵉ ligne = en-tête.
 * Les cellules Date/Nombre natives Excel sont acceptées telles quelles (pas
 * seulement du texte, contrairement au CSV).
 */
export async function parserReleveXlsx(buffer: Buffer): Promise<{ lignes: LigneReleveImport[]; erreurs: string[] }> {
  const workbook = new ExcelJS.Workbook();
  // @types/node type désormais Buffer<ArrayBufferLike>, incompatible avec la
  // déclaration interne d'exceljs — même donnée binaire, juste un désaccord de
  // types entre libs tierces (aucun impact runtime).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const feuille = workbook.worksheets[0];
  if (!feuille || feuille.rowCount < 2) return { lignes: [], erreurs: ["Classeur vide ou sans données"] };

  const enTetes: string[] = [];
  feuille.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    enTetes[colNumber - 1] = String(cell.value ?? "").trim();
  });

  const rows: LigneCsv[] = [];
  for (let r = 2; r <= feuille.rowCount; r++) {
    const row = feuille.getRow(r);
    if (row.cellCount === 0) continue;
    const obj: LigneCsv = {};
    enTetes.forEach((entete, i) => {
      if (!entete) return;
      const cell = row.getCell(i + 1);
      const v = cell.value;
      if (v instanceof Date) obj[entete] = v.toISOString().slice(0, 10);
      else if (v && typeof v === "object" && "result" in v) obj[entete] = String((v as { result: unknown }).result ?? "");
      else obj[entete] = v == null ? "" : String(v);
    });
    rows.push(obj);
  }

  return lignesDepuisRowsObjets(rows);
}

/**
 * Format OFX (Open Financial Exchange) attendu : blocs `<STMTTRN>` (SGML OFX
 * 1.x non fermé, ou XML OFX 2.x) — extraction par balise plutôt qu'un vrai
 * parseur XML, car l'OFX 1.x n'est pas du XML valide (balises non fermées).
 * `TRNAMT` négatif = débit (sortie), positif = crédit (entrée), comme dans un
 * relevé bancaire classique. `FITID` sert de référence.
 */
export function parserReleveOfx(contenu: string): { lignes: LigneReleveImport[]; erreurs: string[] } {
  const lignes: LigneReleveImport[] = [];
  const erreurs: string[] = [];

  const blocs = contenu.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  if (blocs.length === 0) {
    return { lignes: [], erreurs: ["Aucune transaction <STMTTRN> trouvée — fichier OFX invalide ou vide"] };
  }

  const champ = (bloc: string, tag: string): string | null => {
    const m = bloc.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : null;
  };

  blocs.forEach((bloc, i) => {
    const dtPosted = champ(bloc, "DTPOSTED");
    const trnAmt = champ(bloc, "TRNAMT");
    if (!dtPosted || trnAmt == null) { erreurs.push(`Transaction ${i + 1} : DTPOSTED ou TRNAMT manquant`); return; }

    // DTPOSTED = YYYYMMDD[HHMMSS][.xxx][[gmt offset]]
    const m = dtPosted.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) { erreurs.push(`Transaction ${i + 1} : date invalide ("${dtPosted}")`); return; }
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    const montant = Number(trnAmt.replace(",", "."));
    if (isNaN(montant) || montant === 0) { erreurs.push(`Transaction ${i + 1} : montant invalide ("${trnAmt}")`); return; }

    const nom = champ(bloc, "NAME") ?? "";
    const memo = champ(bloc, "MEMO") ?? "";
    const libelle = [nom, memo].filter(Boolean).join(" — ") || "Transaction OFX";
    const reference = champ(bloc, "FITID");

    lignes.push({
      date, libelle, reference,
      debit: montant < 0 ? Math.abs(montant) : 0,
      credit: montant > 0 ? montant : 0,
    });
  });

  return { lignes, erreurs };
}

/** Importe les lignes d'un relevé pour un compte de trésorerie donné (ex "521"). */
export async function importerLignesReleve(
  tx: TxClient,
  compteNumero: string,
  lignes: LigneReleveImport[],
  userId: number,
): Promise<number> {
  const created = await tx.ligneReleveBancaire.createMany({
    data: lignes.map((l) => ({
      compteNumero,
      date: l.date,
      libelle: l.libelle,
      reference: l.reference,
      debit: l.debit,
      credit: l.credit,
      importeParId: userId,
    })),
  });
  return created.count;
}

export interface PropositionRapprochement {
  ligneReleveId: number;
  ligneEcritureId: number;
  montant: number;
  ecartJours: number;
}

const FENETRE_JOURS = 10;

/**
 * Propose des correspondances entre les lignes de relevé non rapprochées et les
 * lignes d'écriture (validées) du même compte non encore rapprochées, sur un
 * montant identique dans une fenêtre de ±10 jours. Le comptable confirme.
 */
export async function proposerRapprochements(tx: TxClient, compteNumero: string): Promise<PropositionRapprochement[]> {
  const compte = await tx.compteComptable.findUnique({ where: { numero: compteNumero }, select: { id: true } });
  if (!compte) return [];

  const [lignesReleve, dejaRapprochees] = await Promise.all([
    tx.ligneReleveBancaire.findMany({ where: { compteNumero, statut: "NON_RAPPROCHE" } }),
    tx.ligneReleveBancaire.findMany({ where: { compteNumero, ligneEcritureId: { not: null } }, select: { ligneEcritureId: true } }),
  ]);
  if (lignesReleve.length === 0) return [];

  const idsExclus = dejaRapprochees.map((l) => l.ligneEcritureId!).filter(Boolean);
  const lignesEcriture = await tx.ligneEcriture.findMany({
    where: {
      compteId: compte.id,
      id: { notIn: idsExclus.length > 0 ? idsExclus : undefined },
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } },
    },
    include: { ecriture: { select: { date: true } } },
  });

  const propositions: PropositionRapprochement[] = [];
  const ecrituresUtilisees = new Set<number>();

  for (const lr of lignesReleve) {
    const montantReleve = Number(lr.debit) > 0 ? Number(lr.debit) : Number(lr.credit);
    // Sens : un débit bancaire (sortie) correspond à un crédit du compte de trésorerie
    // en comptabilité (et inversement) — le compte bancaire vu de la banque est en
    // miroir du compte 52x/57x vu de l'entreprise.
    const candidat = lignesEcriture.find((le) => {
      if (ecrituresUtilisees.has(le.id)) return false;
      const montantLigne = Number(lr.debit) > 0 ? Number(le.credit) : Number(le.debit);
      if (Math.abs(montantLigne - montantReleve) > 0.01) return false;
      const ecartJours = Math.abs((le.ecriture.date.getTime() - lr.date.getTime()) / 86_400_000);
      return ecartJours <= FENETRE_JOURS;
    });

    if (candidat) {
      ecrituresUtilisees.add(candidat.id);
      propositions.push({
        ligneReleveId: lr.id,
        ligneEcritureId: candidat.id,
        montant: montantReleve,
        ecartJours: Math.round(Math.abs((candidat.ecriture.date.getTime() - lr.date.getTime()) / 86_400_000)),
      });
    }
  }

  return propositions;
}

/** Confirme un rapprochement ligne à ligne (proposé ou choisi manuellement par le comptable). */
export async function confirmerRapprochement(tx: TxClient, ligneReleveId: number, ligneEcritureId: number): Promise<void> {
  const ligne = await tx.ligneReleveBancaire.findUnique({ where: { id: ligneReleveId } });
  if (!ligne) throw new Error("LIGNE_RELEVE_INTROUVABLE");
  if (ligne.statut === "RAPPROCHE") throw new Error("DEJA_RAPPROCHEE");

  await tx.ligneReleveBancaire.update({
    where: { id: ligneReleveId },
    data: { statut: "RAPPROCHE", ligneEcritureId },
  });
}
