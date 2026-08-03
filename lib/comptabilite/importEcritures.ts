// lib/comptabilite/importEcritures.ts
//
// Import comptable générique (CDC §47) : Excel/CSV → aperçu de validation avant
// tout import réel ("500 lignes détectées, 495 OK, 3 comptes inconnus, 2
// écritures déséquilibrées"), puis import effectif limité aux groupes valides.
// Format attendu (en-tête) : Date,Journal,Compte,Libelle,Debit,Credit,Reference,Tiers
// — les lignes partageant la même Reference forment une seule écriture.
import type { Prisma, TypeJournalComptable } from "@prisma/client";
import { parserCsv, parserNombreCsv, parserDateCsv } from "@/lib/csvParser";
import { creerEcriture } from "@/lib/comptabilite/moteur";

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
}

const JOURNAUX_VALIDES: TypeJournalComptable[] = ["CAISSE", "BANQUE", "VENTES", "ACHATS", "OD", "PAIE"];

export function parserImportCsv(contenu: string): LigneImportBrute[] {
  const rows = parserCsv(contenu);
  return rows.map((row, i) => ({
    ligneNumero: i + 2,
    date: parserDateCsv(row["Date"] ?? row["date"]),
    journal: (row["Journal"] ?? row["journal"] ?? "").trim().toUpperCase(),
    compteNumero: (row["Compte"] ?? row["compte"] ?? "").trim(),
    libelle: row["Libelle"] ?? row["Libellé"] ?? row["libelle"] ?? "",
    debit: parserNombreCsv(row["Debit"] ?? row["Débit"] ?? row["debit"]),
    credit: parserNombreCsv(row["Credit"] ?? row["Crédit"] ?? row["credit"]),
    reference: (row["Reference"] ?? row["Référence"] ?? row["reference"] ?? "").trim(),
    tiers: row["Tiers"] ?? row["tiers"] ?? null,
  }));
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

  const groupes: GroupeImportApercu[] = [];
  for (const [reference, groupe] of parReference) {
    const totalDebit = groupe.reduce((s, l) => s + l.debit, 0);
    const totalCredit = groupe.reduce((s, l) => s + l.credit, 0);
    const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;
    const journal = groupe[0].journal;
    const journalValide = JOURNAUX_VALIDES.includes(journal as TypeJournalComptable);
    const comptesInconnus = [...new Set(groupe.map((l) => l.compteNumero).filter((n) => n && !numerosExistants.has(n)))];
    const dateInvalide = groupe.some((l) => !l.date);

    const erreurs: string[] = [];
    if (!equilibre) erreurs.push(`Déséquilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`);
    if (!journalValide) erreurs.push(`Journal "${journal}" invalide`);
    if (comptesInconnus.length > 0) erreurs.push(`Compte(s) inconnu(s) : ${comptesInconnus.join(", ")}`);
    if (dateInvalide) erreurs.push("Date invalide sur au moins une ligne");

    groupes.push({
      reference, nbLignes: groupe.length, totalDebit, totalCredit, equilibre,
      journal, journalValide, comptesInconnus, dateInvalide, erreurs,
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
 * (l'aperçu doit avoir été consulté au préalable) — les groupes en erreur sont
 * ignorés et listés dans `groupesIgnores`, jamais importés partiellement.
 */
export async function confirmerImport(
  tx: TxClient,
  lignes: LigneImportBrute[],
  userId: number,
): Promise<{ ecrituresCreees: number; groupesIgnores: string[] }> {
  const apercu = await previsualiserImport(tx, lignes);
  const parReference = new Map<string, LigneImportBrute[]>();
  for (const l of lignes) {
    const cle = l.reference || `SANS-REF-${l.ligneNumero}`;
    const liste = parReference.get(cle) ?? [];
    liste.push(l);
    parReference.set(cle, liste);
  }

  let ecrituresCreees = 0;
  const groupesIgnores: string[] = [];

  for (const g of apercu.groupes) {
    if (g.erreurs.length > 0) { groupesIgnores.push(g.reference); continue; }
    const groupe = parReference.get(g.reference)!;

    const id = await creerEcriture(tx, {
      journal: groupe[0].journal as TypeJournalComptable,
      date: groupe[0].date!,
      libelle: groupe[0].libelle || `Import — ${g.reference}`,
      userId,
      reference: `IMPORT-${g.reference}`,
      lignes: groupe.map((l) => ({
        numero: l.compteNumero,
        debit: l.debit,
        credit: l.credit,
        libelle: l.libelle,
      })),
    });

    if (id) ecrituresCreees++;
    else groupesIgnores.push(g.reference);
  }

  return { ecrituresCreees, groupesIgnores };
}
