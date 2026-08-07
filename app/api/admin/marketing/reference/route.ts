import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/reference
 * Données de référence pour les formulaires du module (PDV, produits,
 * familles, utilisateurs) — un seul appel pour peupler les sélecteurs de
 * création/édition de campagne.
 */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const [pdvs, produits, familles, utilisateurs, tags, promotions, evenements, coupons] = await Promise.all([
    prisma.pointDeVente.findMany({ where: { actif: true }, select: { id: true, nom: true, code: true }, orderBy: { nom: "asc" } }),
    prisma.produit.findMany({ where: { actif: true }, select: { id: true, nom: true, familleId: true }, orderBy: { nom: "asc" }, take: 500 }),
    prisma.familleProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.user.findMany({ where: { etat: "ACTIF" }, select: { id: true, nom: true, prenom: true }, orderBy: { nom: "asc" } }),
    prisma.tag.findMany({ where: { actif: true }, select: { id: true, nom: true, couleur: true }, orderBy: { nom: "asc" } }),
    prisma.promotion.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.evenementMarketing.findMany({ select: { id: true, nom: true }, orderBy: { dateDebut: "desc" }, take: 100 }),
    prisma.coupon.findMany({ where: { actif: true }, select: { id: true, code: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);

  return NextResponse.json({ data: { pdvs, produits, familles, utilisateurs, tags, promotions, evenements, coupons } });
}
