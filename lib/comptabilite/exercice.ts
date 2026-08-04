// lib/comptabilite/exercice.ts
//
// Exercices comptables : ouverture, clôture définitive et report à nouveau
// (CDC §28-32). La clôture réutilise l'assistant de contrôles (CDC §40,
// lib/comptabilite/controles.ts) comme portillon bloquant, et le compte de
// résultat déjà calculé depuis les écritures (lib/comptabilite/etatsFinanciers.ts)
// pour déterminer le résultat net à reporter.
//
// Important : genererBilan (etatsFinanciers.ts) exclut volontairement les
// comptes de type CHARGES/PRODUITS — sans l'écriture de clôture ci-dessous qui
// solde ces comptes vers 131/132, le résultat de l'exercice n'apparaîtrait
// jamais dans les capitaux propres et le bilan ne s'équilibrerait pas d'une
// année sur l'autre.
import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";
import { genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";
import { executerControles } from "@/lib/comptabilite/controles";

type TxClient = Prisma.TransactionClient;

export async function ouvrirExercice(tx: TxClient, annee: number) {
  const existing = await tx.exerciceComptable.findUnique({ where: { annee } });
  if (existing) return existing;
  return tx.exerciceComptable.create({
    data: {
      annee,
      dateDebut: new Date(annee, 0, 1),
      dateFin: new Date(annee, 11, 31, 23, 59, 59, 999),
      statut: "OUVERT",
    },
  });
}

export interface ResultatCloture {
  ecritureClotureId: number | null;
  ecritureReportId: number | null;
  resultatNet: number;
  controlesBloquants: string[];
}

/**
 * Clôture définitive d'un exercice (CDC §31) :
 *  1. Bloque si l'assistant de contrôles remonte une anomalie BLOQUANTE.
 *  2. Solde tous les comptes de charges/produits de l'année vers 131 (bénéfice)
 *     ou 132 (perte) — écriture de détermination du résultat.
 *  3. Reporte immédiatement ce résultat en 110/119 (report à nouveau) — en
 *     l'absence de module d'affectation (réserves/dividendes), le report est
 *     direct et intégral.
 *  4. Verrouille les 12 mois de l'année (ClotureComptable) qui ne le sont pas
 *     déjà — plus aucune écriture ne pourra y être créée (CDC §31).
 */
export async function cloturerExercice(tx: TxClient, annee: number, userId: number): Promise<ResultatCloture> {
  const exercice = await tx.exerciceComptable.findUnique({ where: { annee } });
  if (!exercice) throw new Error("EXERCICE_INTROUVABLE");
  if (exercice.statut === "CLOTURE") throw new Error("DEJA_CLOTURE");

  const controles = await executerControles(tx);
  const bloquants = controles.filter((c) => c.gravite === "BLOQUANT");
  if (bloquants.length > 0) {
    return { ecritureClotureId: null, ecritureReportId: null, resultatNet: 0, controlesBloquants: bloquants.map((b) => b.message) };
  }

  const { produits, charges, resultatNet } = await genererCompteResultat(tx, exercice.dateDebut, exercice.dateFin);

  const lignesCloture: { numero: string; debit?: number; credit?: number; libelle: string }[] = [];
  for (const p of produits) if (p.montant > 0) lignesCloture.push({ numero: p.compteNumero, debit: p.montant, libelle: `Solde ${p.libelle}` });
  for (const c of charges) if (c.montant > 0) lignesCloture.push({ numero: c.compteNumero, credit: c.montant, libelle: `Solde ${c.libelle}` });
  if (resultatNet > 0) lignesCloture.push({ numero: "131", credit: resultatNet, libelle: `Résultat net ${annee}` });
  else if (resultatNet < 0) lignesCloture.push({ numero: "132", debit: -resultatNet, libelle: `Résultat net ${annee}` });

  let ecritureClotureId: number | null = null;
  if (lignesCloture.length > 0) {
    ecritureClotureId = await creerEcriture(tx, {
      journal: "CLOTURE",
      date: exercice.dateFin,
      libelle: `Clôture de l'exercice ${annee} — détermination du résultat`,
      userId,
      reference: `SYNC-CLOTURE-${annee}`,
      ignorerCloture: true,
      statut: "VALIDE",
      lignes: lignesCloture,
    });
  }

  let ecritureReportId: number | null = null;
  if (Math.abs(resultatNet) > 0.01) {
    ecritureReportId = await creerEcriture(tx, {
      journal: "CLOTURE",
      date: exercice.dateFin,
      libelle: `Report à nouveau — résultat ${annee}`,
      userId,
      reference: `SYNC-REPORT-${annee}`,
      ignorerCloture: true,
      statut: "VALIDE",
      lignes:
        resultatNet > 0
          ? [
              { numero: "131", debit: resultatNet, libelle: `Solde résultat ${annee}` },
              { numero: "110", credit: resultatNet, libelle: `Report à nouveau ${annee}` },
            ]
          : [
              { numero: "119", debit: -resultatNet, libelle: `Report à nouveau ${annee}` },
              { numero: "132", credit: -resultatNet, libelle: `Solde résultat ${annee}` },
            ],
    });
  }

  for (let mois = 1; mois <= 12; mois++) {
    const existeCloture = await tx.clotureComptable.findUnique({ where: { annee_mois: { annee, mois } } });
    if (!existeCloture) await tx.clotureComptable.create({ data: { annee, mois, cloturePar: userId } });
  }

  await tx.exerciceComptable.update({
    where: { id: exercice.id },
    data: {
      statut: "CLOTURE",
      clotureParId: userId,
      dateCloture: new Date(),
      ecritureClotureId,
      ecritureReportANouveauId: ecritureReportId,
    },
  });

  return { ecritureClotureId, ecritureReportId, resultatNet, controlesBloquants: [] };
}
