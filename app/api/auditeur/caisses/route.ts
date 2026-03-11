import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

/**
 * GET /api/auditeur/caisses?period=30&pdvId=X
 *
 * Synthèse mouvements de caisse pour toutes les caisses de tous les PDVs
 *  - Sessions de caisse (ouverture / clôture)
 *  - Opérations (encaissements / décaissements)
 *  - Clôtures récentes avec écarts
 *  - Transferts caisse
 */
export async function GET(req: Request) {
  try {
    const session = await getAuditeurInterneSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;
    const pdvIdParam = searchParams.get("pdvId");
    const pdvId = pdvIdParam ? Number(pdvIdParam) : null;

    const now = new Date();
    const since = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);

    const pdvFilter       = pdvId ? { pointDeVenteId: pdvId } : {};
    const sessionPdvFilter = pdvId ? { session: { pointDeVenteId: pdvId } } : {};

    const [
      sessionsCaisse,
      cloturesCaisse,
      operationsEnc,
      operationsDec,
      transfertsCaisse,
      pointsDeVente,
    ] = await Promise.all([
      // Sessions de caisse
      prisma.sessionCaisse.findMany({
        where: {
          createdAt: { gte: since },
          ...pdvFilter,
        },
        select: {
          id:           true,
          statut:       true,
          fondsCaisse:  true,
          dateOuverture: true,
          dateFermeture: true,
          caissierNom:  true,
          pointDeVente: { select: { id: true, nom: true, code: true } },
        },
        orderBy: { dateOuverture: "desc" },
        take: 100,
      }),

      // Clôtures de caisse
      prisma.clotureCaisse.findMany({
        where: {
          date: { gte: since },
          ...pdvFilter,
        },
        select: {
          id:           true,
          date:         true,
          caissierNom:  true,
          totalVentes:  true,
          montantTotal: true,
          panierMoyen:  true,
          nbClients:    true,
          ecart:        true,
          notes:        true,
          pointDeVente: { select: { id: true, nom: true, code: true } },
        },
        orderBy: { date: "desc" },
        take: 100,
      }),

      // Opérations encaissement
      prisma.operationCaisse.aggregate({
        _sum: { montant: true },
        _count: { id: true },
        where: {
          type:      "ENCAISSEMENT",
          createdAt: { gte: since },
          ...sessionPdvFilter,
        },
      }),

      // Opérations décaissement par catégorie
      prisma.operationCaisse.groupBy({
        by: ["categorie"],
        _sum:   { montant: true },
        _count: { id: true },
        where: {
          type:      "DECAISSEMENT",
          createdAt: { gte: since },
          ...sessionPdvFilter,
        },
      }),

      // Transferts caisse
      prisma.transfertCaisse.findMany({
        where: {
          createdAt: { gte: since },
          ...(pdvId ? { session: { pointDeVenteId: pdvId } } : {}),
        },
        select: {
          id:        true,
          montant:   true,
          motif:     true,
          createdAt: true,
          session:   { select: { caissierNom: true, pointDeVente: { select: { nom: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // PDVs actifs
      prisma.pointDeVente.findMany({
        where: { actif: true },
        select: { id: true, nom: true, code: true, type: true },
        orderBy: { nom: "asc" },
      }),
    ]);

    // ── Agrégats opérations décaissement ────────────────────────────────────────
    const totalEncaissement = Number(operationsEnc._sum.montant ?? 0);
    const countEncaissement = operationsEnc._count.id;
    const totalDecaissement = operationsDec.reduce((s, r) => s + Number(r._sum.montant ?? 0), 0);
    const countDecaissement = operationsDec.reduce((s, r) => s + r._count.id, 0);
    const decMap = Object.fromEntries(
      operationsDec.map((r) => [r.categorie ?? "AUTRE", { montant: Number(r._sum.montant ?? 0), count: r._count.id }])
    );

    // ── Stats clôtures ────────────────────────────────────────────────────────
    const cloturesTotalMontant = cloturesCaisse.reduce((s, c) => s + Number(c.montantTotal), 0);
    const cloturesTotalEcart   = cloturesCaisse.reduce((s, c) => s + (c.ecart ? Number(c.ecart) : 0), 0);
    const cloturesAvecEcart    = cloturesCaisse.filter((c) => c.ecart && Number(c.ecart) !== 0).length;

    // ── Groupement par PDV ─────────────────────────────────────────────────────
    const pdvClotures: Record<number, { id: number; nom: string; code: string; count: number; montant: number; ecart: number }> = {};
    for (const pdv of pointsDeVente) {
      pdvClotures[pdv.id] = { id: pdv.id, nom: pdv.nom, code: pdv.code, count: 0, montant: 0, ecart: 0 };
    }
    for (const c of cloturesCaisse) {
      if (c.pointDeVente?.id && pdvClotures[c.pointDeVente.id]) {
        pdvClotures[c.pointDeVente.id].count++;
        pdvClotures[c.pointDeVente.id].montant += Number(c.montantTotal);
        pdvClotures[c.pointDeVente.id].ecart += c.ecart ? Number(c.ecart) : 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        periode: { jours: period, debut: since.toISOString(), fin: now.toISOString() },
        operations: {
          encaissements: { montant: totalEncaissement, count: countEncaissement },
          decaissements: {
            total:        { montant: totalDecaissement, count: countDecaissement },
            parCategorie: decMap,
          },
          soldeNet: totalEncaissement - totalDecaissement,
        },
        clotures: {
          count:          cloturesCaisse.length,
          montantTotal:   cloturesTotalMontant,
          ecartTotal:     cloturesTotalEcart,
          avecEcart:      cloturesAvecEcart,
          recentes:       cloturesCaisse.map((c) => ({
            id:           c.id,
            date:         c.date.toISOString(),
            caissierNom:  c.caissierNom,
            totalVentes:  c.totalVentes,
            montantTotal: Number(c.montantTotal),
            panierMoyen:  Number(c.panierMoyen),
            nbClients:    c.nbClients,
            ecart:        c.ecart ? Number(c.ecart) : 0,
            hasEcart:     c.ecart ? Number(c.ecart) !== 0 : false,
            notes:        c.notes,
            pdvNom:       c.pointDeVente?.nom ?? "—",
          })),
        },
        sessions: {
          total:         sessionsCaisse.length,
          ouvertes:      sessionsCaisse.filter((s) => s.statut === "OUVERTE").length,
          fermees:       sessionsCaisse.filter((s) => s.statut === "FERMEE").length,
          recentes:      sessionsCaisse.slice(0, 30).map((s) => ({
            id:            s.id,
            statut:        s.statut,
            fondsCaisse:   Number(s.fondsCaisse),
            dateOuverture: s.dateOuverture.toISOString(),
            dateFermeture: s.dateFermeture?.toISOString() ?? null,
            caissierNom:   s.caissierNom,
            pdvNom:        s.pointDeVente?.nom ?? "—",
          })),
        },
        transferts: transfertsCaisse.map((t) => ({
          id:        t.id,
          montant:   Number(t.montant),
          motif:     t.motif,
          date:      t.createdAt.toISOString(),
          caissier:  t.session?.caissierNom ?? "—",
          pdvNom:    t.session?.pointDeVente?.nom ?? "—",
        })),
        parPdv: Object.values(pdvClotures).sort((a, b) => b.montant - a.montant),
      },
    });
  } catch (error) {
    console.error("GET /api/auditeur/caisses error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
