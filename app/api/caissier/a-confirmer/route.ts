import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId, souscriptionPdvWhere } from "@/lib/authCaissier";

/**
 * GET /api/caissier/a-confirmer
 * Liste toutes les opérations en attente de confirmation caissier (scoped au PDV).
 * - VersementPack statut EN_ATTENTE (collectes agents terrain)
 * - RemboursementCredit statut EN_ATTENTE_CAISSIER (remboursements agents terrain)
 * - VenteDirecte statut PAID (ventes comptant agents terrain, stock déjà sorti, cash pas encore confirmé)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCaissierSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id);
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);

    const souscriptionFilter = pdvId ? souscriptionPdvWhere(pdvId) : {};
    const creditClientFilter = pdvId ? { client: { pointDeVenteId: pdvId } } : {};
    const pdvFilter          = pdvId ? { pointDeVenteId: pdvId } : {};

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip  = (page - 1) * limit;

    const [versements, remboursements, ventes, totalV, totalR, totalVD] = await Promise.all([
      prisma.versementPack.findMany({
        where: { statut: "EN_ATTENTE", souscription: souscriptionFilter },
        orderBy: { datePaiement: "asc" },
        skip,
        take: limit,
        include: {
          souscription: {
            include: {
              pack:   { select: { nom: true, type: true } },
              client: { select: { nom: true, prenom: true } },
            },
          },
        },
      }),
      prisma.remboursementCredit.findMany({
        where: { statut: "EN_ATTENTE_CAISSIER", credit: creditClientFilter },
        orderBy: { dateRemboursement: "asc" },
        skip,
        take: limit,
        include: {
          credit: {
            select: {
              reference: true,
              soldeRestant: true,
              client: { select: { nom: true, prenom: true } },
            },
          },
          enregistrePar:   { select: { nom: true, prenom: true } },
          agentCollecteur: { select: { nom: true, prenom: true } },
          compteCourant:   { select: { numeroCompte: true } },
        },
      }),
      // Ventes terrain PAID : stock sorti, espèces pas encore comptabilisées
      prisma.venteDirecte.findMany({
        where: { statut: "PAID", ...pdvFilter },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          vendeur: { select: { id: true, nom: true, prenom: true } },
          client:  { select: { nom: true, prenom: true } },
          lignes: {
            include: { produit: { select: { nom: true } } },
          },
        },
      }),
      prisma.versementPack.count({ where: { statut: "EN_ATTENTE", souscription: souscriptionFilter } }),
      prisma.remboursementCredit.count({ where: { statut: "EN_ATTENTE_CAISSIER", credit: creditClientFilter } }),
      prisma.venteDirecte.count({ where: { statut: "PAID", ...pdvFilter } }),
    ]);

    return NextResponse.json({
      data: {
        versements: versements.map((v) => ({
          id:             v.id,
          typeOperation:  "VERSEMENT_PACK",
          montant:        Number(v.montant),
          date:           v.datePaiement.toISOString(),
          collectePar:    v.encaisseParNom,
          notes:          v.notes,
          pack:           v.souscription.pack.nom,
          client:         v.souscription.client
                            ? `${v.souscription.client.prenom} ${v.souscription.client.nom}`
                            : "—",
          souscriptionId: v.souscriptionId,
        })),
        remboursements: remboursements.map((r) => ({
          id:              r.id,
          typeOperation:   "REMBOURSEMENT_CREDIT",
          montant:         Number(r.montant),
          date:            r.dateRemboursement.toISOString(),
          collectePar:     r.enregistrePar
                             ? `${r.enregistrePar.prenom} ${r.enregistrePar.nom}`
                             : "—",
          agentCollecteur: r.agentCollecteur
                             ? `${r.agentCollecteur.prenom} ${r.agentCollecteur.nom}`
                             : null,
          numeroJour:      r.numeroJour,
          montantAttendu:  r.montantAttendu != null ? Number(r.montantAttendu) : null,
          notes:           r.notes,
          creditReference: r.credit.reference,
          soldeRestant:    Number(r.credit.soldeRestant),
          client:          r.credit.client
                             ? `${r.credit.client.prenom} ${r.credit.client.nom}`
                             : "—",
          creditId:        r.creditId,
          viaCC:           r.compteCourant?.numeroCompte ?? null,
        })),
        ventes: ventes.map((v) => ({
          id:          v.id,
          typeOperation: "VENTE_DIRECTE",
          reference:   v.reference,
          montant:     Number(v.montantTotal),
          date:        v.createdAt.toISOString(),
          vendeurNom:  v.vendeur ? `${v.vendeur.prenom} ${v.vendeur.nom}` : "—",
          vendeurId:   v.vendeurId,
          client:      v.client
                         ? `${v.client.prenom} ${v.client.nom}`
                         : v.clientNom ?? "—",
          notes:       v.notes,
          lignes:      v.lignes.map((l) => ({
            produit:  l.produitNom ?? l.produit?.nom ?? "—",
            quantite: l.quantite,
            montant:  Number(l.montant),
          })),
        })),
      },
      meta: {
        totalVersements:     totalV,
        totalRemboursements: totalR,
        totalVentes:         totalVD,
        total:               totalV + totalR + totalVD,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("GET /api/caissier/a-confirmer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
