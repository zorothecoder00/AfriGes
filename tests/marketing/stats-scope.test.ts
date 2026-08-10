import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { resoudrePdvIdsAutorises } from "@/lib/marketingAgenceScope";

// Fix 2026-08-10 : le comparatif par agence (/api/admin/marketing/stats,
// Animation des agences) était visible sur tout le réseau pour Chef Agence
// et Responsable Point de Vente, alors que proxy.ts documente explicitement
// leur accès en double casquette comme scopé à "leur(s) agence(s)".

function suffixeUnique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
}

describe("resoudrePdvIdsAutorises", () => {
  it("ne restreint pas les profils marketing globaux (null = tout le réseau)", async () => {
    expect(await resoudrePdvIdsAutorises({ user: { id: 1, gestionnaireRole: "RESPONSABLE_MARKETING" } })).toBeNull();
    expect(await resoudrePdvIdsAutorises({ user: { id: 1, gestionnaireRole: "DIRECTEUR_MARKETING" } })).toBeNull();
    expect(await resoudrePdvIdsAutorises({ user: { id: 1, gestionnaireRole: "DIRECTEUR_GENERAL" } })).toBeNull();
    expect(await resoudrePdvIdsAutorises({ user: { id: 1, gestionnaireRole: null } })).toBeNull(); // Admin/Super Admin (pas de gestionnaireRole)
  });

  it("restreint un Responsable Point de Vente à son unique PDV (rpvId)", async () => {
    const s = suffixeUnique();
    const rpv = await prisma.user.create({ data: { nom: "Test", prenom: "RPV", email: `rpv-test-${s}@afriges.test`, role: "USER" } });
    const pdvA = await prisma.pointDeVente.create({ data: { code: `PDVA-${s}`, nom: `Agence A ${s}`, rpv: { connect: { id: rpv.id } } } });
    const pdvB = await prisma.pointDeVente.create({ data: { code: `PDVB-${s}`, nom: `Agence B ${s}` } }); // pas le sien

    try {
      const ids = await resoudrePdvIdsAutorises({ user: { id: rpv.id, gestionnaireRole: "RESPONSABLE_POINT_DE_VENTE" } });
      expect(ids).toEqual([pdvA.id]);
      expect(ids).not.toContain(pdvB.id);
    } finally {
      await prisma.pointDeVente.delete({ where: { id: pdvA.id } });
      await prisma.pointDeVente.delete({ where: { id: pdvB.id } });
      await prisma.user.delete({ where: { id: rpv.id } });
    }
  });

  it("renvoie [] pour un RPV sans PDV rattaché (pas null — ne doit rien voir)", async () => {
    const s = suffixeUnique();
    const rpv = await prisma.user.create({ data: { nom: "Test", prenom: "RPV", email: `rpv-orphan-${s}@afriges.test`, role: "USER" } });
    try {
      const ids = await resoudrePdvIdsAutorises({ user: { id: rpv.id, gestionnaireRole: "RESPONSABLE_POINT_DE_VENTE" } });
      expect(ids).toEqual([]);
    } finally {
      await prisma.user.delete({ where: { id: rpv.id } });
    }
  });

  it("restreint un Chef Agence à toutes ses agences supervisées (chefAgenceId, plusieurs possibles)", async () => {
    const s = suffixeUnique();
    const chef = await prisma.user.create({ data: { nom: "Test", prenom: "Chef", email: `chef-test-${s}@afriges.test`, role: "USER" } });
    const autre = await prisma.user.create({ data: { nom: "Test", prenom: "AutreChef", email: `chef-autre-${s}@afriges.test`, role: "USER" } });
    const pdvA = await prisma.pointDeVente.create({ data: { code: `PDVC1-${s}`, nom: `Agence C1 ${s}`, chefAgence: { connect: { id: chef.id } } } });
    const pdvB = await prisma.pointDeVente.create({ data: { code: `PDVC2-${s}`, nom: `Agence C2 ${s}`, chefAgence: { connect: { id: chef.id } } } });
    const pdvAutre = await prisma.pointDeVente.create({ data: { code: `PDVC3-${s}`, nom: `Agence C3 ${s}`, chefAgence: { connect: { id: autre.id } } } });

    try {
      const ids = await resoudrePdvIdsAutorises({ user: { id: chef.id, gestionnaireRole: "CHEF_AGENCE" } });
      expect(new Set(ids)).toEqual(new Set([pdvA.id, pdvB.id]));
      expect(ids).not.toContain(pdvAutre.id);
    } finally {
      await prisma.pointDeVente.delete({ where: { id: pdvA.id } });
      await prisma.pointDeVente.delete({ where: { id: pdvB.id } });
      await prisma.pointDeVente.delete({ where: { id: pdvAutre.id } });
      await prisma.user.delete({ where: { id: chef.id } });
      await prisma.user.delete({ where: { id: autre.id } });
    }
  });
});
