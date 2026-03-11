import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/approvisionnement?pdvId=X&statut=X&page=1
 *
 * Demandes de réapprovisionnement (CommandeInterne + ReceptionApprovisionnement)
 * pour la zone du chef d'agence.
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit      = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? "20")));
    const statut     = searchParams.get("statut") ?? "";
    const pdvIdParam = searchParams.get("pdvId") ? Number(searchParams.get("pdvId")) : null;
    const type       = searchParams.get("type") ?? "all"; // "commande" | "reception" | "all"

    const effectivePdvIds = pdvIdParam
      ? (pdvIds === null || pdvIds.includes(pdvIdParam) ? [pdvIdParam] : [])
      : pdvIds;

    const pdvFilter = effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commandeWhere: any = { ...pdvFilter, ...(statut ? { statut } : {}) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receptionWhere: any = { ...pdvFilter, ...(statut ? { statut } : {}) };

    const [
      totalCommandes,
      commandes,
      totalReceptions,
      receptions,
    ] = await Promise.all([
      type !== "reception" ? prisma.commandeInterne.count({
        where: commandeWhere,
      }) : Promise.resolve(0),

      type !== "reception" ? prisma.commandeInterne.findMany({
        where: commandeWhere,
        skip:    type === "commande" ? (page - 1) * limit : 0,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          demandeur:    { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { id: true, nom: true, unite: true } } },
          },
        },
      }) : Promise.resolve([]),

      type !== "commande" ? prisma.receptionApprovisionnement.count({
        where: receptionWhere,
      }) : Promise.resolve(0),

      type !== "commande" ? prisma.receptionApprovisionnement.findMany({
        where: receptionWhere,
        skip:    type === "reception" ? (page - 1) * limit : 0,
        take:    limit,
        orderBy: { createdAt: "desc" },
        include: {
          pointDeVente: { select: { id: true, nom: true, code: true } },
          fournisseur:  { select: { id: true, nom: true } },
          receptionnePar: { select: { id: true, nom: true, prenom: true } },
          lignes: {
            include: {
              produit: { select: { id: true, nom: true, unite: true } },
            },
          },
        },
      }) : Promise.resolve([]),
    ]);

    const commandesData = commandes.map((c) => ({
      id:           c.id,
      docType:      "COMMANDE" as const,
      reference:    c.reference,
      statut:       c.statut,
      createdAt:    c.createdAt.toISOString(),
      pdv:          { id: c.pointDeVente.id, nom: c.pointDeVente.nom, code: c.pointDeVente.code },
      demandeurNom: `${c.demandeur.prenom} ${c.demandeur.nom}`,
      notes:        c.notes,
      lignes:       c.lignes.map((l) => ({
        produitId:         l.produitId,
        produitNom:        l.produit.nom,
        unite:             l.produit.unite ?? "",
        quantiteDemandee:  l.quantiteDemandee,
        quantiteValidee:   l.quantiteValidee,
      })),
    }));

    const receptionsData = receptions.map((r) => ({
      id:           r.id,
      docType:      "RECEPTION" as const,
      reference:    r.reference,
      statut:       r.statut,
      createdAt:    r.createdAt.toISOString(),
      pdv:          { id: r.pointDeVente.id, nom: r.pointDeVente.nom, code: r.pointDeVente.code },
      demandeurNom: `${r.receptionnePar.prenom} ${r.receptionnePar.nom}`,
      fournisseurNom: r.fournisseur?.nom ?? r.fournisseurNom ?? "—",
      notes:        r.notes,
      datePrevisionnelle: r.datePrevisionnelle.toISOString(),
      dateReception: r.dateReception?.toISOString() ?? null,
      lignes: r.lignes.map((l) => ({
        produitId:        l.produitId,
        produitNom:       l.produit.nom,
        unite:            l.produit.unite ?? "",
        quantiteAttendue: l.quantiteAttendue,
        quantiteRecue:    l.quantiteRecue,
      })),
    }));

    return NextResponse.json({
      success: true,
      commandes:  commandesData,
      receptions: receptionsData,
      stats: {
        commandesAttente:  commandes.filter((c) => ["BROUILLON", "SOUMISE"].includes(c.statut)).length,
        receptionsAttente: receptions.filter((r) => ["BROUILLON", "EN_COURS"].includes(r.statut)).length,
      },
      meta: {
        totalCommandes,
        totalReceptions,
        page, limit,
      },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/approvisionnement error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
