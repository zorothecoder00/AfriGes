import { describe, it, expect } from "vitest";
import { withRollback } from "../helpers/rollback";
import { createTestUser } from "../helpers/fixtures";
import { ecritureAcquisitionImmobilisation, genererDotationPeriode } from "@/lib/comptabilite/immobilisations";

function ref(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("CDC §78 — Test 10 : Acquisition immobilisation", () => {
  it("Dr compte immobilisation / Cr trésorerie ou fournisseur selon le mode de paiement", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const reference = `IMMO-${ref()}`;

      const ecritureId = await ecritureAcquisitionImmobilisation(tx, {
        montant: 500000, compteNumero: "244", designation: "Matériel de test", reference,
        modePaiement: "VIREMENT", userId: user.id, date: new Date(2025, 5, 1),
      });
      expect(ecritureId).not.toBeNull();

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-IMMO-ACQ-${reference}` },
        include: { lignes: { include: { compte: true } } },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
      const ligneDebit = ecriture!.lignes.find((l) => Number(l.debit) > 0);
      expect(ligneDebit?.compte.numero).toBe("244");
      const ligneCredit = ecriture!.lignes.find((l) => Number(l.credit) > 0);
      expect(ligneCredit?.compte.numero).toBe("521"); // VIREMENT → banque, pas trésorerie caisse
    });
  });
});

describe("CDC §78 — Test 11 : Amortissement", () => {
  it("génère la dotation mensuelle linéaire et met à jour le cumul/VNC", async () => {
    await withRollback(async (tx) => {
      const user = await createTestUser(tx);
      const compte244 = await tx.compteComptable.findUniqueOrThrow({ where: { numero: "244" } });
      const compte2844 = await tx.compteComptable.findUniqueOrThrow({ where: { numero: "2844" } });

      const immo = await tx.immobilisation.create({
        data: {
          numeroInventaire: `INV-${ref()}`, designation: "Matériel test amortissement", categorie: "MATERIEL_MOBILIER",
          compte: { connect: { id: compte244.id } },
          compteAmortissement: { connect: { id: compte2844.id } },
          createur: { connect: { id: user.id } },
          dateAcquisition: new Date(2025, 0, 1), dateMiseEnService: new Date(2025, 0, 1),
          coutAcquisition: 1_200_000, dureeAnnees: 5, valeurNetteComptable: 1_200_000,
        },
      });

      const resultat = await genererDotationPeriode(tx, immo.id, 2025, 1, user.id);
      expect(resultat.created).toBe(true);
      expect(resultat.montant).toBeCloseTo(1_200_000 / (5 * 12), 2);

      const ecriture = await tx.ecritureComptable.findUnique({
        where: { reference: `SYNC-IMMO-DOT-${immo.id}-2025-01` },
        include: { lignes: true },
      });
      expect(ecriture).toBeTruthy();
      const totalDebit = ecriture!.lignes.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = ecriture!.lignes.reduce((s, l) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);

      const immoMaj = await tx.immobilisation.findUnique({ where: { id: immo.id } });
      expect(Number(immoMaj?.amortissementCumule)).toBeCloseTo(resultat.montant, 2);

      // Idempotence : un second appel sur la même période ne recrée rien.
      const resultat2 = await genererDotationPeriode(tx, immo.id, 2025, 1, user.id);
      expect(resultat2.created).toBe(false);
    });
  });
});
