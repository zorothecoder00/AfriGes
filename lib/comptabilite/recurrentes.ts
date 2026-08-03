// lib/comptabilite/recurrentes.ts
//
// Écritures récurrentes (CDC §26) : loyer, abonnement, assurance, frais
// bancaires... Génération automatique à échéance, idempotente (référence
// SYNC-REC-{id}-{periode}), via le moteur comptable central.
import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

const MOIS_PAR_FREQUENCE: Record<string, number> = { MENSUEL: 1, TRIMESTRIEL: 3, ANNUEL: 12 };

/** Prochaine date d'échéance après `nombreOccurrencesGenerees` générations depuis `dateDebut`. */
function prochaineEcheance(dateDebut: Date, frequence: string, occurrencesGenerees: number): Date {
  const mois = MOIS_PAR_FREQUENCE[frequence] ?? 1;
  const d = new Date(dateDebut);
  d.setMonth(d.getMonth() + mois * occurrencesGenerees);
  return d;
}

/**
 * Génère les échéances dues (date ≤ `dateReference`) de toutes les écritures
 * récurrentes ACTIF, dans la limite de leur date de fin / nombre d'occurrences.
 * Idempotent : n'importe quel appel répété ne génère jamais deux fois la même
 * échéance (référence unique par période).
 */
export async function genererEcheancesDues(
  tx: TxClient,
  dateReference: Date,
  userId: number,
): Promise<{ created: number; skipped: number }> {
  const recurrentes = await tx.ecritureRecurrente.findMany({ where: { statut: "ACTIF" } });
  let created = 0;
  let skipped = 0;

  for (const r of recurrentes) {
    let occurrences = r.nombreOccurrencesGenerees;
    let echeance = prochaineEcheance(r.dateDebut, r.frequence, occurrences);

    while (
      echeance <= dateReference &&
      (r.dateFin == null || echeance <= r.dateFin) &&
      (r.nombreOccurrencesMax == null || occurrences < r.nombreOccurrencesMax)
    ) {
      const periode = `${echeance.getFullYear()}${String(echeance.getMonth() + 1).padStart(2, "0")}`;
      const ecritureId = await creerEcriture(tx, {
        journal: r.journal,
        date: echeance,
        libelle: `${r.libelle} — échéance ${periode}`,
        userId,
        reference: `SYNC-REC-${r.id}-${periode}`,
        lignes: [
          { numero: r.compteDebitNumero, debit: Number(r.montant), libelle: r.libelle },
          { numero: r.compteCreditNumero, credit: Number(r.montant), libelle: r.libelle },
        ],
      });

      // Si la création échoue (compte absent ou période clôturée), on arrête ici
      // pour cette récurrente sans avancer le compteur : la même échéance sera
      // retentée au prochain appel, une fois le problème corrigé — jamais « sautée ».
      if (!ecritureId) { skipped++; break; }

      created++;
      occurrences += 1;
      echeance = prochaineEcheance(r.dateDebut, r.frequence, occurrences);
    }

    const termine =
      (r.dateFin != null && echeance > r.dateFin) ||
      (r.nombreOccurrencesMax != null && occurrences >= r.nombreOccurrencesMax);

    if (occurrences !== r.nombreOccurrencesGenerees) {
      await tx.ecritureRecurrente.update({
        where: { id: r.id },
        data: {
          nombreOccurrencesGenerees: occurrences,
          derniereGenerationLe: dateReference,
          ...(termine && { statut: "TERMINE" }),
        },
      });
    }
  }

  return { created, skipped };
}
