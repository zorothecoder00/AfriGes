import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestUser, createTestFournisseur, createTestClient } from "../helpers/fixtures";
import { ecripturePaiementFournisseur, ecritureRemboursementCreditConfirme, creerEcriture } from "@/lib/comptabilite/moteur";
import { proposerRapprochements, confirmerRapprochement } from "@/lib/comptabilite/rapprochementImport";

function ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("CDC §78 — Test 5 : Paiement fournisseur", () => {
  it("solde la dette fournisseur (401xxx) en contrepartie de la trésorerie", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const fournisseur = await createTestFournisseur(tx);
      const reference = `PAY-${ref()}`;

      const ecritureId = await ecripturePaiementFournisseur(tx, {
        montant: 3000, reference, fournisseurNom: fournisseur.nom, fournisseurId: fournisseur.id,
        modePaiement: "ESPECES", userId: user.id,
      });
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-PAF-${reference}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      const ligneDebit = ecriture!.lignes.find((l) => Number(l.debit) > 0);
      expect(ligneDebit?.compte.numero.startsWith("401")).toBe(true);
    });
  });
});

describe("CDC §78 — Test 6 : Encaissement client", () => {
  it("débite la trésorerie et solde la créance client (411xxx)", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const client = await createTestClient(tx);
      const reference = `ENC-${ref()}`;

      const ecritureId = await ecritureRemboursementCreditConfirme(tx, {
        montant: 1500, reference, clientNom: `${client.prenom} ${client.nom}`, clientId: client.id,
        modePaiement: "ESPECES", userId: user.id,
      });
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-RBT-${reference}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      const ligneCredit = ecriture!.lignes.find((l) => Number(l.credit) > 0);
      expect(ligneCredit?.compte.numero.startsWith("411")).toBe(true);
      expect(ligneCredit?.compte.clientId).toBe(client.id);
    });
  });
});

describe("CDC §78 — Test 12 : Rapprochement bancaire", () => {
  it("propose puis confirme une correspondance ligne de relevé ↔ ligne d'écriture", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const dateEcriture = new Date(2025, 5, 20);

      const ecritureId = await creerEcriture(tx, {
        journal: "BANQUE",
        date: dateEcriture,
        libelle: "Virement reçu — test rapprochement",
        userId: user.id,
        statut: "VALIDE",
        lignes: [
          { numero: "521", debit: 10000, libelle: "Virement reçu" },
          { numero: "701", credit: 10000, libelle: "Virement reçu" },
        ],
      });
      expect(ecritureId).not.toBeNull();
      const ligneBanque = await tx.ligneEcriture.findFirst({
        where: { ecritureId: ecritureId!, compte: { numero: "521" } },
      });
      expect(ligneBanque).toBeTruthy();

      const ligneReleve = await tx.ligneReleveBancaire.create({
        data: {
          compteNumero: "521", date: dateEcriture, libelle: "VIR RECU TEST",
          credit: 10000, importeParId: user.id,
        },
      });

      const propositions = await proposerRapprochements(tx, "521");
      const proposition = propositions.find((p) => p.ligneReleveId === ligneReleve.id);
      expect(proposition).toBeTruthy();
      expect(proposition!.ligneEcritureId).toBe(ligneBanque!.id);

      await confirmerRapprochement(tx, ligneReleve.id, ligneBanque!.id);
      const ligneReleveMaj = await tx.ligneReleveBancaire.findUnique({ where: { id: ligneReleve.id } });
      expect(ligneReleveMaj?.statut).toBe("RAPPROCHE");
      expect(ligneReleveMaj?.ligneEcritureId).toBe(ligneBanque!.id);
    });
  });
});
