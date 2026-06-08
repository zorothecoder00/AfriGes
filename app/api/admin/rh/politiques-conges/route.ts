import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeConge } from "@prisma/client";

/**
 * GET /api/admin/rh/politiques-conges
 * Liste toutes les politiques de congé
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const politiques = await prisma.politiqueConge.findMany({
      orderBy: { type: "asc" },
    });

    return NextResponse.json({ data: politiques });
  } catch (error) {
    console.error("GET /api/admin/rh/politiques-conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/politiques-conges
 * Crée ou met à jour une politique (upsert par type)
 *
 * Body: { type, joursParAn, reportable?, joursMaxReport?, description? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, joursParAn, reportable, joursMaxReport, description, actif } = body;

    if (!type || joursParAn === undefined) {
      return NextResponse.json({ error: "type et joursParAn sont obligatoires" }, { status: 400 });
    }

    const politique = await prisma.politiqueConge.upsert({
      where: { type: type as TypeConge },
      create: {
        type:          type as TypeConge,
        joursParAn:    Number(joursParAn),
        reportable:    reportable    ?? false,
        joursMaxReport:joursMaxReport ? Number(joursMaxReport) : 0,
        description:   description   ?? null,
        actif:         actif         ?? true,
      },
      update: {
        joursParAn:    Number(joursParAn),
        reportable:    reportable    ?? false,
        joursMaxReport:joursMaxReport ? Number(joursMaxReport) : 0,
        description:   description   ?? null,
        actif:         actif         ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:  parseInt(session.user.id),
        action:  "UPSERT",
        entite:  "PolitiqueConge",
        entiteId: politique.id,
        details: `Politique ${type} : ${joursParAn}j/an`,
      },
    });

    return NextResponse.json({ data: politique }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/politiques-conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
