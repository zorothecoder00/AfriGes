import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuditeurInterneSession } from "@/lib/authAuditeurInterne";

/**
 * GET /api/auditeur/ventes-stats?period=30&pdvId=X
 *
 * Statistiques de ventes (VersementPack + VenteDirecte)
 *  - Globales
 *  - Par point de vente
 *  - Par vendeur / agent
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

    // Filtres PDV (optionnel)
    const pdvVersFilter      = pdvId ? { souscription: { client: { pointDeVenteId: pdvId } } } : {};
    const pdvVenteDirFilter  = pdvId ? { pointDeVenteId: pdvId } : {};

    const [
      versements,
      ventesDirectes,
      pointsDeVente,
      vendeurs,
    ] = await Promise.all([
      // Versements packs
      prisma.versementPack.findMany({
        where: {
          datePaiement: { gte: since },
          ...pdvVersFilter,
        },
        select: {
          id:          true,
          montant:     true,
          type:        true,
          datePaiement: true,
          encaisseParNom: true,
          encaisseParId:  true,
          souscription: {
            select: {
              pack:   { select: { id: true, nom: true, type: true } },
              client: {
                select: {
                  id:             true,
                  nom:            true,
                  prenom:         true,
                  pointDeVenteId: true,
                  pointDeVente:   { select: { id: true, nom: true, code: true } },
                },
              },
              user: { select: { id: true, nom: true, prenom: true } },
            },
          },
        },
        orderBy: { datePaiement: "desc" },
      }),

      // Ventes directes
      prisma.venteDirecte.findMany({
        where: {
          statut:    { notIn: ["BROUILLON", "ANNULEE"] },
          createdAt: { gte: since },
          ...pdvVenteDirFilter,
        },
        select: {
          id:            true,
          reference:     true,
          montantTotal:  true,
          montantPaye:   true,
          modePaiement:  true,
          createdAt:     true,
          clientNom:     true,
          client: {
            select: {
              id:   true,
              nom:  true,
              prenom: true,
              pointDeVenteId: true,
              pointDeVente: { select: { id: true, nom: true, code: true } },
            },
          },
          vendeur: { select: { id: true, nom: true, prenom: true } },
          pointDeVente: { select: { id: true, nom: true, code: true } },
          lignes: { select: { quantite: true, montant: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Tous les PDVs actifs
      prisma.pointDeVente.findMany({
        where: { actif: true },
        select: { id: true, nom: true, code: true, type: true },
        orderBy: { nom: "asc" },
      }),

      // Vendeurs (gestionnaires pouvant vendre)
      prisma.gestionnaire.findMany({
        where: {
          role: {
            in: [
              "CAISSIER",
              "AGENT_TERRAIN",
              "COMMERCIAL",
              "RESPONSABLE_POINT_DE_VENTE",
            ],
          },
          actif: true,
        },
        select: {
          id:   true,
          role: true,
          member: { select: { id: true, nom: true, prenom: true } },
        },
      }),
    ]);

    // ── Totaux globaux ──────────────────────────────────────────────────────────
    const totalVersementsMontant = versements.reduce((s, v) => s + Number(v.montant), 0);
    const totalVentesDirectesMontant = ventesDirectes.reduce((s, v) => s + Number(v.montantPaye), 0);
    const totalGlobal = totalVersementsMontant + totalVentesDirectesMontant;

    // ── Groupement par PDV ─────────────────────────────────────────────────────
    const pdvMap: Record<number, {
      id: number; nom: string; code: string;
      versementsMontant: number; versementsCount: number;
      ventesMontant: number; ventesCount: number;
    }> = {};

    for (const pdv of pointsDeVente) {
      pdvMap[pdv.id] = { id: pdv.id, nom: pdv.nom, code: pdv.code, versementsMontant: 0, versementsCount: 0, ventesMontant: 0, ventesCount: 0 };
    }

    for (const v of versements) {
      const pdvIdV = v.souscription.client?.pointDeVenteId;
      if (pdvIdV && pdvMap[pdvIdV]) {
        pdvMap[pdvIdV].versementsMontant += Number(v.montant);
        pdvMap[pdvIdV].versementsCount++;
      }
    }

    for (const v of ventesDirectes) {
      const pdvIdV = v.pointDeVente?.id ?? v.client?.pointDeVenteId;
      if (pdvIdV && pdvMap[pdvIdV]) {
        pdvMap[pdvIdV].ventesMontant += Number(v.montantPaye);
        pdvMap[pdvIdV].ventesCount++;
      }
    }

    const parPdv = Object.values(pdvMap)
      .map((p) => ({
        ...p,
        totalMontant: p.versementsMontant + p.ventesMontant,
        totalCount:   p.versementsCount + p.ventesCount,
      }))
      .sort((a, b) => b.totalMontant - a.totalMontant);

    // ── Groupement par vendeur ─────────────────────────────────────────────────
    const vendeurMap: Record<number, {
      id: number; nom: string; prenom: string; role: string;
      versementsMontant: number; versementsCount: number;
      ventesMontant: number; ventesCount: number;
    }> = {};

    for (const g of vendeurs) {
      vendeurMap[g.member.id] = {
        id: g.member.id, nom: g.member.nom, prenom: g.member.prenom, role: g.role,
        versementsMontant: 0, versementsCount: 0,
        ventesMontant: 0, ventesCount: 0,
      };
    }

    for (const v of versements) {
      if (v.encaisseParId && vendeurMap[v.encaisseParId]) {
        vendeurMap[v.encaisseParId].versementsMontant += Number(v.montant);
        vendeurMap[v.encaisseParId].versementsCount++;
      }
    }

    for (const v of ventesDirectes) {
      if (v.vendeur?.id && vendeurMap[v.vendeur.id]) {
        vendeurMap[v.vendeur.id].ventesMontant += Number(v.montantPaye);
        vendeurMap[v.vendeur.id].ventesCount++;
      }
    }

    const parVendeur = Object.values(vendeurMap)
      .map((v) => ({
        ...v,
        totalMontant: v.versementsMontant + v.ventesMontant,
        totalCount:   v.versementsCount + v.ventesCount,
      }))
      .filter((v) => v.totalCount > 0)
      .sort((a, b) => b.totalMontant - a.totalMontant);

    // ── Dernières ventes (packs + directes mélangées) ──────────────────────────
    const dernieresVentes = [
      ...versements.slice(0, 30).map((v) => {
        const person = v.souscription.client ?? v.souscription.user;
        return {
          id:          v.id,
          type:        "VERSEMENT_PACK" as const,
          reference:   `VER-${String(v.id).padStart(6, "0")}`,
          montant:     Number(v.montant),
          date:        v.datePaiement.toISOString(),
          clientNom:   person ? `${person.prenom} ${person.nom}` : "—",
          agentNom:    v.encaisseParNom ?? "—",
          pdvNom:      v.souscription.client?.pointDeVente?.nom ?? "—",
          packNom:     v.souscription.pack.nom,
          _time:       v.datePaiement.getTime(),
        };
      }),
      ...ventesDirectes.slice(0, 30).map((v) => ({
        id:          v.id,
        type:        "VENTE_DIRECTE" as const,
        reference:   v.reference,
        montant:     Number(v.montantPaye),
        date:        v.createdAt.toISOString(),
        clientNom:   v.client ? `${v.client.prenom} ${v.client.nom}` : v.clientNom ?? "—",
        agentNom:    v.vendeur ? `${v.vendeur.prenom} ${v.vendeur.nom}` : "—",
        pdvNom:      v.pointDeVente?.nom ?? v.client?.pointDeVente?.nom ?? "—",
        packNom:     "",
        _time:       v.createdAt.getTime(),
      })),
    ]
      .sort((a, b) => b._time - a._time)
      .slice(0, 50)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _time, ...rest }) => rest);

    return NextResponse.json({
      success: true,
      data: {
        periode: { jours: period, debut: since.toISOString(), fin: now.toISOString() },
        global: {
          versementsPacks:   { montant: totalVersementsMontant,      count: versements.length },
          ventesDirectes:    { montant: totalVentesDirectesMontant,   count: ventesDirectes.length },
          totalMontant:      totalGlobal,
          totalOperations:   versements.length + ventesDirectes.length,
        },
        parPdv,
        parVendeur,
        dernieresVentes,
      },
    });
  } catch (error) {
    console.error("GET /api/auditeur/ventes-stats error:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
