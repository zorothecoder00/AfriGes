import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { statsAchatsRevendeur } from "@/lib/revendeur";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/revendeurs/[id]/releve — "Relevé de compte" / "État des achats" (vue Admin/RVC). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const profil = await prisma.profilRevendeur.findUnique({ where: { id: Number(id) }, select: { userId: true } });
    if (!profil) return NextResponse.json({ error: "Revendeur introuvable" }, { status: 404 });

    const factures = await prisma.factureVente.findMany({
      where: { revendeurId: profil.userId },
      orderBy: { dateEmission: "desc" },
      select: { id: true, numero: true, statut: true, dateEmission: true, montantTTC: true, montantPaye: true },
    });
    const stats = await statsAchatsRevendeur(profil.userId);
    return NextResponse.json({ data: factures, stats });
  } catch (error) {
    console.error("GET /admin/revendeurs/[id]/releve:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
