import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

/**
 * GET /api/admin/marketing/campagnes
 * Liste filtrable des campagnes. Portée par rôle (CDC §4) : la Direction/Admin
 * voit tout ; CHEF_AGENCE et RESPONSABLE_POINT_DE_VENTE ne voient que les
 * campagnes ciblant au moins une de leurs agences.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const sp = req.nextUrl.searchParams;
    const statut = sp.get("statut");
    const typeCampagneId = sp.get("typeCampagneId");
    const responsableId = sp.get("responsableId");

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const gRole = session.user.gestionnaireRole;

    const where: import("@prisma/client").Prisma.CampagneWhereInput = {
      ...(statut ? { statut: statut as never } : {}),
      ...(typeCampagneId ? { typeCampagneId: Number(typeCampagneId) } : {}),
      ...(responsableId ? { responsableId: Number(responsableId) } : {}),
    };

    // Scoping agence pour les rôles non-admin/non-marketing (§4 : "responsable
    // d'agence voit les campagnes de son agence").
    if (!isAdmin && gRole !== "RESPONSABLE_MARKETING" && gRole !== "DIRECTEUR_GENERAL") {
      const userId = Number(session.user.id);
      const pdvIds = await prisma.pointDeVente.findMany({
        where: { OR: [{ rpvId: userId }, { chefAgenceId: userId }, { responsableId: userId }] },
        select: { id: true },
      });
      where.agences = { some: { pointDeVenteId: { in: pdvIds.map((p) => p.id) } } };
    }

    const campagnes = await prisma.campagne.findMany({
      where,
      include: {
        responsable: { select: { id: true, nom: true, prenom: true } },
        typeCampagne: true,
        budget: true,
        objectifs: true,
        agences: { include: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
        canaux: { include: { canal: true } },
        audience: { select: { id: true, nom: true, tailleCalculee: true } },
        _count: { select: { ventesAttribuees: true, creditsAttribues: true, depenses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: campagnes });
  } catch (e) {
    console.error("GET /api/admin/marketing/campagnes", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/marketing/campagnes
 * Création d'une campagne en statut BROUILLON (CDC §6, §9 brief marketing).
 * Body: { nom, description?, portee?, responsableId, commercialId?, typeCampagneId,
 *   brief?, audienceId?, dateDebut, dateFin, objectifs?: string[], agenceIds?: number[],
 *   canalIds?: number[], produits?: { produitId?, familleId?, packId? }[], budgetPrevu? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const {
      nom, description, portee, responsableId, commercialId, typeCampagneId,
      brief, audienceId, dateDebut, dateFin, objectifs, agenceIds, canalIds,
      produits, budgetPrevu,
    } = body;

    if (!nom || !responsableId || !typeCampagneId || !dateDebut || !dateFin) {
      return NextResponse.json(
        { error: "Champs requis manquants (nom, responsableId, typeCampagneId, dateDebut, dateFin)" },
        { status: 400 }
      );
    }

    const userId = Number(session.user.id);

    const campagne = await prisma.$transaction(async (tx) => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count = await tx.campagne.count();
      const code = `CAMP-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      const created = await tx.campagne.create({
        data: {
          code,
          nom,
          description: description || null,
          portee: portee || "AGENCE",
          responsableId: Number(responsableId),
          commercialId: commercialId ? Number(commercialId) : null,
          typeCampagneId: Number(typeCampagneId),
          brief: brief ?? undefined,
          audienceId: audienceId ? Number(audienceId) : null,
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          creeParId: userId,
          objectifs: objectifs?.length
            ? { create: (objectifs as string[]).map((o) => ({ objectif: o as never })) }
            : undefined,
          agences: agenceIds?.length
            ? { create: (agenceIds as number[]).map((id) => ({ pointDeVenteId: Number(id) })) }
            : undefined,
          canaux: canalIds?.length
            ? { create: (canalIds as number[]).map((id) => ({ canalId: Number(id) })) }
            : undefined,
          produits: produits?.length
            ? {
                create: (produits as { produitId?: number; familleId?: number; packId?: number }[]).map((p) => ({
                  produitId: p.produitId ? Number(p.produitId) : null,
                  familleId: p.familleId ? Number(p.familleId) : null,
                  packId: p.packId ? Number(p.packId) : null,
                })),
              }
            : undefined,
          budget: budgetPrevu
            ? { create: { montantPrevu: Number(budgetPrevu), demandeParId: userId } }
            : undefined,
        },
        include: { budget: true, objectifs: true, agences: true, canaux: true, produits: true },
      });

      await auditLog(tx, userId, "CREATE", "Campagne", created.id, { nom, statut: "BROUILLON" });
      return created;
    });

    return NextResponse.json({ data: campagne }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/campagnes", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
