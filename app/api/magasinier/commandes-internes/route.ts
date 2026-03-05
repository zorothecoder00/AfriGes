import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMagasinierSession } from "@/lib/authMagasinier";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";

async function getSession() {
  return (await getMagasinierSession()) ?? (await getRPVSession());
}

/**
 * Résout le PDV de l'utilisateur connecté (magasinier via affectation, RPV via rpvId).
 */
async function getOwnPDV(userId: number): Promise<number | null> {
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId, actif: true },
    select: { pointDeVenteId: true },
  });
  if (aff?.pointDeVenteId) return aff.pointDeVenteId;

  const pdv = await prisma.pointDeVente.findUnique({
    where: { rpvId: userId },
    select: { id: true },
  });
  return pdv?.id ?? null;
}

/**
 * GET /api/magasinier/commandes-internes
 * Liste des demandes de réapprovisionnement du PDV du magasinier/RPV connecté.
 * Query: statut, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await getOwnPDV(parseInt(session.user.id));
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { pointDeVenteId: pdvId };
    if (statut) where.statut = statut;

    const [commandes, total] = await Promise.all([
      prisma.commandeInterne.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          demandeur:    { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, reference: true, unite: true } } },
          },
        },
      }),
      prisma.commandeInterne.count({ where }),
    ]);

    return NextResponse.json({
      data: commandes,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /magasinier/commandes-internes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/magasinier/commandes-internes
 * Créer une demande de réapprovisionnement interne.
 * Body: { pointDeVenteId, notes?, lignes: [{produitId, quantiteDemandee}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Forcer le PDV du magasinier/RPV connecté
    const pointDeVenteId = await getOwnPDV(parseInt(session.user.id));
    if (!pointDeVenteId) {
      return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
    }

    const { notes, lignes } = await req.json();

    if (!lignes?.length) {
      return NextResponse.json({ error: "lignes sont obligatoires" }, { status: 400 });
    }

    const commande = await prisma.$transaction(async (tx) => {
      const ref = `CMD-INT-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const c = await tx.commandeInterne.create({
        data: {
          reference:     ref,
          statut:        "SOUMISE",
          demandeurId:   parseInt(session.user.id),
          pointDeVenteId:Number(pointDeVenteId),
          notes:         notes || null,
          lignes: {
            create: (lignes as Array<{ produitId: number; quantiteDemandee: number }>).map(l => ({
              produitId:        Number(l.produitId),
              quantiteDemandee: Number(l.quantiteDemandee),
            })),
          },
        },
        include: {
          pointDeVente: { select: { nom: true } },
          lignes: { include: { produit: { select: { nom: true } } } },
        },
      });

      await auditLog(tx, parseInt(session.user.id), "COMMANDE_INTERNE_CREEE", "CommandeInterne", c.id);

      await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre:    `Demande réappro : ${ref}`,
        message:  `${session.user.prenom} ${session.user.nom} a soumis une demande de réapprovisionnement pour "${c.pointDeVente.nom}" (${c.lignes.length} produit(s)).`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl:`/dashboard/logistique/commandes-internes/${c.id}`,
      });

      return c;
    });

    return NextResponse.json({ data: commande }, { status: 201 });
  } catch (error) {
    console.error("POST /magasinier/commandes-internes:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
