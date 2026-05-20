import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

const parseIds = (val: unknown): number[] =>
  Array.isArray(val)
    ? [...new Set((val as unknown[]).map(Number).filter(n => Number.isInteger(n) && n > 0))]
    : [];

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

    // Toutes les périodes d'affectation de cet agent (pour CA historiquement juste)
    const affectationsHistorique = await prisma.clientAgentAffectation.findMany({
      where: { agentId: userId },
      select: { clientId: true, dateDebut: true, dateFin: true },
    });

    // Map clientId → liste de périodes
    const periodesParClient = new Map<number, Array<{ dateDebut: Date; dateFin: Date | null }>>();
    for (const a of affectationsHistorique) {
      if (!periodesParClient.has(a.clientId)) periodesParClient.set(a.clientId, []);
      periodesParClient.get(a.clientId)!.push({ dateDebut: a.dateDebut, dateFin: a.dateFin });
    }

    const estDansPeriode = (
      date: Date,
      periodes: Array<{ dateDebut: Date; dateFin: Date | null }>
    ) => periodes.some((p) => date >= p.dateDebut && (p.dateFin === null || date <= p.dateFin));

    const clients = await prisma.client.findMany({
      where: { agentTerrainId: userId },
      include: {
        souscriptionsPacks: {
          where: { statut: { not: "ANNULE" } },
          include: {
            versements: {
              where: { statut: "PAYE" },
              select: { montant: true, createdAt: true },
            },
          },
        },
        ventesDirectes: {
          where: { statut: { not: "ANNULEE" } },
          select: { montantPaye: true, createdAt: true },
        },
        pointDeVente: { select: { id: true, nom: true, code: true } },
        _count: { select: { souscriptionsPacks: true, ventesDirectes: true } },
      },
      orderBy: { nom: "asc" },
    });

    const clientsAvecCA = clients.map((client) => {
      const periodes = periodesParClient.get(client.id) ?? [];
      const caPacks = client.souscriptionsPacks.reduce(
        (sum, s) =>
          sum +
          s.versements
            .filter((v) => !periodes.length || estDansPeriode(v.createdAt, periodes))
            .reduce((vs, v) => vs + Number(v.montant), 0),
        0
      );
      const caVentes = client.ventesDirectes
        .filter((v) => !periodes.length || estDansPeriode(v.createdAt, periodes))
        .reduce((sum, v) => sum + Number(v.montantPaye), 0);
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

/**
 * POST /api/admin/gestionnaires/[id]/clients
 * Affectation en masse : { clientIds: number[] }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const clientIds = parseIds(body.clientIds);
    if (!clientIds.length) return NextResponse.json({ message: "Aucun client fourni" }, { status: 400 });

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { id: gestionnaireId, role: "AGENT_TERRAIN" },
    });
    if (!gestionnaire) return NextResponse.json({ message: "Agent terrain introuvable" }, { status: 404 });

    const now = new Date();
    const { count } = await prisma.$transaction(async (tx) => {
      // Fermer les affectations actives existantes pour ces clients
      await tx.clientAgentAffectation.updateMany({
        where: { clientId: { in: clientIds }, actif: true },
        data: { actif: false, dateFin: now },
      });
      // Créer les nouvelles affectations
      await tx.clientAgentAffectation.createMany({
        data: clientIds.map((clientId) => ({
          clientId,
          agentId: gestionnaire.memberId,
          dateDebut: now,
          actif: true,
        })),
      });
      return tx.client.updateMany({
        where: { id: { in: clientIds } },
        data: { agentTerrainId: gestionnaire.memberId },
      });
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("POST /api/admin/gestionnaires/[id]/clients", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/gestionnaires/[id]/clients
 * Désaffectation en masse : { clientIds: number[] }
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const gestionnaireId = Number(id);
    if (isNaN(gestionnaireId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const clientIds = parseIds(body.clientIds);
    if (!clientIds.length) return NextResponse.json({ message: "Aucun client fourni" }, { status: 400 });

    const gestionnaire = await prisma.gestionnaire.findFirst({
      where: { id: gestionnaireId, role: "AGENT_TERRAIN" },
    });
    if (!gestionnaire) return NextResponse.json({ message: "Agent terrain introuvable" }, { status: 404 });

    const { count } = await prisma.$transaction(async (tx) => {
      // Fermer les affectations actives de cet agent pour ces clients
      await tx.clientAgentAffectation.updateMany({
        where: { clientId: { in: clientIds }, agentId: gestionnaire.memberId, actif: true },
        data: { actif: false, dateFin: new Date() },
      });
      return tx.client.updateMany({
        where: { id: { in: clientIds }, agentTerrainId: gestionnaire.memberId },
        data: { agentTerrainId: null },
      });
    });

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("DELETE /api/admin/gestionnaires/[id]/clients", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
