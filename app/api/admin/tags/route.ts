import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { SegmentClient } from "@prisma/client";

/**
 * GET /api/admin/tags
 * Liste tous les tags (avec comptage de clients).
 * Query: segment (ORDINAIRE|RIA), actif (true|false)
 */
export async function GET(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const segmentParam = searchParams.get("segment");
    const actifParam   = searchParams.get("actif");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (segmentParam) where.segment = segmentParam as SegmentClient;
    if (actifParam !== null && actifParam !== "") where.actif = actifParam !== "false";

    const tags = await prisma.tag.findMany({
      where,
      orderBy: { nom: "asc" },
      include: {
        _count: { select: { clients: true } },
      },
    });

    return NextResponse.json({ data: tags });
  } catch (error) {
    console.error("GET /api/admin/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/tags
 * Créer un nouveau tag.
 * Body: { nom, couleur?, description?, segment? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, couleur, description, segment } = body;

    if (!nom?.trim()) {
      return NextResponse.json({ error: "Le nom du tag est obligatoire" }, { status: 400 });
    }

    // Vérifier unicité du nom (case-insensitive en applicatif)
    const existing = await prisma.tag.findUnique({ where: { nom: nom.trim() } });
    if (existing) {
      return NextResponse.json({ error: `Un tag "${nom.trim()}" existe déjà` }, { status: 409 });
    }

    const tag = await prisma.tag.create({
      data: {
        nom:         nom.trim(),
        couleur:     couleur     || "#6366f1",
        description: description || null,
        segment:     segment     || null,
        actif:       true,
      },
      include: { _count: { select: { clients: true } } },
    });

    return NextResponse.json({ data: tag }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/tags:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
