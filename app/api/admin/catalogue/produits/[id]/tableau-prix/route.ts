import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { grillePrixEffective, TYPES_PRIX, TYPE_PRIX_LABEL } from "@/lib/tarification";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Tableau de prix multi-agences (Catalogue §11) — admin.
 * Pour chaque agence active, résout le prix effectif de chaque type de prix
 * (la ligne la plus spécifique AGENCE > VILLE > REGION > GLOBAL), plus une
 * colonne GLOBAL de référence. Ne renvoie que les types réellement tarifés.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const produitId = Number((await params).id);
  if (!produitId) return NextResponse.json({ message: "Identifiant invalide" }, { status: 400 });
  const produit = await prisma.produit.findUnique({ where: { id: produitId }, select: { id: true } });
  if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  const agencesActives = await prisma.pointDeVente.findMany({
    where: { actif: true },
    orderBy: [{ type: "asc" }, { nom: "asc" }],
    select: { id: true, nom: true, type: true },
  });

  const global = await grillePrixEffective(produitId, {});
  const agences = await Promise.all(
    agencesActives.map(async (a) => ({
      id: a.id, nom: a.nom, type: a.type,
      prix: await grillePrixEffective(produitId, { pointDeVenteId: a.id }),
    })),
  );

  // Ne conserver que les types ayant au moins un prix (global ou sur une agence).
  const typesUtilises = TYPES_PRIX.filter(
    (t) => global[t] != null || agences.some((a) => a.prix[t] != null),
  ).map((t) => ({ type: t, label: TYPE_PRIX_LABEL[t] }));

  return NextResponse.json({ data: { types: typesUtilises, global, agences } });
}
