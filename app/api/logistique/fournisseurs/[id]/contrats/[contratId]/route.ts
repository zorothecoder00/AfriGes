import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { getSession } from "../../../route";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string; contratId: string }> };

/**
 * PATCH /api/logistique/fournisseurs/[id]/contrats/[contratId]
 * Body: { titre?, reference?, dateDebut?, dateFin?, fichierUrl?, notes? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { contratId } = await params;
    const existing = await prisma.contratFournisseur.findUnique({ where: { id: Number(contratId) } });
    if (!existing) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

    const body = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if ("titre" in body) data.titre = String(body.titre).trim();
    if ("reference" in body) data.reference = body.reference || null;
    if ("dateDebut" in body) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null;
    if ("dateFin" in body) data.dateFin = body.dateFin ? new Date(body.dateFin) : null;
    if ("fichierUrl" in body) data.fichierUrl = body.fichierUrl || null;
    if ("notes" in body) data.notes = body.notes || null;

    const updated = await prisma.contratFournisseur.update({ where: { id: Number(contratId) }, data });
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /logistique/fournisseurs/[id]/contrats/[contratId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/logistique/fournisseurs/[id]/contrats/[contratId]
 * Soft delete (CDC §15 — aucune suppression physique) : marque actif=false.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { contratId } = await params;
    const existing = await prisma.contratFournisseur.findUnique({ where: { id: Number(contratId) } });
    if (!existing) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.contratFournisseur.update({ where: { id: Number(contratId) }, data: { actif: false } });
      await auditLog(tx, parseInt(session.user.id), "CONTRAT_FOURNISSEUR_ARCHIVE", "ContratFournisseur", Number(contratId), undefined, getRequestMeta(req));
    });

    return NextResponse.json({ data: { id: Number(contratId) } });
  } catch (error) {
    console.error("DELETE /logistique/fournisseurs/[id]/contrats/[contratId]:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
