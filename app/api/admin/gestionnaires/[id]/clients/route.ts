import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/gestionnaires/[id]/clients
 * Retourne tous les clients assignés à un agent terrain,
 * avec le CA individuel (packs + ventes directes) et le CA global.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) {
      return NextResponse.json({ message: "ID invalide" }, { status: 400 });
    }

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { id: gestionnaireId, role: "AGENT_TERRAIN" },
      include: {
        member: {
          select: { id: true, nom: true, prenom: true, email: true, telephone: true },
        },
      },
    });

    if (!gestionnaire) {
      return NextResponse.json({ message: "Agent terrain introuvable" }, { status: 404 });
    }

    const userId = gestionnaire.memberId;

    // PDVs actifs de l'agent terrain (pour le calcul d'avertissement)
    const agentAffectations = await prisma.gestionnaireAffectation.findMany({
      where: { userId, actif: true },
      select: { pointDeVenteId: true },
    });
    const agentPdvIds = agentAffectations.map((a) => a.pointDeVenteId);

    const clients = await prisma.client.findMany({
      where: { agentTerrainId: userId },
      include: {
        souscriptionsPacks: {
          where: { statut: { not: "ANNULE" } },
          include: {
            versements: {
              where: { statut: "PAYE" },
              select: { montant: true },
            },
          },
        },
        ventesDirectes: {
          where: { statut: { not: "ANNULEE" } },
          select: { montantPaye: true },
        },
        pointDeVente: { select: { id: true, nom: true, code: true } },
        _count: { select: { souscriptionsPacks: true, ventesDirectes: true } },
      },
      orderBy: { nom: "asc" },
    });

    const clientsAvecCA = clients.map((client) => {
      const caPacks = client.souscriptionsPacks.reduce(
        (sum, s) => sum + s.versements.reduce((vs, v) => vs + Number(v.montant), 0),
        0
      );
      const caVentes = client.ventesDirectes.reduce(
        (sum, v) => sum + Number(v.montantPaye),
        0
      );
      return {
        id: client.id,
        nom: client.nom,
        prenom: client.prenom,
        telephone: client.telephone,
        adresse: client.adresse,
        etat: client.etat,
        createdAt: client.createdAt,
        pointDeVente: client.pointDeVente,
        _count: client._count,
        caPacks,
        caVentes,
        caTotal: caPacks + caVentes,
      };
    });

    const caGlobal = clientsAvecCA.reduce((sum, c) => sum + c.caTotal, 0);

    return NextResponse.json({
      success: true,
      gestionnaire: {
        id: gestionnaire.id,
        role: gestionnaire.role,
        actif: gestionnaire.actif,
        member: gestionnaire.member,
      },
      clients: clientsAvecCA,
      agentPdvIds,
      meta: { total: clientsAvecCA.length, caGlobal },
    });
  } catch (error) {
    console.error("GET /api/admin/gestionnaires/[id]/clients", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
