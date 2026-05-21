import { NextResponse } from "next/server";
import { MemberStatus, PrioriteNotification, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**  
 * ==========================
 * GET /api/admin/clients
 * ==========================
 * Lister tous les clients (paginé, avec recherche)
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 10);
    const skip = (page - 1) * limit;
    const search = ( searchParams.get("search") || "" ).trim();
    const pdvId  = searchParams.get("pdvId");

    const pdvIdNumber = pdvId ? Number(pdvId) : null;

    const where: Prisma.ClientWhereInput = {
      ...(pdvIdNumber && {
        AND: [
          {
            OR: [
              { pointDeVenteId: pdvIdNumber },
              { pointsDeVente: { some: { pointDeVenteId: pdvIdNumber } } },
            ],
          },
        ],
      }),
      ...(search && {
        OR: (() => {
          const conditions: Prisma.ClientWhereInput[] = [
            { nom:       { contains: search, mode: "insensitive" } },
            { prenom:    { contains: search, mode: "insensitive" } },
            { telephone: { contains: search, mode: "insensitive" } },
          ];
          // Recherche combinée "prénom nom" ou "nom prénom"
          const parts = search.split(/\s+/);
          if (parts.length >= 2) {
            const first = parts[0];
            const rest  = parts.slice(1).join(" ");
            // prénom → first, nom → rest
            conditions.push({
              AND: [
                { prenom: { contains: first, mode: "insensitive" } },
                { nom:    { contains: rest,  mode: "insensitive" } },
              ],
            });
            // nom → first, prénom → rest (ordre inversé)
            conditions.push({
              AND: [
                { nom:    { contains: first, mode: "insensitive" } },
                { prenom: { contains: rest,  mode: "insensitive" } },
              ],
            });
          }
          return conditions;
        })(),
      }),
    };

    const agentTerrainIdParam = searchParams.get("agentTerrainId");
    const agentTerrainIdNumber = agentTerrainIdParam ? Number(agentTerrainIdParam) : null;

    if (agentTerrainIdNumber) {
      if (!where.AND) where.AND = [];
      (where.AND as object[]).push({ agentTerrainId: agentTerrainIdNumber });
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { souscriptionsPacks: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          pointsDeVente: {
            select: {
              pointDeVente: { select: { id: true, nom: true, code: true } },
            },
          },
          agentTerrain: { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return NextResponse.json({
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la récupération des clients" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * POST /api/admin/clients
 * ==========================
 * Créer un nouveau client
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      nom, prenom, telephone, adresse, pointDeVenteId, pointsDeVenteIds, agentTerrainId,
      // Nouveaux champs identité
      sexe, dateNaissance, telephoneSecondaire, quartier, ville,
      photoUrl, pieceIdentiteUrl, numeroCNI,
      // Activité & commerce
      activite, nomCommerce,
      // GPS
      latitude, longitude,
      // Type & crédit
      typeClient, limiteCredit,
      // Statut
      etat,
    } = body;

    if (!nom || !prenom || !telephone) {
      return NextResponse.json(
        { message: "Champs obligatoires manquants (nom, prénom, téléphone)" },
        { status: 400 }
      );
    }

    // Vérifier doublon sur téléphone
    const existing = await prisma.client.findUnique({
      where: { telephone },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Ce numéro de téléphone est déjà utilisé" },
        { status: 409 }
      );
    }

    const normalizeIds = (value: unknown): number[] => {
      if (!Array.isArray(value)) return [];
      return [...new Set(value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
    };

    const relationIdsFromBody = normalizeIds(pointsDeVenteIds);
    const legacyPdvId = pointDeVenteId ? Number(pointDeVenteId) : null;
    const finalRelationIds = legacyPdvId
      ? [...new Set([...relationIdsFromBody, legacyPdvId])]
      : relationIdsFromBody;
    const pdvIdToStore = legacyPdvId ?? finalRelationIds[0] ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // Auto-génération du code client
      const totalClients = await tx.client.count();
      const codeClient = `CLI-${String(totalClients + 1).padStart(5, "0")}`;

      // 1. Création du client
      const client = await tx.client.create({
        data: {
          // Champs legacy obligatoires
          nom,
          prenom,
          telephone,
          adresse:    adresse    || null,
          etat:       (etat as MemberStatus) || MemberStatus.ACTIF,
          pointDeVenteId: pdvIdToStore,
          ...(agentTerrainId ? { agentTerrainId: Number(agentTerrainId) } : {}),
          // Nouveaux champs (tous optionnels)
          codeClient,
          sexe:               sexe               || null,
          dateNaissance:      dateNaissance       ? new Date(dateNaissance)  : null,
          telephoneSecondaire: telephoneSecondaire || null,
          quartier:           quartier            || null,
          ville:              ville               || null,
          photoUrl:           photoUrl            || null,
          pieceIdentiteUrl:   pieceIdentiteUrl    || null,
          numeroCNI:          numeroCNI           || null,
          activite:           activite            || null,
          nomCommerce:        nomCommerce         || null,
          latitude:           latitude            != null ? Number(latitude)  : null,
          longitude:          longitude           != null ? Number(longitude) : null,
          typeClient:         typeClient          || null,
          limiteCredit:       limiteCredit        != null ? Number(limiteCredit) : null,
          soldeActuel:        0,
        },
      });

      if (finalRelationIds.length > 0) {
        await tx.clientPointDeVente.createMany({
          data: finalRelationIds.map((id) => ({
            clientId: client.id,
            pointDeVenteId: id,
          })),
          skipDuplicates: true,
        });
      }

      // Historique affectation agent terrain
      if (agentTerrainId) {
        await tx.clientAgentAffectation.create({
          data: { clientId: client.id, agentId: Number(agentTerrainId), actif: true },
        });
      }

      // 2. Audit log
      await tx.auditLog.create({
        data: {
          action: "CREATION_CLIENT",
          entite: "Client",
          entiteId: client.id,
        },
      });

      // 3. Notifications aux admins
      const destinataires = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (destinataires.length > 0) {
        await tx.notification.createMany({
          data: destinataires.map((user) => ({
            userId: user.id,
            titre: "Nouveau client ajouté",
            message: `Un nouveau client (${prenom} ${nom}) a été ajouté.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/clients`,
          })),
        });
      }

      return client;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la création du client" },
      { status: 500 }
    );
  }
}
