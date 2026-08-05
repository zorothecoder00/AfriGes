import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestUser, createTestClient } from "../helpers/fixtures";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";

function ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("CDC §78 — Test 7 : Remboursement crédit", () => {
  it("solde l'échéance du jour, décrémente le solde du crédit et génère l'écriture d'encaissement", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const client = await createTestClient(tx);

      const credit = await tx.creditClient.create({
        data: {
          reference: `CRD-${ref()}`, clientId: client.id, statut: "ACTIF",
          montantTotal: 3000, soldeRestant: 3000, dureeJours: 3,
          dateDebut: new Date(2025, 5, 1), dateEcheanceFin: new Date(2025, 5, 4),
          montantJournalier: 1000, creeParId: user.id,
        },
      });
      await tx.echeanceCredit.createMany({
        data: [
          { creditId: credit.id, numeroEcheance: 1, dateEcheance: new Date(2025, 5, 2), montantDu: 1000 },
          { creditId: credit.id, numeroEcheance: 2, dateEcheance: new Date(2025, 5, 3), montantDu: 1000 },
          { creditId: credit.id, numeroEcheance: 3, dateEcheance: new Date(2025, 5, 4), montantDu: 1000 },
        ],
      });

      const resultat = await enregistrerRemboursementCredit(tx, {
        creditId: credit.id, montant: 1000, numeroJour: 1,
        enregistreParId: user.id, agentCollecteurId: user.id, confirmer: true,
      });
      expect(resultat.ok).toBe(true);
      if (!resultat.ok) return;
      expect(resultat.montantEffectif).toBeCloseTo(1000, 2);

      const echeance1 = await tx.echeanceCredit.findFirst({ where: { creditId: credit.id, numeroEcheance: 1 } });
      expect(echeance1?.statut).toBe("PAYE");

      const creditMaj = await tx.creditClient.findUnique({ where: { id: credit.id } });
      expect(Number(creditMaj?.soldeRestant)).toBeCloseTo(2000, 2);
      // Les échéances 2 et 3 (datées 2025) sont désormais dans le passé au
      // moment de l'exécution du test et non soldées → statut EN_RETARD.
      expect(creditMaj?.statut).toBe("EN_RETARD");

      const ecriture = await tx.ecritureComptable.findFirst({
        where: { reference: { startsWith: `SYNC-RBT-${credit.reference}` } },
        include: { lignes: true },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBeCloseTo(1000, 2);
    });
  });
});
