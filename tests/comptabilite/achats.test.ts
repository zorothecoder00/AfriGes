import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestPdv, createTestUser, createTestProduit, createTestFournisseur } from "../helpers/fixtures";
import { creerEcritureAchatDepuisMouvement } from "@/lib/ecritureAchatServer";

function ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("CDC §78 — Test 3 : Achat comptant", () => {
  it("crédite directement la trésorerie (pas le fournisseur) quand la réception est réglée comptant", async () => {
    await withRollback(async (tx) => {
      const pdv = await createTestPdv(tx);
      const user = await createTestUser(tx);
      const fournisseur = await createTestFournisseur(tx);
      const produit = await createTestProduit(tx, { prixUnitaire: 500 });

      const reception = await tx.receptionApprovisionnement.create({
        data: {
          reference: `REC-${ref()}`, type: "FOURNISSEUR", pointDeVenteId: pdv.id,
          fournisseurId: fournisseur.id, datePrevisionnelle: new Date(2025, 5, 1),
          modeReglement: "COMPTANT", modePaiement: "ESPECES", receptionneParId: user.id,
        },
      });
      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId: produit.id, pointDeVenteId: pdv.id, type: "ENTREE", typeEntree: "RECEPTION_FOURNISSEUR",
          quantite: 10, reference: `MVT-${ref()}`, receptionApproId: reception.id, dateMouvement: new Date(2025, 5, 1),
        },
      });

      await creerEcritureAchatDepuisMouvement(tx, mouvement.id, user.id);
      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-MST-${mouvement.id}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      // Comptant : crédité en trésorerie (571/521), jamais 401 fournisseur.
      const ligneCredit = ecriture!.lignes.find((l) => Number(l.credit) > 0);
      expect(ligneCredit?.compte.numero.startsWith("401")).toBe(false);
    });
  });
});

describe("CDC §78 — Test 4 : Achat à crédit", () => {
  it("crédite le sous-compte auxiliaire du fournisseur (401xxx) quand la réception est à crédit", async () => {
    await withRollback(async (tx) => {
      const pdv = await createTestPdv(tx);
      const user = await createTestUser(tx);
      const fournisseur = await createTestFournisseur(tx);
      const produit = await createTestProduit(tx, { prixUnitaire: 500 });

      const reception = await tx.receptionApprovisionnement.create({
        data: {
          reference: `REC-${ref()}`, type: "FOURNISSEUR", pointDeVenteId: pdv.id,
          fournisseurId: fournisseur.id, datePrevisionnelle: new Date(2025, 5, 2),
          modeReglement: "CREDIT", receptionneParId: user.id,
        },
      });
      const mouvement = await tx.mouvementStock.create({
        data: {
          produitId: produit.id, pointDeVenteId: pdv.id, type: "ENTREE", typeEntree: "RECEPTION_FOURNISSEUR",
          quantite: 10, reference: `MVT-${ref()}`, receptionApproId: reception.id, dateMouvement: new Date(2025, 5, 2),
        },
      });

      await creerEcritureAchatDepuisMouvement(tx, mouvement.id, user.id);
      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-MST-${mouvement.id}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      const ligneCredit = ecriture!.lignes.find((l) => Number(l.credit) > 0);
      expect(ligneCredit?.compte.numero.startsWith("401")).toBe(true);
      expect(ligneCredit?.compte.fournisseurId).toBe(fournisseur.id);
    });
  });
});
