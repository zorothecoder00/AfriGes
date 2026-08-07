import { prisma } from "@/lib/prisma";

/**
 * Alerte stock (CDC §61, §77) : pour chaque produit ciblé (ou famille/pack
 * expansé) × chaque agence ciblée, compare le stock disponible au seuil
 * d'alerte. Partagé entre le détail de campagne et le cron d'alertes marketing.
 */
export async function calculerAlertesStock(campagneId: number) {
  const [produitsCampagne, agencesCampagne] = await Promise.all([
    prisma.campagneProduit.findMany({ where: { campagneId } }),
    prisma.campagneAgence.findMany({ where: { campagneId }, select: { pointDeVenteId: true } }),
  ]);
  const pdvIds = agencesCampagne.map((a) => a.pointDeVenteId);
  if (pdvIds.length === 0) return [];

  const produitIdsDirects = produitsCampagne.filter((p) => p.produitId).map((p) => p.produitId as number);
  const familleIds = produitsCampagne.filter((p) => p.familleId).map((p) => p.familleId as number);
  const packIds = produitsCampagne.filter((p) => p.packId).map((p) => p.packId as number);
  const [produitsFamilles, packsCibles] = await Promise.all([
    familleIds.length
      ? prisma.produit.findMany({ where: { familleId: { in: familleIds } }, select: { id: true } })
      : Promise.resolve([]),
    // CDC §67 — le stock du produit cible d'un pack (s'il en a un) est vérifié comme les autres.
    packIds.length
      ? prisma.pack.findMany({ where: { id: { in: packIds }, produitCibleId: { not: null } }, select: { produitCibleId: true } })
      : Promise.resolve([]),
  ]);
  const produitIds = [...new Set([
    ...produitIdsDirects,
    ...produitsFamilles.map((p) => p.id),
    ...packsCibles.map((p) => p.produitCibleId as number),
  ])];
  if (produitIds.length === 0) return [];

  const stocks = await prisma.stockSite.findMany({
    where: { produitId: { in: produitIds }, pointDeVenteId: { in: pdvIds } },
    include: {
      produit: { select: { nom: true, alerteStock: true } },
      pointDeVente: { select: { nom: true, code: true } },
    },
  });

  return stocks
    .filter((s) => s.quantite <= (s.seuilCritique ?? s.alerteStock ?? s.produit.alerteStock))
    .map((s) => ({
      produitNom: s.produit.nom,
      pointDeVenteNom: s.pointDeVente.nom,
      pointDeVenteCode: s.pointDeVente.code,
      quantite: s.quantite,
      seuil: s.seuilCritique ?? s.alerteStock ?? s.produit.alerteStock,
    }));
}
