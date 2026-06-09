import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/paie/ordres-paiement
 *   Query: mois?, annee?, statut? (défaut: EN_PAIEMENT)
 *   Retourne les fiches prêtes à payer avec total
 *
 * PATCH /api/admin/rh/paie/ordres-paiement
 *   Body: { ids: number[], modePaiement? }
 *   Marque toutes les fiches ids comme PAYE en masse
 */

export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const mois   = searchParams.get("mois");
    const annee  = searchParams.get("annee");
    const statut = searchParams.get("statut") ?? "EN_PAIEMENT";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { statut };
    if (mois)  where.mois  = Number(mois);
    if (annee) where.annee = Number(annee);

    const fiches = await prisma.fichePaie.findMany({
      where,
      orderBy: [{ annee: "desc" }, { mois: "desc" }, { netAPayer: "desc" }],
      select: {
        id: true, mois: true, annee: true, netAPayer: true,
        statut: true, modePaiement: true, notes: true,
        profilRH: {
          select: {
            id: true, matricule: true, departement: true,
            gestionnaire: {
              select: { member: { select: { nom: true, prenom: true, photo: true } } },
            },
          },
        },
      },
    });

    const total = fiches.reduce((s, f) => s + Number(f.netAPayer), 0);

    return NextResponse.json({ data: fiches, total });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { ids, modePaiement } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids est obligatoire" }, { status: 400 });
    }

    const updated = await prisma.fichePaie.updateMany({
      where: { id: { in: ids.map(Number) }, statut: "EN_PAIEMENT" },
      data: {
        statut: "PAYE",
        modePaiement: modePaiement ?? null,
      },
    });

    // Audit log pour chaque fiche
    await prisma.auditLog.createMany({
      data: ids.map((id: number) => ({
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "FichePaie",
        entiteId: Number(id),
        details:  JSON.parse(JSON.stringify({ avant: { statut: "EN_PAIEMENT" }, apres: { statut: "PAYE", modePaiement } })),
      })),
    });

    return NextResponse.json({ data: { count: updated.count } });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
