import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { enregistrerChangementPrix } from "@/lib/prixProduit";
import { chargerParametragePrixAuto, calculerPrixAuto, upsertPrixAuto } from "@/lib/tarification";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/catalogue/produits/[id]/prix-auto (Enterprise #6)
 * Recalcule les prix (revient / détail / crédit) à partir du coût d'achat et du
 * paramétrage du moteur. `?apply=1` applique (met à jour Produit + lignes AUTO) ;
 * sinon renvoie seulement l'aperçu du calcul. — admin.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({
    where: { id: produitId }, select: { id: true, prixAchat: true, prixUnitaire: true },
  });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // Coût d'achat : fourni (simulation) ou celui du produit.
  const coutAchat = body?.coutAchat != null && body.coutAchat !== "" ? Number(body.coutAchat) : (produit.prixAchat != null ? Number(produit.prixAchat) : null);
  if (coutAchat == null || isNaN(coutAchat) || coutAchat <= 0) {
    return NextResponse.json({ message: "Prix d'achat requis pour le calcul automatique" }, { status: 400 });
  }

  const param = await chargerParametragePrixAuto();
  const calcul = calculerPrixAuto(coutAchat, param);

  const url = new URL(req.url);
  const apply = url.searchParams.get("apply") === "1";
  if (!apply) {
    return NextResponse.json({ data: { calcul, applique: false, actifMoteur: param.actif } });
  }

  const userId = Number(session.user.id);
  await prisma.$transaction(async (tx) => {
    // Prix de vente (détail) → Produit.prixUnitaire + ligne AUTO DETAIL globale.
    await tx.produit.update({ where: { id: produitId }, data: { prixUnitaire: new Prisma.Decimal(calcul.prixVente) } });
    await upsertPrixAuto(tx, produitId, "DETAIL", calcul.prixVente, userId);
    await upsertPrixAuto(tx, produitId, "REVIENT", calcul.prixRevient, userId);
    if (calcul.prixCredit != null) await upsertPrixAuto(tx, produitId, "CREDIT", calcul.prixCredit, userId);

    await enregistrerChangementPrix(tx, {
      produitId, nouveauPrixVente: calcul.prixVente, source: "MANUEL",
      motif: "Recalcul automatique (moteur de prix)", userId,
    });
    await auditLog(tx, userId, "PRIX_AUTO_APPLIQUE", "Produit", produitId);
  });

  return NextResponse.json({ data: { calcul, applique: true } });
}
