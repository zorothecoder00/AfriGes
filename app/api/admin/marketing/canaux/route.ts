import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET/POST /api/admin/marketing/canaux
 * Référentiel paramétrable sans code (CDC §21, §81) : canaux marketing.
 */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const canaux = await prisma.canalMarketing.findMany({ orderBy: [{ ordre: "asc" }, { libelle: "asc" }] });
  return NextResponse.json({ data: canaux });
}

export async function POST(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "CREATION");
  if (denied) return denied;

  const { code, libelle, ordre } = await req.json();
  if (!code || !libelle) return NextResponse.json({ error: "code et libelle requis" }, { status: 400 });

  try {
    const canal = await prisma.canalMarketing.create({
      data: { code: String(code).toUpperCase().replace(/\s+/g, "_"), libelle, ordre: ordre ? Number(ordre) : 0 },
    });
    return NextResponse.json({ data: canal }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
  }
}
