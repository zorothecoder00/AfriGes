// lib/comptabilite/rapprochementImport.ts
//
// Rapprochement bancaire ligne à ligne (CDC §19) : import du relevé (CSV), puis
// proposition automatique de correspondances avec les écritures déjà passées sur
// le compte de trésorerie — le comptable confirme toujours avant rapprochement
// (jamais automatique et silencieux).
import type { Prisma } from "@prisma/client";
import { parserCsv, parserNombreCsv, parserDateCsv } from "@/lib/csvParser";

type TxClient = Prisma.TransactionClient;

export interface LigneReleveImport {
  date: Date;
  libelle: string;
  reference: string | null;
  debit: number;
  credit: number;
}

/**
 * Format CSV attendu (en-tête, séparateur `,` ou `;` auto-détecté) :
 * Date;Libelle;Debit;Credit;Reference — Date au format ISO ou JJ/MM/AAAA.
 */
export function parserReleveCsv(contenu: string): { lignes: LigneReleveImport[]; erreurs: string[] } {
  const rows = parserCsv(contenu);
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
