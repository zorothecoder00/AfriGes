import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRPVSession } from "@/lib/authRPV";
import { randomUUID } from "crypto";
import { notifyRoles, auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

async function getOwnPDV(userId: number) {
  return prisma.pointDeVente.findUnique({ where: { rpvId: userId }, select: { id: true, nom: true } });
}

/**
 * GET /api/rpv/transferts
 * Mes demandes de transfert (en tant que destination) — CDC §13 "une agence
 * peut demander un transfert".
 */
export async function GET() {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdv = await getOwnPDV(parseInt(session.user.id));
    if (!pdv) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const demandes = await prisma.transfertStock.findMany({
      where: { destinationId: pdv.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        origine: { select: { id: true, nom: true } },
        lignes: { include: { produit: { select: { id: true, nom: true, unite: true } } } },
      },
    });

    return NextResponse.json({ data: demandes });
  } catch (error) {
    console.error("GET /rpv/transferts:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rpv/transferts
 * Demander un transfert de stock depuis une autre agence (CDC §13 étape 1).
 * Aucun impact stock à ce stade — juste une demande, destination = mon PDV,
 * origine à déterminer par l'appro central à la validation.
 * Body: { notes?, lignes: [{produitId, quantite}] }
 */
export async function POST(req: Request) {
  try {
    const session = await getRPVSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdv = await getOwnPDV(parseInt(session.user.id));
    if (!pdv) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { notes, lignes } = await req.json();
    if (!lignes?.length) return NextResponse.json({ error: "lignes sont obligatoires" }, { status: 400 });

    const demande = await prisma.$transaction(async (tx) => {
      const ref = `TRF-DEM-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

      const t = await tx.transfertStock.create({
        data: {
          reference: ref,
          statut: "DEMANDE",
          destinationId: pdv.id,
          creeParId: parseInt(session.user.id),
          notes: notes || null,
          lignes: {
            create: (lignes as Array<{ produitId: number; quantite: number }>).map((l) => ({
              produitId: Number(l.produitId), quantite: Number(l.quantite),
            })),
          },
        },
        include: { lignes: { include: { produit: { select: { nom: true } } } } },
      });

      await auditLog(tx, parseInt(session.user.id), "TRANSFERT_DEMANDE", "TransfertStock", t.id, undefined, getRequestMeta(req));

      await notifyRoles(tx, ["AGENT_LOGISTIQUE_APPROVISIONNEMENT"], {
        titre: `Demande de transfert : ${ref}`,
        message: `${session.user.prenom} ${session.user.nom} demande un transfert de stock vers "${pdv.nom}" (${t.lignes.length} produit(s)) — à valider et à assigner à une agence source.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: "/dashboard/user/logistiquesApprovisionnements",
      });

      return t;
    });

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /rpv/transferts:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
