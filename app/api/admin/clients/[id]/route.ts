import { NextResponse } from "next/server";
import {
  MemberStatus,
  Role,
  PrioriteNotification,
  SegmentClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

interface RouteParams {
  params: Promise<{
    id: string;   
  }>;
}  

/**
 * ==========================
 * GET /api/admin/clients/[id]
 * ==========================
 * Lire un client specifique avec ses activites
 */
export async function GET(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        pointDeVente:  { select: { id: true, nom: true, code: true } },
        pointsDeVente: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
        agentTerrain:  { select: { id: true, nom: true, prenom: true } },
        souscriptionsPacks: {
          include: {
            pack: true,
            echeances: { orderBy: { datePrevue: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
        ventesDirectes: {
          where:   { statut: { not: "ANNULEE" } },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true, reference: true, statut: true,
            modePaiement: true, montantTotal: true, montantPaye: true,
            createdAt: true,
            pointDeVente: { select: { id: true, nom: true, code: true } },
            lignes: {
              select: {
                id: true, quantite: true, prixUnitaire: true, montant: true,
                produit: { select: { id: true, nom: true } },
              },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { message: "Client introuvable" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: client });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Erreur lors de la recuperation du client" },
      { status: 500 }
    );
  }
}

/**
 * ==========================
 * PATCH /api/admin/clients/[id]
 * ==========================
 * Modifier un client (nom, prenom, telephone, adresse, etat)
 */
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      nom, prenom, telephone, adresse, etat, pointDeVenteId, pointsDeVenteIds, agentTerrainId,
      // Nouveaux champs
      sexe, dateNaissance, telephoneSecondaire, quartier, ville,
      photoUrl, pieceIdentiteUrl, numeroCNI,
      activite, nomCommerce,
      latitude, longitude,
      segment,
      typeClient, limiteCredit,
    } = body;

    // Valider le statut si fourni
    if (etat && !Object.values(MemberStatus).includes(etat)) {
      return NextResponse.json(
        { message: "Statut invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.client.findUnique({
        where: { id: clientId },
      });

      if (!existing) {
        throw new Error("Client introuvable");
      }

      // Verifier doublon telephone si modifie
      if (telephone && telephone !== existing.telephone) {
        const duplicate = await tx.client.findUnique({
          where: { telephone },
        });
        if (duplicate) {
          throw new Error("DUPLICATE_PHONE");
        }
      }

      const normalizeIds = (value: unknown): number[] => {
        if (!Array.isArray(value)) return [];
        return [...new Set(value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
      };

      const hasLegacyPdvUpdate = pointDeVenteId !== undefined;
      const hasBulkPdvUpdate = pointsDeVenteIds !== undefined;

      const nextLegacyPdvId = hasLegacyPdvUpdate
        ? pointDeVenteId
          ? Number(pointDeVenteId)
          : null
        : undefined;
      const nextBulkIds = hasBulkPdvUpdate ? normalizeIds(pointsDeVenteIds) : [];

      // Gestion historique affectation agent terrain
      if (agentTerrainId !== undefined) {
        const oldAgentId = existing.agentTerrainId;
        const newAgentId = agentTerrainId ? Number(agentTerrainId) : null;
        if (oldAgentId !== newAgentId) {
          if (oldAgentId) {
            await tx.clientAgentAffectation.updateMany({
              where: { clientId, agentId: oldAgentId, actif: true },
              data: { actif: false, dateFin: new Date() },
            });
          }
          if (newAgentId) {
            await tx.clientAgentAffectation.create({
              data: { clientId, agentId: newAgentId, actif: true },
            });
          }
        }
      }

      const updated = await tx.client.update({
        where: { id: clientId },
        data: {
          // Champs legacy
          ...(nom       && { nom }),
          ...(prenom    && { prenom }),
          ...(telephone && { telephone }),
          ...(adresse       !== undefined && { adresse: adresse || null }),
          ...(etat          && { etat: etat as MemberStatus }),
          ...(agentTerrainId !== undefined && {
            agentTerrainId: agentTerrainId ? Number(agentTerrainId) : null,
          }),
          ...(hasBulkPdvUpdate
            ? { pointDeVenteId: nextBulkIds[0] ?? null }
            : hasLegacyPdvUpdate
              ? { pointDeVenteId: nextLegacyPdvId }
              : {}),
          // Nouveaux champs (undefined = non envoyé = ignoré)
          ...(sexe               !== undefined && { sexe: sexe || null }),
          ...(dateNaissance      !== undefined && { dateNaissance: dateNaissance ? new Date(dateNaissance) : null }),
          ...(telephoneSecondaire !== undefined && { telephoneSecondaire: telephoneSecondaire || null }),
          ...(quartier           !== undefined && { quartier: quartier || null }),
          ...(ville              !== undefined && { ville: ville || null }),
          ...(photoUrl           !== undefined && { photoUrl: photoUrl || null }),
          ...(pieceIdentiteUrl   !== undefined && { pieceIdentiteUrl: pieceIdentiteUrl || null }),
          ...(numeroCNI          !== undefined && { numeroCNI: numeroCNI || null }),
          ...(activite           !== undefined && { activite: activite || null }),
          ...(nomCommerce        !== undefined && { nomCommerce: nomCommerce || null }),
          ...(latitude           !== undefined && { latitude: latitude != null ? Number(latitude) : null }),
          ...(longitude          !== undefined && { longitude: longitude != null ? Number(longitude) : null }),
          ...(segment            !== undefined && { segment: segment as SegmentClient }),
          ...(typeClient         !== undefined && { typeClient: typeClient || null }),
          ...(limiteCredit       !== undefined && { limiteCredit: limiteCredit != null ? Number(limiteCredit) : null }),
        },
      });

      if (hasBulkPdvUpdate) {
        await tx.clientPointDeVente.deleteMany({ where: { clientId } });
        if (nextBulkIds.length > 0) {
          await tx.clientPointDeVente.createMany({
            data: nextBulkIds.map((id) => ({
              clientId,
              pointDeVenteId: id,
            })),
            skipDuplicates: true,
          });
        }
      } else if (hasLegacyPdvUpdate) {
        if (nextLegacyPdvId) {
          await tx.clientPointDeVente.upsert({
            where: { clientId_pointDeVenteId: { clientId, pointDeVenteId: nextLegacyPdvId } },
            update: {},
            create: { clientId, pointDeVenteId: nextLegacyPdvId },
          });
        } else {
          await tx.clientPointDeVente.deleteMany({ where: { clientId } });
        }
      }
      
      // Audit log
      await tx.auditLog.create({
        data: {
          action: "MODIFICATION_CLIENT",
          entite: "Client",
          entiteId: clientId,
        },
      });

      // Notification ADMIN & SUPER_ADMIN
      const admins = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Client modifie",
            message: `Le client ${updated.prenom} ${updated.nom} a ete modifie.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: `/dashboard/admin/clients/${clientId}`,
          })),
        });
      }

      return updated;
    });

    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      if (error.message === "Client introuvable") {
        return NextResponse.json(
          { message: error.message },
          { status: 404 }
        );
      }
      if (error.message === "DUPLICATE_PHONE") {
        return NextResponse.json(
          { message: "Ce numero de telephone est deja utilise par un autre client" },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { message: "Erreur lors de la modification du client" },
      { status: 500 }
    );
  }
}  

/**
 * ==========================
 * DELETE /api/admin/clients/[id]
 * ==========================
 * Supprimer un client
 */
export async function DELETE(
  _req: Request,
  { params }: RouteParams
) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) {
      return NextResponse.json(
        { message: "ID invalide" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        throw new Error("Client introuvable");
      }

      await tx.client.delete({
        where: { id: clientId },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          action: "SUPPRESSION_CLIENT",
          entite: "Client",
          entiteId: clientId,
        },    
      });

      // Notification ADMIN & SUPER_ADMIN
      const admins = await tx.user.findMany({
        where: {
          role: { in: [Role.ADMIN, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });

      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            titre: "Client supprime",
            message: `Le client ${client.prenom} ${client.nom} a ete supprime.`,
            priorite: PrioriteNotification.HAUTE,
            actionUrl: `/dashboard/admin/clients`,
          })),
        });
      }

      return true;
    });

    return NextResponse.json({ success: result });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      if (error.message === "Client introuvable") {
        return NextResponse.json(
          { message: error.message },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { message: "Erreur lors de la suppression du client" },
      { status: 500 }
    );
  }
}
