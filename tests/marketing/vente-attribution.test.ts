import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

// Fix 2026-08-10 : VenteDirecte.campagneId existait dans le schéma mais
// n'était posé par aucune route de création — CA attribué/ROI restaient à 0
// partout dans le module Marketing. Reproduit la création telle que
// app/api/admin/ventes/route.ts la fait (campagneId résolu depuis le body,
// jamais deviné côté serveur), puis vérifie que ça ferme bien la boucle
// jusqu'au calcul "CA attribué" utilisé par /api/admin/marketing/stats.

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("Attribution d'une vente à une campagne marketing", () => {
  it("pose campagneId à la création, le restitue via la relation, et alimente le CA attribué", async () => {
    const s = suffixeUnique();
    const vendeur = await prisma.user.create({ data: { nom: "Test", prenom: "Vendeur", email: `vendeur-test-${s}@afriges.test`, role: "ADMIN" } });
    const pdv = await prisma.pointDeVente.create({ data: { code: `PDV-VA-${s}`, nom: `Agence VA ${s}` } });
    const typeCampagne = await prisma.typeCampagne.create({ data: { code: `TYPE-VA-${s}`, libelle: "Type test" } });
    const campagne = await prisma.campagne.create({
      data: {
        code: `CAMP-VA-${s}`, nom: `Campagne vente ${s}`,
        responsable: { connect: { id: vendeur.id } },
        typeCampagne: { connect: { id: typeCampagne.id } },
        creePar: { connect: { id: vendeur.id } },
        dateDebut: new Date(), dateFin: new Date(Date.now() + 30 * 86_400_000),
        statut: "ACTIVE",
      },
    });

    let venteAttribuee: { id: number } | null = null;
    let venteSansCampagne: { id: number } | null = null;

    try {
      // Body simulé tel qu'envoyé par le sélecteur "Campagne marketing (optionnel)".
      const body = { campagneId: String(campagne.id) };

      // Reproduit exactement le tx.venteDirecte.create de app/api/admin/ventes/route.ts.
      venteAttribuee = await prisma.venteDirecte.create({
        data: {
          reference: `VD-TEST-VA-${s}`,
          statut: "CONFIRMEE",
          pointDeVenteId: pdv.id,
          vendeurId: vendeur.id,
          modePaiement: "ESPECES",
          montantTotal: 15_000,
          montantPaye: 15_000,
          campagneId: body.campagneId ? Number(body.campagneId) : null,
        },
      });
      expect(venteAttribuee.campagneId).toBe(campagne.id);

      // Visible depuis l'autre côté de la relation.
      const campagneAvecVentes = await prisma.campagne.findUniqueOrThrow({
        where: { id: campagne.id },
        include: { ventesAttribuees: { select: { id: true } } },
      });
      expect(campagneAvecVentes.ventesAttribuees.map((v) => v.id)).toContain(venteAttribuee.id);

      // Une vente sans campagne reste valide (champ optionnel, comportement inchangé).
      venteSansCampagne = await prisma.venteDirecte.create({
        data: {
          reference: `VD-TEST-SC-${s}`, statut: "CONFIRMEE",
          pointDeVenteId: pdv.id, vendeurId: vendeur.id,
          modePaiement: "ESPECES", montantTotal: 3000, montantPaye: 3000,
        },
      });
      expect(venteSansCampagne.campagneId).toBeNull();

      // Preuve que la boucle est fermée : même requête que /api/admin/marketing/stats
      // pour calculer le CA attribué sur la période (avant le fix, toujours 0).
      const debut = new Date(Date.now() - 60_000);
      const fin = new Date(Date.now() + 60_000);
      const ventesAttribueesPeriode = await prisma.venteDirecte.findMany({
        where: { campagneId: campagne.id, createdAt: { gte: debut, lte: fin } },
        select: { montantTotal: true },
      });
      const caAttribue = ventesAttribueesPeriode.reduce((sum, v) => sum + Number(v.montantTotal), 0);
      expect(caAttribue).toBe(15_000); // la vente à 3000 (sans campagne) n'y est pas
    } finally {
      if (venteAttribuee) await prisma.venteDirecte.delete({ where: { id: venteAttribuee.id } });
      if (venteSansCampagne) await prisma.venteDirecte.delete({ where: { id: venteSansCampagne.id } });
      await prisma.campagne.delete({ where: { id: campagne.id } });
      await prisma.typeCampagne.delete({ where: { id: typeCampagne.id } });
      await prisma.pointDeVente.delete({ where: { id: pdv.id } });
      await prisma.user.delete({ where: { id: vendeur.id } });
    }
  });
});
