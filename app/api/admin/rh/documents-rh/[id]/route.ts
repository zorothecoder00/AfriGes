import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/documents-rh/[id]
 * Met à jour un document RH généré (fileUrl, notes, archive)
 *
 * Body: { fileUrl?, notes?, archive? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { fileUrl, notes, archive } = body;

    const doc = await prisma.documentRHGenere.findUnique({ where: { id: Number(id) } });
    if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (fileUrl  !== undefined) updateData.fileUrl  = fileUrl  ?? null;
    if (notes    !== undefined) updateData.notes    = notes    ?? null;
    if (archive  !== undefined) updateData.archive  = Boolean(archive);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    const updated = await prisma.documentRHGenere.update({
      where: { id: Number(id) },
      data:  updateData,
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
        action:   "UPDATE",
        entite:   "DocumentRHGenere",
        entiteId: updated.id,
        details:  archive !== undefined
          ? `Doc RH #${id} ${archive ? "archivé" : "désarchivé"}`
          : `Doc RH #${id} mis à jour`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/documents-rh/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
