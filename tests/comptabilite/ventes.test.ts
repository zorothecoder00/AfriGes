import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestPdv, createTestUser, createTestProduit, createTestClient } from "../helpers/fixtures";
import { creerEcritureVenteDepuisVenteDirecte, creerEcritureCogsVenteDirecte } from "@/lib/ecritureVenteServer";
import { ecritureVenteCreditValidee } from "@/lib/comptabilite/moteur";

describe("CDC §78 — Test 1 : Vente comptant", () => {
  it("génère l'écriture de vente comptant + le COGS, tous deux équilibrés", async () => {
    await withRollback(async (tx) => {
      const pdv = await createTestPdv(tx);
      const user = await createTestUser(tx);
      const produit = await createTestProduit(tx, { prixUnitaire: 1000, prixAchat: 600 });

      const vente = await tx.venteDirecte.create({
        data: {
          reference: `VD-TEST-${vente_ref()}`,
          statut: "PAID",
          pointDeVenteId: pdv.id,
          vendeurId: user.id,
          modePaiement: "ESPECES",
          montantTotal: 2000,
          montantPaye: 2000,
          lignes: { create: [{ produitId: produit.id, quantite: 2, prixUnitaire: 1000, montant: 2000 }] },
        },
      });

      await creerEcritureVenteDepuisVenteDirecte(tx, vente.id, user.id);
      const ecritureVente = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-VD-${vente.id}` },
        include: { lignes: true },
      });
      expect(ecritureVente).toBeTruthy();
      const totalDebit = ecritureVente!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecritureVente!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBeCloseTo(2000, 2);

      await creerEcritureCogsVenteDirecte(tx, vente.id, user.id);
      const ecritureCogs = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-COGS-${vente.id}` },
        include: { lignes: true },
      });
      expect(ecritureCogs).toBeTruthy();
      const cogsDebit = ecritureCogs!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const cogsCredit = ecritureCogs!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(cogsDebit).toBeCloseTo(cogsCredit, 2);
      expect(cogsDebit).toBeCloseTo(2 * 600, 2); // quantité × prixAchat
    });
  });
});

describe("CDC §78 — Test 2 : Vente à crédit", () => {
  it("génère une écriture équilibrée avec la créance imputée au sous-compte auxiliaire du client", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const client = await createTestClient(tx);
      const reference = `CRD-TEST-${vente_ref()}`;

      const ecritureId = await ecritureVenteCreditValidee(tx, {
        montant: 5000,
        reference,
        clientNom: `${client.prenom} ${client.nom}`,
        clientId: client.id,
        userId: user.id,
        date: new Date(2025, 5, 10),
      });
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-CRD-${reference}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      expect(totalDebit).toBeCloseTo(5000, 2);

      // La créance doit être imputée à un sous-compte auxiliaire 411xxx du client, pas au collectif 411.
      const ligneCreance = ecriture!.lignes.find((l) => Number(l.debit) > 0);
      expect(ligneCreance?.compte.numero.startsWith("411")).toBe(true);
      expect(ligneCreance?.compte.clientId).toBe(client.id);
    });
  });
});

function vente_ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}
