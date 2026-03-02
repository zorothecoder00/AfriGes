// app/api/comptable/pieces/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

const ARCHIVE_YEARS = 10;

/**
 * GET /api/comptable/pieces?sourceType=&sourceId=
 *   → Liste les pièces justificatives d'une écriture
 *   Accès : COMPTABLE, AUDITEUR_INTERNE, ADMIN, SUPER_ADMIN
 *
 * GET /api/comptable/pieces?all=1&search=&sourceType=&page=&limit=
 *   → Liste globale de toutes les pièces (onglet archive)
 */
export async function GET(req: Request) {
  try {
    // Accepter COMPTABLE ou AUDITEUR
    const session = (await getComptableSession()) ?? (await getAuditeurInterneSession());
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const isAll = searchParams.get("all") === "1";

    if (isAll) {
      // ── Vue globale (onglet Pièces) ───────────────────────────────────
      const page       = Math.max(1, Number(searchParams.get("page")  ?? "1"));
      const limit      = Math.min(50, Math.max(10, Number(searchParams.get("limit") ?? "20")));
      const search     = (searchParams.get("search") ?? "").trim();
      const srcType    = searchParams.get("sourceType") ?? "";
      const dateDebut  = searchParams.get("dateDebut");
      const dateFin    = searchParams.get("dateFin");

      const where: Record<string, unknown> = {};
      if (srcType)   where.sourceType = srcType;
      if (search)    where.nom = { contains: search, mode: "insensitive" };
      if (dateDebut || dateFin) {
        where.createdAt = {
          ...(dateDebut ? { gte: new Date(dateDebut) } : {}),
          ...(dateFin   ? { lte: new Date(new Date(dateFin).setHours(23, 59, 59, 999)) } : {}),
        };
      }

      const [total, pieces] = await Promise.all([
        prisma.pieceJustificative.count({ where }),
        prisma.pieceJustificative.findMany({
          where,
          include: { uploadeUser: { select: { nom: true, prenom: true } } },
          orderBy:  { createdAt: "desc" },
          skip:    (page - 1) * limit,
          take:    limit,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data:    pieces,
        meta:    { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    }

    // ── Vue par écriture ──────────────────────────────────────────────
    const sourceType = searchParams.get("sourceType") ?? "";
    const sourceId   = Number(searchParams.get("sourceId") ?? "0");

    if (!sourceType || !sourceId) {
      return NextResponse.json({ success: false, message: "sourceType et sourceId requis" }, { status: 400 });
    }

    const pieces = await prisma.pieceJustificative.findMany({
      where:   { sourceType, sourceId },
      include: { uploadeUser: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, data: pieces });
  } catch (error) {
    console.error("PIECES GET ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/pieces
 * body: { sourceType, sourceId, nom, url, uploadthingKey, type, taille, description? }
 * Accès : COMPTABLE, ADMIN, SUPER_ADMIN uniquement (pas AUDITEUR)
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { sourceType, sourceId, nom, url, uploadthingKey, type, taille, description } = body;

    if (!sourceType || !sourceId || !nom || !url || !uploadthingKey || !type || !taille) {
      return NextResponse.json({ success: false, message: "Champs obligatoires manquants" }, { status: 400 });
    }

    const archiverJusquau = new Date();
    archiverJusquau.setFullYear(archiverJusquau.getFullYear() + ARCHIVE_YEARS);

    const piece = await prisma.pieceJustificative.create({
      data: {
        nom,
        url,
        uploadthingKey,
        type,
        taille:         Number(taille),
        sourceType,
        sourceId:       Number(sourceId),
        description:    typeof description === "string" && description.trim() ? description.trim() : null,
        uploadePar:     Number(session.user.id),
        archiverJusquau,
      },
      include: { uploadeUser: { select: { nom: true, prenom: true } } },
    });

    return NextResponse.json({ success: true, data: piece }, { status: 201 });
  } catch (error) {
    console.error("PIECES POST ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
