import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; prixId: string }> };

/**
 * PATCH  /api/admin/catalogue/produits/[id]/prix/[prixId] — montant / dates / actif — admin.
 * DELETE — supprime une ligne de prix — admin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { id, prixId } = await params;
  const produitId = Number(id);
  const ligneId = Number(prixId);
  if (!produitId || !ligneId) return NextResponse.json({ message: "Requête invalide" }, { status: 400 });

  const ligne = await prisma.prixProduit.findFirst({
    where: { id: ligneId, produitId }, select: { id: true, type: true, portee: true },
  });
  if (!ligne) return NextResponse.json({ message: "Ligne de prix introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const data: Prisma.PrixProduitUpdateInput = {};
  if (body?.montant != null) {
    const m = Number(body.montant);
    if (isNaN(m) || m < 0) return NextResponse.json({ message: "Montant invalide" }, { status: 400 });
    data.montant = new Prisma.Decimal(m);
  }
  if (typeof body?.actif === "boolean") data.actif = body.actif;
  if (body?.dateDebut !== undefined) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null;
  if (body?.dateFin !== undefined) data.dateFin = body.dateFin ? new Date(body.dateFin) : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ message: "Aucune modification" }, { status: 400 });

  const userId = Number(session.user.id);
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.prixProduit.update({
      where: { id: ligneId }, data,
      select: { id: true, type: true, montant: true, portee: true, actif: true },
    });
    // Miroir legacy pour le prix global DÉTAIL/ACHAT (cohérence ventes/crédits existants).
    if (data.montant != null && ligne.portee === "GLOBAL") {
      if (ligne.type === "DETAIL") await tx.produit.update({ where: { id: produitId }, data: { prixUnitaire: new Prisma.Decimal(Number(body.montant)) } });
      if (ligne.type === "ACHAT")  await tx.produit.update({ where: { id: produitId }, data: { prixAchat: new Prisma.Decimal(Number(body.montant)) } });
    }
    await auditLog(tx, userId, "PRIX_PRODUIT_MODIFIE", "Produit", produitId);
    return u;
  });

  return NextResponse.json({ data: { ...updated, montant: Number(updated.montant) } });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { id, prixId } = await params;
  const produitId = Number(id);
  const ligneId = Number(prixId);
  if (!produitId || !ligneId) return NextResponse.json({ message: "Requête invalide" }, { status: 400 });

  const ligne = await prisma.prixProduit.findFirst({ where: { id: ligneId, produitId }, select: { id: true } });
  if (!ligne) return NextResponse.json({ message: "Ligne de prix introuvable" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.prixProduit.delete({ where: { id: ligneId } });
    await auditLog(tx, Number(session.user.id), "PRIX_PRODUIT_SUPPRIME", "Produit", produitId);
  });
  return NextResponse.json({ data: { id: ligneId } });
}
