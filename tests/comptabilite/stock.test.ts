import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestPdv, createTestUser, createTestProduit } from "../helpers/fixtures";
import { comptabiliserAjustementStock } from "@/lib/comptabilite/ecrituresAjustement";
import { comptabiliserBonSortie } from "@/lib/comptabilite/ecrituresBonSortie";

function ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("CDC §78 — Test 8 : Entrée de stock (ajustement positif)", () => {
  it("Dr compte stock / Cr compte variation de stock pour un surplus", async () => {
    await withRollback(async (tx) => {
      const pdv = await createTestPdv(tx);
      const user = await createTestUser(tx);
      const produit = await createTestProduit(tx, { prixAchat: 700 });

      const demande = await tx.demandeAjustementStock.create({
        data: {
          produitId: produit.id, pointDeVenteId: pdv.id, ancienneQuantite: 10, nouvelleQuantite: 15,
          justification: "Test entrée stock", statut: "APPROUVE", demandeurId: user.id, validateurId: user.id,
        },
      });

      const ecritureId = await comptabiliserAjustementStock(tx, demande.id, user.id);
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-ADJ-${demande.id}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBeCloseTo(5 * 700, 2); // (15-10) × prixAchat
      const ligneDebit = ecriture!.lignes.find((l) => Number(l.debit) > 0);
      expect(ligneDebit?.compte.numero.startsWith("31")).toBe(true); // surplus → débit compte stock
    });
  });
});

describe("CDC §78 — Test 9 : Sortie de stock", () => {
  it("valorise la sortie au prix d'achat (Dr variation stock / Cr stock)", async () => {
    await withRollback(async (tx) => {
      const pdv = await createTestPdv(tx);
      const user = await createTestUser(tx);
      const produit = await createTestProduit(tx, { prixAchat: 400 });

      const bon = await tx.bonSortie.create({
        data: {
          reference: `BS-${ref()}`, typeSortie: "CASSE", statut: "VALIDE", pointDeVenteId: pdv.id,
          motif: "Test sortie stock", creeParId: user.id, valideParId: user.id,
          lignes: { create: [{ produitId: produit.id, quantite: 3 }] },
        },
      });

      const ecritureId = await comptabiliserBonSortie(tx, bon.id, user.id);
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-BS-${bon.id}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBeCloseTo(3 * 400, 2);
      const ligneCredit = ecriture!.lignes.find((l) => Number(l.credit) > 0);
      expect(ligneCredit?.compte.numero.startsWith("31")).toBe(true); // stock décrémenté au crédit
    });
  });
});
