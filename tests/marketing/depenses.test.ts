import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { validerDepenseMarketing } from "@/lib/depenseMarketing";
import { creerEcritureDepenseMarketing } from "@/lib/ecritureDepenseMarketingServer";

// Fix 2026-08-10 : une dépense marketing ne doit être acceptée que si le
// budget de la campagne est Approuvé, et budgetId doit toujours être résolu
// côté serveur depuis campagneId (jamais envoyé par le formulaire) pour que
// BudgetMarketing.montantEngage s'incrémente réellement.
//
// N'utilise pas withRollback() : validerDepenseMarketing() lit via le
// PrismaClient global (pas un tx), donc les fixtures doivent être commitées
// pour être visibles — nettoyage manuel en `finally`.

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("Dépenses marketing — validation du budget", () => {
  it("refuse tant que le budget n'est pas Approuvé, puis accepte et incrémente montantEngage", async () => {
    const s = suffixeUnique();
    const user = await prisma.user.create({
      data: { nom: "Test", prenom: "Marketing", email: `mkt-test-${s}@afriges.test`, role: "ADMIN" },
    });
    const typeCampagne = await prisma.typeCampagne.create({
      data: { code: `TYPE-TEST-${s}`, libelle: "Type test" },
    });
    const campagne = await prisma.campagne.create({
      data: {
        code: `CAMP-TEST-${s}`,
        nom: `Campagne test ${s}`,
        responsable: { connect: { id: user.id } },
        typeCampagne: { connect: { id: typeCampagne.id } },
        creePar: { connect: { id: user.id } },
        dateDebut: new Date(),
        dateFin: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    const budget = await prisma.budgetMarketing.create({
      data: { campagne: { connect: { id: campagne.id } }, montantPrevu: 100_000 }, // statut BROUILLON par défaut
    });

    try {
      // 1. Budget encore Brouillon → refusé, avec un message explicite.
      const refusBrouillon = await validerDepenseMarketing({ campagneId: campagne.id, categorie: "PUBLICITE", montant: 5000 });
      expect("error" in refusBrouillon).toBe(true);
      if ("error" in refusBrouillon) {
        expect(refusBrouillon.status).toBe(409);
        expect(refusBrouillon.error).toMatch(/approuvé/i);
      }

      // 2. Direction approuve le budget.
      await prisma.budgetMarketing.update({ where: { id: budget.id }, data: { statut: "APPROUVE", montantApprouve: 100_000 } });

      // 3. Budget approuvé → accepté, budgetId résolu automatiquement depuis campagneId.
      const ok = await validerDepenseMarketing({ campagneId: campagne.id, categorie: "PUBLICITE", montant: 5000 });
      expect("data" in ok).toBe(true);
      if (!("data" in ok)) throw new Error("validerDepenseMarketing a renvoyé une erreur inattendue");
      expect(ok.data.budgetId).toBe(budget.id);

      // 4. Reproduit la transaction de POST /api/admin/marketing/depenses.
      await prisma.$transaction(async (tx) => {
        const d = await tx.depenseMarketing.create({ data: { ...ok.data, creeParId: user.id } });
        await tx.budgetMarketing.update({ where: { id: ok.data.budgetId }, data: { montantEngage: { increment: ok.data.montant } } });
        await creerEcritureDepenseMarketing(tx, d.id, user.id);
      });

      const budgetApres = await prisma.budgetMarketing.findUniqueOrThrow({ where: { id: budget.id } });
      expect(Number(budgetApres.montantEngage)).toBe(5000);

      // 5. Budget rejeté → de nouveau refusé (pas seulement "pas encore approuvé").
      await prisma.budgetMarketing.update({ where: { id: budget.id }, data: { statut: "REJETE" } });
      const refusRejete = await validerDepenseMarketing({ campagneId: campagne.id, categorie: "AUTRE", montant: 1000 });
      expect("error" in refusRejete).toBe(true);
    } finally {
      await prisma.depenseMarketing.deleteMany({ where: { campagneId: campagne.id } });
      await prisma.budgetMarketing.deleteMany({ where: { campagneId: campagne.id } });
      await prisma.campagne.delete({ where: { id: campagne.id } });
      await prisma.typeCampagne.delete({ where: { id: typeCampagne.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("refuse quand la campagne n'a aucun budget défini", async () => {
    const s = suffixeUnique();
    const user = await prisma.user.create({
      data: { nom: "Test", prenom: "Marketing", email: `mkt-test-${s}@afriges.test`, role: "ADMIN" },
    });
    const typeCampagne = await prisma.typeCampagne.create({
      data: { code: `TYPE-TEST-${s}`, libelle: "Type test" },
    });
    const campagne = await prisma.campagne.create({
      data: {
        code: `CAMP-TEST-${s}`,
        nom: `Campagne test ${s}`,
        responsable: { connect: { id: user.id } },
        typeCampagne: { connect: { id: typeCampagne.id } },
        creePar: { connect: { id: user.id } },
        dateDebut: new Date(),
        dateFin: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    try {
      const refus = await validerDepenseMarketing({ campagneId: campagne.id, categorie: "PUBLICITE", montant: 5000 });
      expect("error" in refus).toBe(true);
      if ("error" in refus) expect(refus.error).toMatch(/aucun budget/i);
    } finally {
      await prisma.campagne.delete({ where: { id: campagne.id } });
      await prisma.typeCampagne.delete({ where: { id: typeCampagne.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
