import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChefAgenceSession, getChefAgencePdvIds } from "@/lib/authChefAgence";

/**
 * GET /api/chef-agence/ventes
 *
 * Toutes les ventes de la zone (VenteDirecte + VersementPack), filtrables par :
 *   - period   : 7 | 30 | 90 | 365 (jours)
 *   - pdvId    : point de vente précis
 *   - agentId  : vendeur / agent terrain
 *   - produitId: produit vendu (VD uniquement)
 *   - type     : "VD" | "VP" | "all"
 *   - page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getChefAgenceSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const pdvIds = await getChefAgencePdvIds(session);

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period  = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;
    const page    = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit   = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? "50")));
    const pdvId   = searchParams.get("pdvId")    ? Number(searchParams.get("pdvId"))    : null;
    const agentId = searchParams.get("agentId")  ? Number(searchParams.get("agentId"))  : null;
    const prodId  = searchParams.get("produitId")? Number(searchParams.get("produitId")): null;
    const type    = searchParams.get("type") ?? "all"; // "VD" | "VP" | "all"

    const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

    // Restreindre au PDV demandé s'il fait partie de la zone
    const effectivePdvIds = pdvId
      ? (pdvIds === null || pdvIds.includes(pdvId) ? [pdvId] : [])
      : pdvIds;

    const ventePdvFilter = effectivePdvIds ? { pointDeVenteId: { in: effectivePdvIds } } : {};
    const versFilter     = effectivePdvIds
      ? { souscription: { client: { pointDeVenteId: { in: effectivePdvIds } } } }
      : {};

    // ── Ventes directes ────────────────────────────────────────────────────────
    const vdWhere: Record<string, unknown> = {
      statut:    { notIn: ["BROUILLON", "ANNULEE"] },
      createdAt: { gte: since },
      ...ventePdvFilter,
    };
    if (agentId) vdWhere.vendeurId = agentId;
    if (prodId)  vdWhere.lignes = { some: { produitId: prodId } };

    const [totalVD, ventesDir, totalVP, versements] = await Promise.all([
      type !== "VP" ? prisma.venteDirecte.count({ where: vdWhere }) : Promise.resolve(0),

      type !== "VP" ? prisma.venteDirecte.findMany({
        where:   vdWhere,
        skip:    type === "VD" ? (page - 1) * limit : 0,
        take:    type === "VD" ? limit : limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, reference: true, statut: true,
          montantTotal: true, montantPaye: true, modePaiement: true,
          clientNom: true, createdAt: true,
          client:      { select: { id: true, nom: true, prenom: true } },
          vendeur:     { select: { id: true, nom: true, prenom: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          lignes: { select: { quantite: true, montant: true, produit: { select: { nom: true } } } },
        },
      }) : Promise.resolve([]),

      type !== "VD" ? prisma.versementPack.count({
        where: {
          datePaiement: { gte: since },
          ...versFilter,
          ...(agentId ? { encaisseParId: agentId } : {}),
        },
      }) : Promise.resolve(0),

      type !== "VD" ? prisma.versementPack.findMany({
        where: {
          datePaiement: { gte: since },
          ...versFilter,
          ...(agentId ? { encaisseParId: agentId } : {}),
        },
        skip:    type === "VP" ? (page - 1) * limit : 0,
        take:    type === "VP" ? limit : limit,
        orderBy: { datePaiement: "desc" },
        select: {
          id: true, montant: true, type: true, datePaiement: true,
          encaisseParNom: true, encaisseParId: true,
          souscription: {
            select: {
              pack: { select: { id: true, nom: true, type: true } },
              client: {
                select: {
                  id: true, nom: true, prenom: true,
                  pointDeVente: { select: { id: true, nom: true, code: true } },
                },
              },
            },
          },
        },
      }) : Promise.resolve([]),
    ]);

    // ── Statistiques globales (sans pagination) ────────────────────────────────
    const [statsVD, statsVP] = await Promise.all([
      prisma.venteDirecte.aggregate({
        _sum:   { montantPaye: true },
        _count: { id: true },
        where: { ...vdWhere },
      }),
      prisma.versementPack.aggregate({
        _sum:   { montant: true },
        _count: { id: true },
        where: {
          datePaiement: { gte: since },
          ...versFilter,
          ...(agentId ? { encaisseParId: agentId } : {}),
        },
      }),
    ]);

    // ── Mise en forme VD ──────────────────────────────────────────────────────
    const vdFormatted = ventesDir.map((v) => ({
      id:         v.id,
      source:     "VD" as const,
      reference:  v.reference,
      date:       v.createdAt.toISOString(),
      montant:    Number(v.montantPaye),
      clientNom:  v.client ? `${v.client.prenom} ${v.client.nom}` : v.clientNom ?? "—",
      agentNom:   v.vendeur ? `${v.vendeur.prenom} ${v.vendeur.nom}` : "—",
      agentId:    v.vendeur?.id ?? null,
      pdvNom:     v.pointDeVente?.nom ?? "—",
      pdvId:      v.pointDeVente?.id ?? null,
      modePaiement: v.modePaiement,
      lignes:     v.lignes.map((l) => ({ produitNom: l.produit.nom, quantite: l.quantite, montant: Number(l.montant) })),
      packNom:    null,
    }));

    // ── Mise en forme VP ──────────────────────────────────────────────────────
    const vpFormatted = versements.map((v) => ({
      id:         v.id,
      source:     "VP" as const,
      reference:  `VER-${String(v.id).padStart(6, "0")}`,
      date:       v.datePaiement.toISOString(),
      montant:    Number(v.montant),
      clientNom:  v.souscription.client
        ? `${v.souscription.client.prenom} ${v.souscription.client.nom}` : "—",
      agentNom:   v.encaisseParNom ?? "—",
      agentId:    v.encaisseParId ?? null,
      pdvNom:     v.souscription.client?.pointDeVente?.nom ?? "—",
      pdvId:      v.souscription.client?.pointDeVente?.id ?? null,
      modePaiement: null,
      lignes:     [],
      packNom:    v.souscription.pack.nom,
    }));

    // ── Fusion et tri ─────────────────────────────────────────────────────────
    const allVentes = type === "VD"
      ? vdFormatted
      : type === "VP"
        ? vpFormatted
        : [...vdFormatted, ...vpFormatted].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, limit);

    const totalItems = type === "VD" ? totalVD : type === "VP" ? totalVP : totalVD + totalVP;

    return NextResponse.json({
      success: true,
      data: allVentes,
      stats: {
        ventesDirectes: { count: Number(statsVD._count.id), montant: Number(statsVD._sum.montantPaye ?? 0) },
        versementsPacks: { count: Number(statsVP._count.id), montant: Number(statsVP._sum.montant ?? 0) },
        totalMontant: Number(statsVD._sum.montantPaye ?? 0) + Number(statsVP._sum.montant ?? 0),
        totalCount: Number(statsVD._count.id) + Number(statsVP._count.id),
      },
      meta: { total: totalItems, page, limit, totalPages: Math.ceil(totalItems / limit), period },
    });
  } catch (error) {
    console.error("GET /api/chef-agence/ventes error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
