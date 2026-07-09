import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

/**
 * GET /api/admin/catalogue/fournisseurs
 * Liste simple des fournisseurs actifs (pour les listes déroulantes du catalogue).
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const data = await prisma.fournisseur.findMany({
    where: { actif: true },
    orderBy: { nom: "asc" },
    select: { id: true, nom: true },
  });
  return NextResponse.json({ data });
}
