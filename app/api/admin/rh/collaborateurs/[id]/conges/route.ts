import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/collaborateurs/[id]/conges
 * Retourne les soldes + l'historique des demandes d'un collaborateur
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const annee = new Date().getFullYear();

    const [profil, soldes, demandes, politiques] = await Promise.all([
      prisma.profilRH.findUnique({
        where: { id: Number(id) },
        select: { id: true, matricule: true },
      }),
      // Soldes de l'année courante
      prisma.soldeConge.findMany({
        where: { profilRHId: Number(id), annee },
        orderBy: { type: "asc" },
      }),
      // Toutes les demandes (tous statuts, toutes années)
      prisma.demandeConge.findMany({
        where: { profilRHId: Number(id) },
        orderBy: { createdAt: "desc" },
      }),
      // Politiques pour afficher les droits
      prisma.politiqueConge.findMany({ where: { actif: true } }),
    ]);

    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Enrichir les soldes avec les politiques (pour les types sans solde enregistré)
    const soldesParType = Object.fromEntries(soldes.map((s) => [s.type, s]));
    const soldesTotaux = politiques.map((p) => ({
      type:       p.type,
      annee,
      totalDroit: soldesParType[p.type]?.totalDroit ?? p.joursParAn,
      pris:       soldesParType[p.type]?.pris       ?? 0,
      restant:    soldesParType[p.type]?.restant     ?? p.joursParAn,
      reporte:    soldesParType[p.type]?.reporte     ?? 0,
    }));

    return NextResponse.json({ data: { soldes: soldesTotaux, demandes, annee } });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
