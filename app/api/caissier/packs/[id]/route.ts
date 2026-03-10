import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — Détail complet d'une souscription (versements, échéances, réceptions).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId  = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId   = isAdmin ? null : await getCaissierPdvId(userId);

    const { id } = await params;

    const souscription = await prisma.souscriptionPack.findUnique({
      where: { id: parseInt(id) },
      include: {
        pack: true,
        user: {
          select: {
            id: true, nom: true, prenom: true, telephone: true,
            affectationsPDV: { where: { actif: true }, select: { pointDeVenteId: true } },
          },
        },
        client: { select: { id: true, nom: true, prenom: true, telephone: true, pointDeVenteId: true } },
        versements: { orderBy: { datePaiement: "desc" } },
        echeances: { orderBy: { numero: "asc" } },
        receptions: {
          include: {
            lignes: {
              include: { produit: { select: { nom: true, prixUnitaire: true } } },
            },
          },
        },
      },
    });

    if (!souscription) {
      return NextResponse.json({ error: "Souscription introuvable" }, { status: 404 });
    }

    // Vérifier que la souscription appartient au PDV du caissier
    if (!isAdmin && pdvId) {
      const clientPdv = souscription.client?.pointDeVenteId;
      const userPdv   = souscription.user?.affectationsPDV?.some(a => a.pointDeVenteId === pdvId);
      if (clientPdv !== pdvId && !userPdv) {
        return NextResponse.json({ error: "Souscription hors de votre périmètre" }, { status: 403 });
      }
    }

    return NextResponse.json(souscription);
  } catch (error) {
    console.error("GET /api/caissier/packs/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
