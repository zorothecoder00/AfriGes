import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

// Fix 2026-08-10 : ajout du champ SouscriptionPack.campagneId (migration
// marketing_attribution_souscription_pack) pour permettre l'attribution
// manuelle d'une souscription pack à une campagne marketing, au même titre
// que VenteDirecte.campagneId et CreditClient.campagneId (déjà existants).

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("SouscriptionPack.campagneId", () => {
  it("accepte et restitue une campagne attribuée via la relation", async () => {
    const s = suffixeUnique();
    const user = await prisma.user.create({ data: { nom: "Test", prenom: "Marketing", email: `mkt-souscr-${s}@afriges.test`, role: "ADMIN" } });
    const typeCampagne = await prisma.typeCampagne.create({ data: { code: `TYPE-SOUSCR-${s}`, libelle: "Type test" } });
    const campagne = await prisma.campagne.create({
      data: {
        code: `CAMP-SOUSCR-${s}`, nom: `Campagne souscription ${s}`,
        responsable: { connect: { id: user.id } },
        typeCampagne: { connect: { id: typeCampagne.id } },
        creePar: { connect: { id: user.id } },
        dateDebut: new Date(), dateFin: new Date(Date.now() + 30 * 86_400_000),
        statut: "ACTIVE",
      },
    });
    const client = await prisma.client.create({ data: { nom: "Client", prenom: "Test", telephone: `+228${s}`.slice(0, 15) } });
    const pack = await prisma.pack.create({ data: { nom: `Pack test ${s}`, type: "ALIMENTAIRE" } });

    try {
      // Exactement le pattern des 3 routes de souscription (admin/caissier/agentTerrain) :
      // campagneId résolu depuis le body, jamais deviné côté serveur.
      const souscription = await prisma.souscriptionPack.create({
        data: {
          pack: { connect: { id: pack.id } },
          client: { connect: { id: client.id } },
          statut: "EN_ATTENTE",
          montantTotal: 10_000,
          montantRestant: 10_000,
          campagne: { connect: { id: campagne.id } },
        },
      });
      expect(souscription.campagneId).toBe(campagne.id);

      // Visible depuis l'autre côté de la relation (Campagne.souscriptionsAttribuees), même mécanique que ventesAttribuees.
      const campagneAvecSouscriptions = await prisma.campagne.findUniqueOrThrow({
        where: { id: campagne.id },
        include: { souscriptionsAttribuees: { select: { id: true } } },
      });
      expect(campagneAvecSouscriptions.souscriptionsAttribuees.map((sp) => sp.id)).toContain(souscription.id);

      // Optionnelle : une souscription sans campagne reste valide (campagneId nullable).
      const souscriptionSansCampagne = await prisma.souscriptionPack.create({
        data: { pack: { connect: { id: pack.id } }, client: { connect: { id: client.id } }, statut: "EN_ATTENTE", montantTotal: 5000, montantRestant: 5000 },
      });
      expect(souscriptionSansCampagne.campagneId).toBeNull();

      await prisma.souscriptionPack.deleteMany({ where: { id: { in: [souscription.id, souscriptionSansCampagne.id] } } });
    } finally {
      await prisma.souscriptionPack.deleteMany({ where: { clientId: client.id } });
      await prisma.pack.delete({ where: { id: pack.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.campagne.delete({ where: { id: campagne.id } });
      await prisma.typeCampagne.delete({ where: { id: typeCampagne.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
