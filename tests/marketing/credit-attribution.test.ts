import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

// Fix 2026-08-10 : CreditClient.campagneId existait dans le schéma mais
// n'était posé par aucune route de création (admin/RVC/agent terrain) — même
// trou que VenteDirecte.campagneId. Reproduit la création telle que
// app/api/admin/credits/route.ts la fait (campagneId résolu depuis le body),
// puis vérifie que ça ferme bien la boucle jusqu'au calcul "CA attribué".

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("Attribution d'un crédit à une campagne marketing", () => {
  it("pose campagneId à la création, le restitue via la relation, et alimente le CA attribué", async () => {
    const s = suffixeUnique();
    const agent = await prisma.user.create({ data: { nom: "Test", prenom: "RVC", email: `rvc-test-${s}@afriges.test`, role: "ADMIN" } });
    const client = await prisma.client.create({ data: { nom: "Client", prenom: "Test", telephone: `+228${s}`.slice(0, 15) } });
    const typeCampagne = await prisma.typeCampagne.create({ data: { code: `TYPE-CA-${s}`, libelle: "Type test" } });
    const campagne = await prisma.campagne.create({
      data: {
        code: `CAMP-CA-${s}`, nom: `Campagne crédit ${s}`,
        responsable: { connect: { id: agent.id } },
        typeCampagne: { connect: { id: typeCampagne.id } },
        creePar: { connect: { id: agent.id } },
        dateDebut: new Date(), dateFin: new Date(Date.now() + 30 * 86_400_000),
        statut: "ACTIVE",
      },
    });

    let creditAttribue: { id: number; campagneId: number | null } | null = null;
    let creditSansCampagne: { id: number; campagneId: number | null } | null = null;

    try {
      const debut = new Date();
      const echeanceFin = new Date(Date.now() + 31 * 86_400_000);

      // Body simulé tel qu'envoyé par le sélecteur "Campagne marketing (optionnel)".
      const body = { campagneId: String(campagne.id) };

      // Reproduit exactement le tx.creditClient.create de app/api/admin/credits/route.ts.
      creditAttribue = await prisma.creditClient.create({
        data: {
          reference: `CRD-TEST-CA-${s}`,
          clientId: client.id,
          statut: "EN_ATTENTE_VALIDATION",
          formule: "TRENTAINE",
          montantTotal: 31_000,
          soldeRestant: 31_000,
          dureeJours: 31,
          dateDebut: debut,
          dateEcheanceFin: echeanceFin,
          montantJournalier: 1000,
          creeParId: agent.id,
          campagneId: body.campagneId ? Number(body.campagneId) : null,
        },
      });
      expect(creditAttribue.campagneId).toBe(campagne.id);

      // Visible depuis l'autre côté de la relation.
      const campagneAvecCredits = await prisma.campagne.findUniqueOrThrow({
        where: { id: campagne.id },
        include: { creditsAttribues: { select: { id: true } } },
      });
      expect(campagneAvecCredits.creditsAttribues.map((c) => c.id)).toContain(creditAttribue.id);

      // Un crédit sans campagne reste valide (champ optionnel, comportement inchangé).
      creditSansCampagne = await prisma.creditClient.create({
        data: {
          reference: `CRD-TEST-SC-${s}`, clientId: client.id, statut: "EN_ATTENTE_VALIDATION",
          formule: "QUINZAINE", montantTotal: 8000, soldeRestant: 8000,
          dureeJours: 16, dateDebut: debut, dateEcheanceFin: new Date(Date.now() + 16 * 86_400_000),
          montantJournalier: 500, creeParId: agent.id,
        },
      });
      expect(creditSansCampagne.campagneId).toBeNull();

      // Preuve que la boucle est fermée : même requête que /api/admin/marketing/stats
      // pour calculer le CA attribué (crédits) sur la période.
      const fenetreDebut = new Date(Date.now() - 60_000);
      const fenetreFin = new Date(Date.now() + 60_000);
      const creditsAttribuesPeriode = await prisma.creditClient.findMany({
        where: { campagneId: campagne.id, createdAt: { gte: fenetreDebut, lte: fenetreFin } },
        select: { montantTotal: true },
      });
      const caAttribue = creditsAttribuesPeriode.reduce((sum, c) => sum + Number(c.montantTotal), 0);
      expect(caAttribue).toBe(31_000); // le crédit à 8000 (sans campagne) n'y est pas
    } finally {
      if (creditAttribue) await prisma.creditClient.delete({ where: { id: creditAttribue.id } });
      if (creditSansCampagne) await prisma.creditClient.delete({ where: { id: creditSansCampagne.id } });
      await prisma.campagne.delete({ where: { id: campagne.id } });
      await prisma.typeCampagne.delete({ where: { id: typeCampagne.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.user.delete({ where: { id: agent.id } });
    }
  });
});
