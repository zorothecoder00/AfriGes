import { Prisma, CategorieDepenseMarketing } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Dépenses marketing (CDC §53) — catégorisées, reliées à une campagne/budget,
 * comptabilisées automatiquement (lib/ecritureDepenseMarketingServer.ts).
 */

export const CATEGORIES_DEPENSE_MARKETING: CategorieDepenseMarketing[] = [
  "PUBLICITE", "IMPRESSION", "INFLUENCE", "EVENEMENT", "TRANSPORT", "TERRAIN",
  "SMS", "WHATSAPP", "EMAIL", "MEDIA", "SPONSORING", "CREATION_GRAPHIQUE", "AUTRE",
];

type DepenseData = {
  campagneId: number;
  budgetId: number | null;
  categorie: CategorieDepenseMarketing;
  montant: Prisma.Decimal;
  date: Date;
  description: string | null;
  modePaiement: string | null;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function validerDepenseMarketing(
  body: Record<string, unknown>,
): Promise<{ error: string; status: number } | { data: DepenseData }> {
  const campagneId = num(body.campagneId);
  if (!campagneId) return { error: "La campagne est requise", status: 400 };
  const campagne = await prisma.campagne.findUnique({ where: { id: campagneId }, select: { id: true } });
  if (!campagne) return { error: "Campagne introuvable", status: 404 };

  const categorie = body.categorie as CategorieDepenseMarketing;
  if (!CATEGORIES_DEPENSE_MARKETING.includes(categorie)) return { error: "Catégorie de dépense invalide", status: 400 };

  const montant = num(body.montant);
  if (!montant || montant <= 0) return { error: "Le montant doit être supérieur à 0", status: 400 };

  const budgetId = num(body.budgetId);
  if (budgetId) {
    const budget = await prisma.budgetMarketing.findUnique({ where: { id: budgetId }, select: { id: true, campagneId: true } });
    if (!budget) return { error: "Budget introuvable", status: 404 };
    if (budget.campagneId !== campagneId) return { error: "Ce budget n'appartient pas à cette campagne", status: 400 };
  }

  const date = body.date ? new Date(body.date as string) : new Date();
  if (isNaN(date.getTime())) return { error: "Date invalide", status: 400 };

  return {
    data: {
      campagneId, budgetId,
      categorie, montant: new Prisma.Decimal(montant), date,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      modePaiement: typeof body.modePaiement === "string" && body.modePaiement.trim() ? body.modePaiement.trim() : null,
    },
  };
}
