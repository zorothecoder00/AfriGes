import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestUser, createTestClient, createTestFournisseur, createTestPdv } from "../helpers/fixtures";
import { creerEcriture, contrepasserEcriture, ecritureAvoirClient, ecritureAvoirFournisseur } from "@/lib/comptabilite/moteur";
import { genererBalanceGenerale } from "@/lib/comptabilite/grandLivreBalance";
import { genererBilan, genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";

describe("CDC §78 — Test 17 : Contrepassation", () => {
  it("génère l'écriture inverse sans jamais modifier l'originale", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const ecritureId = await creerEcriture(tx, {
        journal: "OD", date: new Date(2025, 5, 1), libelle: "Écriture à contrepasser", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "601", debit: 200 }, { numero: "401", credit: 200 }],
      });
      expect(ecritureId).not.toBeNull();

      const nouvelleId = await contrepasserEcriture(tx, ecritureId!, user.id);
      const originale = await tx.ecritureComptable.findUnique({ where: { id: ecritureId! }, include: { lignes: true } });
      const contrepassee = await tx.ecritureComptable.findUnique({ where: { id: nouvelleId }, include: { lignes: true } });

      expect(originale?.statut).toBe("VALIDE"); // jamais modifiée
      expect(contrepassee?.reference).toBe(`CP-${originale?.reference}`);
      // Débit/crédit permutés par rapport à l'originale.
      expect(Number(contrepassee!.lignes[0].debit)).toBeCloseTo(Number(originale!.lignes[0].credit), 2);
      expect(Number(contrepassee!.lignes[0].credit)).toBeCloseTo(Number(originale!.lignes[0].debit), 2);
    });
  });
});

describe("CDC §78 — Test 18 : Annulation (avoir client/fournisseur)", () => {
  it("génère un avoir équilibré, inverse d'une vente ou d'un achat", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const client = await createTestClient(tx);
      const fournisseur = await createTestFournisseur(tx);

      const avoirClientId = await ecritureAvoirClient(tx, {
        montant: 300, reference: `AVR-${Date.now()}`, clientNom: client.nom, clientId: client.id, userId: user.id,
      });
      expect(avoirClientId).not.toBeNull();
      const ecritureAvoirClientRow = await tx.ecritureComptable.findUnique({ where: { id: avoirClientId! }, include: { lignes: true } });
      const dC = ecritureAvoirClientRow!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const cC = ecritureAvoirClientRow!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(dC).toBeCloseTo(cC, 2);

      const avoirFournisseurId = await ecritureAvoirFournisseur(tx, {
        montant: 250, reference: `AVF-${Date.now()}`, fournisseurNom: fournisseur.nom, fournisseurId: fournisseur.id, userId: user.id,
      });
      expect(avoirFournisseurId).not.toBeNull();
      const ecritureAvoirFournisseurRow = await tx.ecritureComptable.findUnique({ where: { id: avoirFournisseurId! }, include: { lignes: true } });
      const dF = ecritureAvoirFournisseurRow!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const cF = ecritureAvoirFournisseurRow!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(dF).toBeCloseTo(cF, 2);
    });
  });
});

describe("CDC §78 — Test 19 : Multi-agence", () => {
  it("chaque ligne conserve son propre PDV, et la balance filtre correctement par PDV", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const pdv1 = await createTestPdv(tx);
      const pdv2 = await createTestPdv(tx);

      await creerEcriture(tx, {
        journal: "VENTES", date: new Date(2025, 5, 5), libelle: "Vente PDV1", userId: user.id, statut: "VALIDE",
        lignes: [
          { numero: "571", debit: 1000, pointDeVenteId: pdv1.id },
          { numero: "701", credit: 1000, pointDeVenteId: pdv1.id },
        ],
      });
      await creerEcriture(tx, {
        journal: "VENTES", date: new Date(2025, 5, 5), libelle: "Vente PDV2", userId: user.id, statut: "VALIDE",
        lignes: [
          { numero: "571", debit: 2000, pointDeVenteId: pdv2.id },
          { numero: "701", credit: 2000, pointDeVenteId: pdv2.id },
        ],
      });

      const balancePdv1 = await genererBalanceGenerale(tx, {
        dateDebut: new Date(2025, 5, 1), dateFin: new Date(2025, 5, 30), pointDeVenteId: pdv1.id,
      });
      const ligne701Pdv1 = balancePdv1.find((l) => l.numero === "701");
      expect(ligne701Pdv1?.soldeFinalCrediteur).toBeCloseTo(1000, 2); // seul le PDV1, pas les 3000 cumulés

      const balancePdv2 = await genererBalanceGenerale(tx, {
        dateDebut: new Date(2025, 5, 1), dateFin: new Date(2025, 5, 30), pointDeVenteId: pdv2.id,
      });
      const ligne701Pdv2 = balancePdv2.find((l) => l.numero === "701");
      expect(ligne701Pdv2?.soldeFinalCrediteur).toBeCloseTo(2000, 2);
    });
  });
});

describe("CDC §78 — Test 20 : Génération du bilan", () => {
  it("le bilan s'équilibre toujours (actif = passif)", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await creerEcriture(tx, {
        journal: "OD", date: new Date(2025, 5, 1), libelle: "Apport test bilan", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "571", debit: 10000 }, { numero: "101", credit: 10000 }],
      });

      const bilan = await genererBilan(tx, new Date(2025, 5, 30));
      expect(bilan.totalActif).toBeCloseTo(bilan.totalPassif, 2);
      expect(bilan.equilibre).toBe(true);
    });
  });
});

describe("CDC §78 — Test 21 : Génération du compte de résultat", () => {
  it("résultat net = produits - charges de la période", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await creerEcriture(tx, {
        journal: "VENTES", date: new Date(2025, 5, 1), libelle: "Produit test résultat", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "571", debit: 3000 }, { numero: "701", credit: 3000 }],
      });
      await creerEcriture(tx, {
        journal: "OD", date: new Date(2025, 5, 2), libelle: "Charge test résultat", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "601", debit: 1200 }, { numero: "401", credit: 1200 }],
      });

      const cr = await genererCompteResultat(tx, new Date(2025, 5, 1), new Date(2025, 5, 30));
      expect(cr.totalProduits).toBeCloseTo(3000, 2);
      expect(cr.totalCharges).toBeCloseTo(1200, 2);
      expect(cr.resultatNet).toBeCloseTo(1800, 2);
    });
  });
});

describe("CDC §78 — Test 22 : Contrôle débit/crédit", () => {
  it("rejette toute écriture déséquilibrée", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await expect(
        creerEcriture(tx, {
          journal: "OD", date: new Date(2025, 5, 1), libelle: "Écriture déséquilibrée", userId: user.id,
          lignes: [{ numero: "601", debit: 100 }, { numero: "401", credit: 90 }],
        }),
      ).rejects.toThrow(/non équilibrée/);
    });
  });
});
