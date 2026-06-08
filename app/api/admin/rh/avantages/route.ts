import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeAvantageRH } from "@prisma/client";

/**
 * GET /api/admin/rh/avantages
 * Query: profilRHId, actif, type
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const profilRHId = searchParams.get("profilRHId");
    const actifParam = searchParams.get("actif");
    const type       = searchParams.get("type") as TypeAvantageRH | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (profilRHId)         where.profilRHId = Number(profilRHId);
    if (type)               where.type       = type;
    if (actifParam !== null) where.actif     = actifParam !== "false";

    const avantages = await prisma.avantageRH.findMany({
      where,
      orderBy: [{ actif: "desc" }, { dateDebut: "desc" }],
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { id: true, nom: true, prenom: true } } } },
          },
        },
      },
    });

    return NextResponse.json({ data: avantages });
  } catch (error) {
    console.error("GET /api/admin/rh/avantages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/avantages
 * Body: { profilRHId, type, libelle, montantMensuel, dateDebut, dateFin?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, libelle, montantMensuel, dateDebut, dateFin, notes } = body;

    if (!profilRHId || !type || !libelle || !dateDebut) {
      return NextResponse.json({ error: "profilRHId, type, libelle et dateDebut sont obligatoires" }, { status: 400 });
    }

    const avantage = await prisma.avantageRH.create({
      data: {
        profilRHId:     Number(profilRHId),
        type:           type as TypeAvantageRH,
        libelle,
        montantMensuel: Number(montantMensuel ?? 0),
        dateDebut:      new Date(dateDebut),
        dateFin:        dateFin ? new Date(dateFin) : null,
        notes:          notes   ?? null,
        actif:          true,
      },
    });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "CREATE", entite: "AvantageRH", entiteId: avantage.id, details: `Avantage ${type} créé pour profilRH #${profilRHId}` },
    });

    return NextResponse.json({ data: avantage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/avantages", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
