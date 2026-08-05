import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestUser } from "../helpers/fixtures";
import { creerRegularisation, comptabiliserEcheance } from "@/lib/comptabilite/regularisationsAvance";
import { creerEcriture, periodeClôturée } from "@/lib/comptabilite/moteur";
import { cloturerExercice } from "@/lib/comptabilite/exercice";

describe("CDC §78 — Test 13 : Écriture de régularisation (CCA)", () => {
  it("constate la charge d'avance puis comptabilise l'échéance du premier mois", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);

      const regul = await creerRegularisation(tx, {
        libelle: "Assurance annuelle test",
        type: "CHARGE_CONSTATEE_AVANCE",
        compteChargeOuProduitNumero: "616",
        compteRegularisationNumero: "4786",
        montantTotal: 1200,
        dateDebut: new Date(2025, 0, 1),
        dateFin: new Date(2025, 2, 31),
      }, user.id);
      expect(regul.ecritureConstatationId).not.toBeNull();

      const echeances = await tx.echeanceRegularisation.findMany({ where: { regularisationId: regul.id }, orderBy: { periode: "asc" } });
      expect(echeances).toHaveLength(3);
      expect(echeances.reduce((s, e) => s + Number(e.montant), 0)).toBeCloseTo(1200, 2);

      const { ecritureId } = await comptabiliserEcheance(tx, echeances[0].id, user.id);
      expect(ecritureId).not.toBeNull();
      const echeance0Maj = await tx.echeanceRegularisation.findUnique({ where: { id: echeances[0].id } });
      expect(echeance0Maj?.comptabilise).toBe(true);
    });
  });
});

describe("CDC §78 — Test 14 : Clôture mensuelle", () => {
  it("verrouille le mois — plus aucune écriture n'y est acceptée sans dérogation", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await tx.clotureComptable.create({ data: { annee: 2025, mois: 3, cloturePar: user.id } });

      expect(await periodeClôturée(tx, new Date(2025, 2, 15))).toBe(true);

      const ecritureId = await creerEcriture(tx, {
        journal: "OD",
        date: new Date(2025, 2, 15),
        libelle: "Écriture refusée — période clôturée",
        userId: user.id,
        lignes: [
          { numero: "601", debit: 100 },
          { numero: "401", credit: 100 },
        ],
      });
      expect(ecritureId).toBeNull();
    });
  });
});

describe("CDC §78 — Test 15 : Clôture annuelle", () => {
  it("solde les comptes de charges/produits vers 131/132 et verrouille les 12 mois", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await creerEcriture(tx, {
        journal: "OD", date: new Date(2025, 5, 1), libelle: "Charge test clôture", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "601", debit: 500 }, { numero: "401", credit: 500 }],
      });

      const resultat = await cloturerExercice(tx, 2025, user.id);
      expect(resultat.controlesBloquants).toHaveLength(0);
      expect(resultat.resultatNet).toBeCloseTo(-500, 2);
      expect(resultat.ecritureClotureId).not.toBeNull();

      const ecritureCloture = await tx.ecritureComptable.findUnique({ where: { reference: "SYNC-CLOTURE-2025" }, include: { lignes: true } });
      expect(ecritureCloture).toBeTruthy();
      const totalDebit = ecritureCloture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecritureCloture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);

      const exerciceMaj = await tx.exerciceComptable.findUnique({ where: { annee: 2025 } });
      expect(exerciceMaj?.statut).toBe("CLOTURE");
      const clotures = await tx.clotureComptable.count({ where: { annee: 2025 } });
      expect(clotures).toBe(12);
    });
  });
});

describe("CDC §78 — Test 16 : Report à nouveau", () => {
  it("reporte intégralement le résultat net vers 110 (bénéfice) ou 119 (perte)", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      await creerEcriture(tx, {
        journal: "OD", date: new Date(2025, 5, 1), libelle: "Produit test report à nouveau", userId: user.id, statut: "VALIDE",
        lignes: [{ numero: "521", debit: 800 }, { numero: "701", credit: 800 }],
      });

      const resultat = await cloturerExercice(tx, 2025, user.id);
      expect(resultat.resultatNet).toBeCloseTo(800, 2);
      expect(resultat.ecritureReportId).not.toBeNull();

      const ecritureReport = await tx.ecritureComptable.findUnique({ where: { reference: "SYNC-REPORT-2025" }, include: { lignes: { include: { compte: true } } } });
      expect(ecritureReport).toBeTruthy();
      const totalDebit = ecritureReport!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecritureReport!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      // Bénéfice (résultat > 0) → Dr 131 / Cr 110 (report à nouveau créditeur).
      expect(ecritureReport!.lignes.some((l) => l.compte.numero === "110" && Number(l.credit) > 0)).toBe(true);
    });
  });
});
