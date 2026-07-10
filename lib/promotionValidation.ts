import { Prisma, CiblePromotion, TypeRemisePromotion, SegmentClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TYPES_REMISE, CIBLES_PROMOTION } from "@/lib/promotions";

/**
 * Validation & normalisation d'une promotion (Catalogue §9), mutualisée entre la
 * création (POST) et l'édition (PATCH). Le corps représente l'état complet visé.
 * Renvoie soit `{ error, status }`, soit `{ data }` prêt pour Prisma
 * (hors `code` et `creeParId`, gérés par l'appelant).
 */

const SEGMENTS = ["ORDINAIRE", "RIA"] as const;

type PromotionData = {
  nom: string;
  description: string | null;
  cible: CiblePromotion;
  produitId: number | null;
  categorieId: number | null;
  familleId: number | null;
  marqueId: number | null;
  typeRemise: TypeRemisePromotion;
  valeur: Prisma.Decimal;
  lotAchete: number | null;
  lotPaye: number | null;
  pointDeVenteId: number | null;
  segment: SegmentClient | null;
  clientId: number | null;
  dateDebut: Date;
  dateFin: Date;
  actif: boolean;
  priorite: number;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function validerPromotion(
  body: Record<string, unknown>,
): Promise<{ error: string; status: number } | { data: PromotionData }> {
  const nom = typeof body.nom === "string" ? body.nom.trim() : "";
  if (!nom) return { error: "Le nom de la promotion est requis", status: 400 };

  const cible = body.cible as CiblePromotion;
  if (!CIBLES_PROMOTION.includes(cible)) return { error: "Périmètre (cible) invalide", status: 400 };

  const typeRemise = body.typeRemise as TypeRemisePromotion;
  if (!TYPES_REMISE.includes(typeRemise)) return { error: "Type de remise invalide", status: 400 };

  // ── Périmètre produit : l'id correspondant à la cible est requis ───────────
  let produitId: number | null = null, categorieId: number | null = null;
  let familleId: number | null = null, marqueId: number | null = null;
  if (cible === "PRODUIT") {
    produitId = num(body.produitId);
    if (!produitId) return { error: "Sélectionnez le produit ciblé", status: 400 };
  } else if (cible === "CATEGORIE") {
    categorieId = num(body.categorieId);
    if (!categorieId) return { error: "Sélectionnez la catégorie ciblée", status: 400 };
  } else if (cible === "FAMILLE") {
    familleId = num(body.familleId);
    if (!familleId) return { error: "Sélectionnez la famille ciblée", status: 400 };
  } else if (cible === "MARQUE") {
    marqueId = num(body.marqueId);
    if (!marqueId) return { error: "Sélectionnez la marque ciblée", status: 400 };
  }

  // ── Remise : valeur / lot selon le type ────────────────────────────────────
  let valeur = 0;
  let lotAchete: number | null = null, lotPaye: number | null = null;
  if (typeRemise === "POURCENTAGE") {
    valeur = num(body.valeur) ?? 0;
    if (valeur <= 0 || valeur > 100) return { error: "Le pourcentage doit être compris entre 0 et 100", status: 400 };
  } else if (typeRemise === "MONTANT") {
    valeur = num(body.valeur) ?? 0;
    if (valeur <= 0) return { error: "Le montant de la remise doit être supérieur à 0", status: 400 };
  } else if (typeRemise === "LOT") {
    lotAchete = num(body.lotAchete);
    lotPaye = num(body.lotPaye);
    if (!lotAchete || lotAchete < 2) return { error: "La quantité achetée du lot doit être ≥ 2", status: 400 };
    if (lotPaye == null || lotPaye < 0 || lotPaye >= lotAchete) return { error: "La quantité payée doit être inférieure à la quantité achetée", status: 400 };
  }

  // ── Période ────────────────────────────────────────────────────────────────
  const dateDebut = body.dateDebut ? new Date(body.dateDebut as string) : null;
  const dateFin = body.dateFin ? new Date(body.dateFin as string) : null;
  if (!dateDebut || isNaN(dateDebut.getTime())) return { error: "Date de début invalide", status: 400 };
  if (!dateFin || isNaN(dateFin.getTime())) return { error: "Date de fin invalide", status: 400 };
  if (dateFin < dateDebut) return { error: "La date de fin doit être postérieure à la date de début", status: 400 };

  // ── Restrictions bénéficiaires (optionnelles) ──────────────────────────────
  const pointDeVenteId = num(body.pointDeVenteId);
  const clientId = num(body.clientId);
  const segmentRaw = typeof body.segment === "string" && body.segment ? body.segment : null;
  const segment = segmentRaw && SEGMENTS.includes(segmentRaw as (typeof SEGMENTS)[number]) ? (segmentRaw as SegmentClient) : null;

  // ── Vérification d'existence des cibles/restrictions ───────────────────────
  if (produitId && !(await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true } }))) return { error: "Produit introuvable", status: 404 };
  if (categorieId && !(await prisma.categorieProduit.findUnique({ where: { id: categorieId }, select: { id: true } }))) return { error: "Catégorie introuvable", status: 404 };
  if (familleId && !(await prisma.familleProduit.findUnique({ where: { id: familleId }, select: { id: true } }))) return { error: "Famille introuvable", status: 404 };
  if (marqueId && !(await prisma.marqueProduit.findUnique({ where: { id: marqueId }, select: { id: true } }))) return { error: "Marque introuvable", status: 404 };
  if (pointDeVenteId && !(await prisma.pointDeVente.findUnique({ where: { id: pointDeVenteId }, select: { id: true } }))) return { error: "Agence introuvable", status: 404 };
  if (clientId && !(await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }))) return { error: "Client introuvable", status: 404 };

  return {
    data: {
      nom,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      cible, produitId, categorieId, familleId, marqueId,
      typeRemise, valeur: new Prisma.Decimal(valeur), lotAchete, lotPaye,
      pointDeVenteId, segment, clientId,
      dateDebut, dateFin,
      actif: body.actif === undefined ? true : Boolean(body.actif),
      priorite: num(body.priorite) ?? 0,
    },
  };
}
