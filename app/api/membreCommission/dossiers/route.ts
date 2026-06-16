import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";

// Dossiers inter-commissions liés aux commissions du membre connecté
export async function GET(req: NextRequest) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.session.user.id);
    const { searchParams } = new URL(req.url);
    const sens   = searchParams.get("sens");   // "emis" | "recus"
    const statut = searchParams.get("statut");

    const memberships = await prisma.membreCommissionRIA.findMany({
      where: { userId, actif: true },
      select: { typeCommission: true },
    });
    const types = memberships.map((m) => m.typeCommission);

    const dossiers = await prisma.dossierInterCommission.findMany({
      where: {
        ...(sens === "emis"  ? { commissionEmettrice:  { in: types } } : {}),
        ...(sens === "recus" ? { commissionReceptrice: { in: types } } : {}),
        ...(sens === null    ? { OR: [{ commissionEmettrice: { in: types } }, { commissionReceptrice: { in: types } }] } : {}),
        ...(statut           ? { statut: statut as never }              : {}),
      },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count:  { select: { echanges: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ dossiers });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
