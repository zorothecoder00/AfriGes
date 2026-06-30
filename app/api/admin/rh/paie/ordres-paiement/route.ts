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

    // Génération des 3 listes par mode de paiement (CDC 13.8) + bucket « non affecté ».
    type Groupe = { fiches: typeof fiches; total: number; count: number };
    const listes: Record<"VIREMENT" | "MOBILE_MONEY" | "ESPECES" | "NON_AFFECTE", Groupe> = {
      VIREMENT:     { fiches: [], total: 0, count: 0 },
      MOBILE_MONEY: { fiches: [], total: 0, count: 0 },
      ESPECES:      { fiches: [], total: 0, count: 0 },
      NON_AFFECTE:  { fiches: [], total: 0, count: 0 },
    };
    for (const f of fiches) {
      const k = (["VIREMENT", "MOBILE_MONEY", "ESPECES"] as const).includes(f.modePaiement as never)
        ? (f.modePaiement as "VIREMENT" | "MOBILE_MONEY" | "ESPECES")
        : "NON_AFFECTE";
      listes[k].fiches.push(f);
      listes[k].total += Number(f.netAPayer);
      listes[k].count += 1;
    }

    return NextResponse.json({ data: fiches, total, listes });
  } catch (error) {
    console.error("GET /api/admin/rh/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { ids, modePaiement, action } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids est obligatoire" }, { status: 400 });
    }

    // action = "AFFECTER" → assigne le mode de paiement SANS payer (la fiche reste EN_PAIEMENT,
    //                        elle bascule juste dans la bonne liste).
    //          "PAYER" (défaut) → marque PAYE avec le mode.
    const affecterSeul = action === "AFFECTER";

    if (affecterSeul && !modePaiement) {
      return NextResponse.json({ error: "modePaiement est obligatoire pour l'affectation" }, { status: 400 });
    }

    const updated = await prisma.fichePaie.updateMany({
      where: { id: { in: ids.map(Number) }, statut: "EN_PAIEMENT" },
      data: affecterSeul
        ? { modePaiement }
        : { statut: "PAYE", modePaiement: modePaiement ?? null },
    });

    await prisma.auditLog.createMany({
      data: ids.map((id: number) => ({
        userId:   parseInt(session.user.id),
        action:   affecterSeul ? "AFFECTER_MODE_PAIEMENT" : "MARQUER_PAYE",
        entite:   "FichePaie",
        entiteId: Number(id),
        details:  JSON.parse(JSON.stringify(
          affecterSeul
            ? { apres: { modePaiement } }
            : { avant: { statut: "EN_PAIEMENT" }, apres: { statut: "PAYE", modePaiement } },
        )),
      })),
    });

    return NextResponse.json({ data: { count: updated.count } });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
