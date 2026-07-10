import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ subId: string }> };

/**
 * Lien de substitution (Catalogue Ent.#4) — admin.
 * PATCH  — met à jour priorité / bidirectionnel / note.
 * DELETE — supprime le lien de substitution.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const subId = Number((await params).subId);
  if (!subId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const lien = await prisma.produitSubstitut.findUnique({ where: { id: subId }, select: { id: true, produitId: true } });
  if (!lien) return NextResponse.json({ message: "Lien introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.priorite !== undefined) data.priorite = Number(body.priorite) || 0;
  if (body.bidirectionnel !== undefined) data.bidirectionnel = Boolean(body.bidirectionnel);
  if (body.note !== undefined) data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const updated = await prisma.$transaction(async (tx) => {
    const l = await tx.produitSubstitut.update({ where: { id: subId }, data, select: { id: true, priorite: true, bidirectionnel: true, note: true } });
    await auditLog(tx, Number(session.user.id), "SUBSTITUT_MODIFIE", "Produit", lien.produitId);
    return l;
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const subId = Number((await params).subId);
  if (!subId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const lien = await prisma.produitSubstitut.findUnique({ where: { id: subId }, select: { id: true, produitId: true } });
  if (!lien) return NextResponse.json({ message: "Lien introuvable" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.produitSubstitut.delete({ where: { id: subId } });
    await auditLog(tx, Number(session.user.id), "SUBSTITUT_SUPPRIME", "Produit", lien.produitId);
  });
  return NextResponse.json({ ok: true });
}
