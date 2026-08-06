import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/assets — bibliothèque de contenu (CDC §29).
 * Filtres : categorie, tag, campagneId.
 */
export async function GET(req: NextRequest) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const categorie = sp.get("categorie");
  const tag = sp.get("tag");
  const campagneId = sp.get("campagneId");

  const assets = await prisma.assetMarketing.findMany({
    where: {
      ...(categorie ? { categorie: categorie as never } : {}),
      ...(tag ? { tags: { has: tag } } : {}),
      ...(campagneId ? { campagnes: { some: { campagneId: Number(campagneId) } } } : {}),
    },
    include: {
      uploadePar: { select: { id: true, nom: true, prenom: true } },
      campagnes: { include: { campagne: { select: { id: true, code: true, nom: true } } } },
      _count: { select: { publications: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: assets });
}

/**
 * POST /api/admin/marketing/assets
 * Body: { nom, categorie, url, uploadthingKey?, type?, taille?, tags?, droitsUtilisation?, campagneIds? }
 * Enregistre un fichier déjà uploadé via uploadthing (endpoint contenuMarketingMedia).
 */
export async function POST(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "CREATION");
  if (denied) return denied;

  const body = await req.json();
  const { nom, categorie, url, uploadthingKey, type, taille, tags, droitsUtilisation, campagneIds } = body;
  if (!nom || !categorie || !url) {
    return NextResponse.json({ error: "nom, categorie et url sont requis" }, { status: 400 });
  }

  const asset = await prisma.assetMarketing.create({
    data: {
      nom, categorie, url,
      uploadthingKey: uploadthingKey || null,
      type: type || null,
      taille: taille != null ? Number(taille) : null,
      tags: Array.isArray(tags) ? tags : [],
      droitsUtilisation: droitsUtilisation || null,
      uploadeParId: Number(session.user.id),
      campagnes: campagneIds?.length
        ? { create: (campagneIds as number[]).map((id) => ({ campagneId: Number(id) })) }
        : undefined,
    },
    include: { campagnes: { include: { campagne: { select: { id: true, nom: true } } } } },
  });
  return NextResponse.json({ data: asset }, { status: 201 });
}
