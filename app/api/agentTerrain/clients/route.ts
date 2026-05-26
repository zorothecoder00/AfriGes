import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrioriteNotification, MemberStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { resolveViewAs } from "@/lib/viewAs";
import { notifyRoles, auditLog } from "@/lib/notifications";

/**
 * GET /api/agentTerrain/clients
 * Liste clients du PDV de l'agent terrain, avec pagination et recherche.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;
    const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

    // Résoudre le PDV de l'agent terrain (ou du gestionnaire ciblé en viewAs)
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: effectiveUserId, actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId;
    if (!pdvId) {
      return NextResponse.json({ error: "Aucun point de vente associé à cet agent" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip  = (page - 1) * limit;
    const search = ( searchParams.get("search") || "" ).trim();

    const where: Prisma.ClientWhereInput = {
      pointDeVenteId: pdvId,
      ...(search && (() => {
        const parts = search.split(/\s+/);
        const conditions: object[] = [
          { nom:       { contains: search, mode: "insensitive" } },
          { prenom:    { contains: search, mode: "insensitive" } },
          { telephone: { contains: search, mode: "insensitive" } },
        ];
        if (parts.length >= 2) {
          const [first, ...rest] = parts; const restStr = rest.join(" ");
          conditions.push({ AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: restStr, mode: "insensitive" } }] });
          conditions.push({ AND: [{ nom: { contains: first, mode: "insensitive" } }, { prenom: { contains: restStr, mode: "insensitive" } }] });
        }
        return { OR: conditions };
      })()),
    };

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,  
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, nom: true, prenom: true, telephone: true,
          adresse: true, quartier: true, ville: true, activite: true, etat: true,
          typeClient: true, limiteCredit: true, soldeActuel: true,
          niveauRisque: true, codeClient: true,
          latitude: true, longitude: true,
          createdAt: true,
          _count: {
            select: {
              souscriptionsPacks: {
                where: { statut: { in: ["EN_ATTENTE", "ACTIF"] } },
              },
            },
          },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /agentTerrain/clients error:", error);
    return NextResponse.json({ error: "Erreur lors du chargement des clients" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/clients
 * Créer un nouveau client (prospection terrain)
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await req.json();
    const {
      nom, prenom, telephone,
      adresse, sexe, dateNaissance, telephoneSecondaire,
      quartier, ville, numeroCNI,
      activite, nomCommerce,
      latitude, longitude,
    } = body;

    if (!nom || !prenom || !telephone) {
      return NextResponse.json(
        { error: "Champs obligatoires manquants (nom, prenom, telephone)" },
        { status: 400 }
      );
    }

    const existing = await prisma.client.findUnique({ where: { telephone } });
    if (existing) {
      return NextResponse.json({ error: "Ce numéro de téléphone est déjà utilisé" }, { status: 400 });
    }

    // Résoudre le PDV de l'agent terrain
    const aff = await prisma.gestionnaireAffectation.findFirst({
      where: { userId: parseInt(session.user.id), actif: true },
      select: { pointDeVenteId: true },
    });
    const pdvId = aff?.pointDeVenteId ?? null;
    const agentId = parseInt(session.user.id);

    const client = await prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          nom, prenom, telephone,
          etat:                 MemberStatus.EN_ATTENTE_VALIDATION,
          adresse:              adresse              || null,
          sexe:                 sexe                 || null,
          dateNaissance:        dateNaissance        ? new Date(dateNaissance) : null,
          telephoneSecondaire:  telephoneSecondaire  || null,
          quartier:             quartier             || null,
          ville:                ville                || null,
          numeroCNI:            numeroCNI            || null,
          activite:             activite             || null,
          nomCommerce:          nomCommerce          || null,
          latitude:             latitude             ? Number(latitude)  : null,
          longitude:            longitude            ? Number(longitude) : null,
          pointDeVenteId:       pdvId,
          agentTerrainId:       agentId,
        },
      });

      await auditLog(tx, parseInt(session.user.id), "CREATION_CLIENT_PROSPECTION", "Client", created.id);

      // Notifier uniquement les RVC affectés au même PDV que l'agent
      if (pdvId) {
        const rvcsDuPdv = await tx.gestionnaireAffectation.findMany({
          where: {
            pointDeVenteId: pdvId,
            actif: true,
            user: { gestionnaire: { role: "RESPONSABLE_VENTE_CREDIT", actif: true } },
          },
          select: { userId: true },
        });

        if (rvcsDuPdv.length > 0) {
          await tx.notification.createMany({
            data: rvcsDuPdv.map(({ userId }) => ({
              userId,
              titre:    "Nouveau client à valider",
              message:  `L'agent ${session.user.prenom} ${session.user.nom} a enregistré le client ${prenom} ${nom} (${telephone}). En attente de validation RVC.`,
              priorite: PrioriteNotification.HAUTE,
              actionUrl:`/dashboard/user/responsablesVenteCredit`,
            })),
            skipDuplicates: true,
          });
        }
      }

      return created;
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    console.error("POST /agentTerrain/clients error:", error);
    return NextResponse.json({ error: "Erreur lors de la creation du client" }, { status: 500 });
  }
}
