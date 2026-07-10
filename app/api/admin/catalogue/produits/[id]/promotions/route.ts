import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { couvreProduit, statutPromotion, libelleRemise } from "@/lib/promotions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Promotions couvrant un produit (Catalogue §9/§12) — admin.
 * Renvoie toutes les promotions dont le périmètre couvre ce produit
 * (produit / catégorie / famille / marque / tout le catalogue), avec leur
 * statut temporel — pour la fiche produit.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });

  const produit = await prisma.produit.findUnique({
    where: { id: produitId },
    select: { id: true, categorieId: true, familleId: true, marqueId: true },
  });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const promos = await prisma.promotion.findMany({
    orderBy: [{ priorite: "desc" }, { dateDebut: "desc" }],
    select: {
      id: true, code: true, nom: true, cible: true, produitId: true, categorieId: true,
      familleId: true, marqueId: true, typeRemise: true, valeur: true, lotAchete: true, lotPaye: true,
      segment: true, dateDebut: true, dateFin: true, actif: true, priorite: true,
      pointDeVente: { select: { id: true, nom: true } },
      client: { select: { id: true, nom: true, prenom: true } },
    },
  });

  const applicables = promos
    .filter((p) => couvreProduit({ ...p, valeur: Number(p.valeur) }, produit))
    .map((p) => ({
      ...p,
      valeur: Number(p.valeur),
      remise: libelleRemise(p),
      statut: statutPromotion(p),
    }));

  return NextResponse.json({ data: applicables });
}
