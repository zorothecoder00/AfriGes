import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const admin = await getAuthSession();
  if (admin && (admin.user.role === "ADMIN" || admin.user.role === "SUPER_ADMIN")) return admin;
  return null;
}

/**
 * GET /api/logistique/ajustements
 * Liste des demandes d'ajustement à pré-valider (niveau 2).
 * Query: statut, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit  = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 15)));
    const skip   = (page - 1) * limit;
    const statut = searchParams.get("statut") || "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (statut) where.statut = statut;

    const [demandes, total, pendingCount] = await Promise.all([
      prisma.demandeAjustementStock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          produit:      { select: { id: true, nom: true, reference: true, unite: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          demandeur:    { select: { id: true, nom: true, prenom: true } },
          validateur:   { select: { id: true, nom: true, prenom: true } },
        },
      }),
      prisma.demandeAjustementStock.count({ where }),
      prisma.demandeAjustementStock.count({ where: { statut: "EN_ATTENTE" } }),
    ]);

    return NextResponse.json({
      data: demandes,
      stats: { pendingCount },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/ajustements:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
