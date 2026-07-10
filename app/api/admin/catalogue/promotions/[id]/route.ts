import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { validerPromotion } from "@/lib/promotionValidation";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Promotion (Catalogue §9) — Phase 5.
 * GET    — détail d'une promotion (pour édition) — admin.
 * PATCH  — met à jour la promotion (état complet re-validé) — admin.
 * DELETE — supprime la promotion — admin.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const promo = await prisma.promotion.findUnique({
    where: { id },
    include: {
      produit: { select: { id: true, nom: true, codeProduit: true } },
      categorie: { select: { id: true, nom: true } },
      famille: { select: { id: true, nom: true } },
      marque: { select: { id: true, nom: true } },
      pointDeVente: { select: { id: true, nom: true } },
      client: { select: { id: true, nom: true, prenom: true } },
    },
  });
  if (!promo) return NextResponse.json({ message: "Promotion introuvable" }, { status: 404 });

  return NextResponse.json({ data: { ...promo, valeur: Number(promo.valeur) } });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: "Promotion introuvable" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  // Activation/désactivation rapide (toggle) sans revalider tout le formulaire.
  if (Object.keys(body).length === 1 && typeof body.actif === "boolean") {
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.promotion.update({ where: { id }, data: { actif: body.actif as boolean }, select: { id: true, actif: true } });
      await auditLog(tx, Number(session.user.id), body.actif ? "PROMOTION_ACTIVEE" : "PROMOTION_DESACTIVEE", "Promotion", id);
      return p;
    });
    return NextResponse.json({ data: updated });
  }

  const valid = await validerPromotion(body);
  if ("error" in valid) return NextResponse.json({ message: valid.error }, { status: valid.status });

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.promotion.update({ where: { id }, data: valid.data, select: { id: true, code: true, nom: true, actif: true } });
    await auditLog(tx, Number(session.user.id), "PROMOTION_MODIFIEE", "Promotion", id);
    return p;
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const id = Number((await params).id);
  if (!id) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const existing = await prisma.promotion.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ message: "Promotion introuvable" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.promotion.delete({ where: { id } });
    await auditLog(tx, Number(session.user.id), "PROMOTION_SUPPRIMEE", "Promotion", id);
  });
  return NextResponse.json({ ok: true });
}
