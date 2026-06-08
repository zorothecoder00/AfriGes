import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeDocumentRHGenere } from "@prisma/client";

/**
 * GET /api/admin/rh/documents-rh
 * Liste les documents RH générés avec filtres
 *
 * Query: type, profilRHId, archive (true|false, défaut false), search, page, limit
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type         = searchParams.get("type")         as TypeDocumentRHGenere | null;
    const profilRHId   = searchParams.get("profilRHId");
    const archiveParam = searchParams.get("archive");
    const search       = searchParams.get("search")?.trim() ?? "";
    const page         = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit        = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip         = (page - 1) * limit;

    // Par défaut on n'affiche pas les archivés sauf si explicitement demandé
    const archive = archiveParam === "true" ? true : archiveParam === "all" ? undefined : false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type)       where.type       = type;
    if (profilRHId) where.profilRHId = Number(profilRHId);
    if (archive !== undefined) where.archive = archive;
    if (search) {
      where.OR = [
        { titre:    { contains: search, mode: "insensitive" } },
        {
          profilRH: {
            gestionnaire: {
              member: {
                OR: [
                  { nom:    { contains: search, mode: "insensitive" } },
                  { prenom: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ];
    }

    const [documents, total, statsType] = await Promise.all([
      prisma.documentRHGenere.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          profilRH: {
            select: {
              id: true, matricule: true,
              gestionnaire: {
                select: { member: { select: { id: true, nom: true, prenom: true, photo: true } } },
              },
            },
          },
        },
      }),
      prisma.documentRHGenere.count({ where }),
      // Stats par type (tous, archives inclus)
      prisma.documentRHGenere.groupBy({
        by: ["type"],
        _count: { id: true },
        where: { archive: false },
      }),
    ]);

    const statsMap = Object.fromEntries(statsType.map((s) => [s.type, s._count.id]));

    return NextResponse.json({
      data: documents,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: statsMap,
    });
  } catch (error) {
    console.error("GET /api/admin/rh/documents-rh", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/documents-rh
 * Enregistre un nouveau document RH généré pour un collaborateur
 *
 * Body: { profilRHId, type, titre, fileUrl?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { profilRHId, type, titre, fileUrl, notes } = body;

    if (!profilRHId || !type || !titre) {
      return NextResponse.json(
        { error: "profilRHId, type et titre sont obligatoires" },
        { status: 400 }
      );
    }

    const profil = await prisma.profilRH.findUnique({ where: { id: Number(profilRHId) } });
    if (!profil) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Versionning : +1 par rapport au dernier du même type pour ce collaborateur
    const lastDoc = await prisma.documentRHGenere.findFirst({
      where:   { profilRHId: Number(profilRHId), type: type as TypeDocumentRHGenere },
      orderBy: { version: "desc" },
      select:  { version: true },
    });
    const version = (lastDoc?.version ?? 0) + 1;

    const doc = await prisma.documentRHGenere.create({
      data: {
        profilRHId: Number(profilRHId),
        type:       type as TypeDocumentRHGenere,
        titre,
        version,
        fileUrl:   fileUrl  ?? null,
        generePar: parseInt(session.user.id),
        notes:     notes    ?? null,
        archive:   false,
      },
      include: {
        profilRH: {
          select: {
            id: true, matricule: true,
            gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentRHGenere",
        entiteId: doc.id,
        details:  `Doc RH ${type} v${version} créé pour profilRH #${profilRHId}`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/documents-rh", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
