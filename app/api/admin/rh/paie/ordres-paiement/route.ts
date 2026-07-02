import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/rh/paie/ordres-paiement
 *   Query: mois?, annee?, statut? (défaut: EN_PAIEMENT)
 *   Retourne les fiches prêtes à payer avec total
 *
 * PATCH /api/admin/rh/paie/ordres-paiement
 *   Body: { ids: number[], modePaiement?, action? }
 *   action:
 *     "METTRE_EN_PAIEMENT" → VALIDE → EN_PAIEMENT (entrée dans la file de paiement)
 *     "AFFECTER"           → affecte le mode sans payer (reste EN_PAIEMENT)
 *     "PAYER" (défaut)     → EN_PAIEMENT → PAYE
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

    const userId = parseInt(session.user.id);
    const idNums = ids.map(Number);

    let updated: { count: number };
    let auditAction: string;
    let auditDetails: Record<string, unknown>;

    if (action === "METTRE_EN_PAIEMENT") {
      // VALIDE → EN_PAIEMENT (mise dans la file de paiement, mode optionnel).
      updated = await prisma.fichePaie.updateMany({
        where: { id: { in: idNums }, statut: "VALIDE" },
        data:  {
          statut:             "EN_PAIEMENT",
          misEnPaiementParId: userId,
          dateMiseEnPaiement: new Date(),
          modePaiement:       modePaiement ?? null,
        },
      });
      auditAction  = "METTRE_EN_PAIEMENT";
      auditDetails = { avant: { statut: "VALIDE" }, apres: { statut: "EN_PAIEMENT" } };
    } else if (action === "AFFECTER") {
      // Affecte le mode sans payer (la fiche reste EN_PAIEMENT, bascule dans la bonne liste).
      if (!modePaiement) {
        return NextResponse.json({ error: "modePaiement est obligatoire pour l'affectation" }, { status: 400 });
      }
      updated = await prisma.fichePaie.updateMany({
        where: { id: { in: idNums }, statut: "EN_PAIEMENT" },
        data:  { modePaiement },
      });
      auditAction  = "AFFECTER_MODE_PAIEMENT";
      auditDetails = { apres: { modePaiement } };
    } else {
      // PAYER (défaut) : EN_PAIEMENT → PAYE.
      updated = await prisma.fichePaie.updateMany({
        where: { id: { in: idNums }, statut: "EN_PAIEMENT" },
        data:  { statut: "PAYE", modePaiement: modePaiement ?? null },
      });
      auditAction  = "MARQUER_PAYE";
      auditDetails = { avant: { statut: "EN_PAIEMENT" }, apres: { statut: "PAYE", modePaiement } };
    }

    await prisma.auditLog.createMany({
      data: idNums.map((id: number) => ({
        userId,
        action:   auditAction,
        entite:   "FichePaie",
        entiteId: id,
        details:  JSON.parse(JSON.stringify(auditDetails)),
      })),
    });

    return NextResponse.json({ data: { count: updated.count } });
  } catch (error) {
    console.error("PATCH /api/admin/rh/paie/ordres-paiement", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
