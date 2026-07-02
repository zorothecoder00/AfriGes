import { NextResponse } from "next/server";
import { RoleGestionnaire } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

/**
 * GET /api/admin/credits/gestionnaires
 * Liste des RVC (Responsable Vente Crédit) actifs — candidats « gestionnaire du crédit »
 * pour le bordereau. Accessible Admin + RVC.
 */
export async function GET() {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const data = await prisma.user.findMany({
      where: { gestionnaire: { role: RoleGestionnaire.RESPONSABLE_VENTE_CREDIT, actif: true } },
      select: { id: true, nom: true, prenom: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/admin/credits/gestionnaires", error);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
