import { NextRequest, NextResponse } from "next/server";
import { StatutDocumentStrategique } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRHSession } from "@/lib/authRH";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/documents-strategiques/[id]
 * Met à jour un document. Champs éditables + changement de statut.
 * Passer statut=EN_VIGUEUR archive automatiquement les autres versions en vigueur du même type.
 * Body: { titre?, reference?, description?, contenu?, fichierUrl?, dateEffet?, statut? }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getRHSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { id } = await params;
    const docId = Number(id);
    const body = await req.json();

    const current = await prisma.documentStrategiqueRH.findUnique({ where: { id: docId } });
    if (!current) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    const { titre, reference, description, contenu, fichierUrl, dateEffet, statut } = body ?? {};
    const nextStatut = statut as StatutDocumentStrategique | undefined;

    const data: Record<string, unknown> = {};
    if (titre !== undefined)       data.titre = String(titre).trim();
    if (reference !== undefined)   data.reference = reference?.trim() || null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (contenu !== undefined)     data.contenu = contenu || null;
    if (fichierUrl !== undefined)  data.fichierUrl = fichierUrl?.trim() || null;
    if (dateEffet !== undefined)   data.dateEffet = dateEffet ? new Date(dateEffet) : null;
    if (nextStatut !== undefined)  data.statut = nextStatut;

    const updated = await prisma.$transaction(async (tx) => {
      // Une seule version EN_VIGUEUR par type.
      if (nextStatut === "EN_VIGUEUR") {
        await tx.documentStrategiqueRH.updateMany({
          where: { type: current.type, statut: "EN_VIGUEUR", id: { not: docId } },
          data:  { statut: "ARCHIVE" },
        });
      }
      return tx.documentStrategiqueRH.update({ where: { id: docId }, data });
    });

    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "UPDATE",
        entite:   "DocumentStrategiqueRH",
        entiteId: docId,
        details:  `MàJ ${current.type} v${current.version}${nextStatut ? ` → ${nextStatut}` : ""}`,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/documents-strategiques/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/documents-strategiques/[id]
 * Supprime définitivement un document stratégique.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getRHSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { id } = await params;
    const docId = Number(id);
    const current = await prisma.documentStrategiqueRH.findUnique({ where: { id: docId }, select: { id: true, type: true, version: true } });
    if (!current) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

    await prisma.documentStrategiqueRH.delete({ where: { id: docId } });
    await prisma.auditLog.create({
      data: {
        userId:   parseInt(session.user.id),
        action:   "DELETE",
        entite:   "DocumentStrategiqueRH",
        entiteId: docId,
        details:  `Suppression ${current.type} v${current.version}`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/rh/documents-strategiques/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
