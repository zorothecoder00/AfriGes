import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeDocumentCollaborateur } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/rh/collaborateurs/[id]/documents
 * Liste les documents d'un collaborateur
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const documents = await prisma.documentCollaborateur.findMany({
      where: { profilRHId: Number(id) },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error("GET /api/admin/rh/collaborateurs/[id]/documents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/collaborateurs/[id]/documents
 * Ajoute un document au dossier (versioning automatique par type)
 *
 * Body: { type, nom, fileUrl, notes? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { type, nom, fileUrl, notes } = body;

    if (!type || !nom || !fileUrl) {
      return NextResponse.json({ error: "type, nom et fileUrl sont obligatoires" }, { status: 400 });
    }

    const profilRH = await prisma.profilRH.findUnique({ where: { id: Number(id) } });
    if (!profilRH) return NextResponse.json({ error: "Collaborateur introuvable" }, { status: 404 });

    // Calcul version : la plus haute version du même type + 1
    const lastDoc = await prisma.documentCollaborateur.findFirst({
      where: { profilRHId: Number(id), type: type as TypeDocumentCollaborateur },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (lastDoc?.version ?? 0) + 1;

    const doc = await prisma.documentCollaborateur.create({
      data: {
        profilRHId: Number(id),
        type:       type as TypeDocumentCollaborateur,
        nom,
        fileUrl,
        version,
        notes:      notes ?? null,
        uploadePar: parseInt(session.user.id),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "CREATE",
        entite:   "DocumentCollaborateur",
        entiteId: doc.id,
        details:  `Document "${nom}" (${type} v${version}) ajouté au dossier #${id}`,
      },
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/collaborateurs/[id]/documents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
