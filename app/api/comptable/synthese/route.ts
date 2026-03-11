import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptablePdvId } from "@/lib/authComptable";

/**
 * GET /api/comptable/synthese?period=7|30|90|365
 *
 * Sources incluses :
 *   Encaissements : VersementPack + OperationCaisse ENCAISSEMENT
 *   Décaissements : MouvementStock ENTREE + OperationCaisse DECAISSEMENT (salaires, avances, etc.)
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodParam = Number(searchParams.get("period") ?? "30");
    const period = [7, 30, 90, 365].includes(periodParam) ? periodParam : 30;

    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - period);

    // ── Récupérer le PDV du comptable ─────────────────────────────────────────
    const pdvId = await getComptablePdvId(session);

    // Fragments SQL conditionnels selon le PDV
    const approPdvFilter  = pdvId !== null ? Prisma.sql`AND m."pointDeVenteId" = ${pdvId}` : Prisma.empty;
    const caissePdvJoin   = pdvId !== null ? Prisma.sql`JOIN "SessionCaisse" sc ON sc.id = oc."sessionId"` : Prisma.empty;
    const caissePdvFilter = pdvId !== null ? Prisma.sql`AND sc."pointDeVenteId" = ${pdvId}` : Prisma.empty;
    const stockPdvFilter      = pdvId !== null ? Prisma.sql`AND ss."pointDeVenteId" = ${pdvId}` : Prisma.empty;
    // VenteDirecte → pointDeVenteId direct
    const venteDirPdvFilter   = pdvId !== null ? Prisma.sql`AND v."pointDeVenteId" = ${pdvId}` : Prisma.empty;
    // VersementPack → SouscriptionPack → Client.pointDeVenteId
    const versPdvJoin     = pdvId !== null
      ? Prisma.sql`JOIN "SouscriptionPack" sp ON sp.id = vp."souscriptionId" JOIN "Client" c ON c.id = sp."clientId"`
      : Prisma.empty;
    const versPdvFilter   = pdvId !== null ? Prisma.sql`AND c."pointDeVenteId" = ${pdvId}` : Prisma.empty;

    // ── Agrégats en parallèle ─────────────────────────────────────────────────

    const [
      versementsParType,
      approTotaux,
      opcEncTotaux,
      opcDecParCat,
      stockSnapshot,
      ventesDirectesTotaux,
      souscriptionsActives,
      packsCount,
    ] = await Promise.all([

      // 1. Encaissements packs (VersementPack groupé par type) filtrés par PDV client
      prisma.$queryRaw<{ type: string; total: string; cnt: string }[]>`
        SELECT vp.type,
               COALESCE(SUM(vp.montant), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "VersementPack" vp
        ${versPdvJoin}
        WHERE vp."datePaiement" >= ${since}
        ${versPdvFilter}
        GROUP BY vp.type
      `,

      // 2. Décaissements approvisionnements (MouvementStock ENTREE) filtrés par PDV
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(m.quantite * p."prixUnitaire"), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "MouvementStock" m
        JOIN "Produit" p ON p.id = m."produitId"
        WHERE m.type = 'ENTREE' AND m."dateMouvement" >= ${since}
        ${approPdvFilter}
      `,

      // 3. Encaissements caisse (OperationCaisse ENCAISSEMENT) filtrés par PDV
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(oc.montant), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "OperationCaisse" oc
        ${caissePdvJoin}
        WHERE oc.type = 'ENCAISSEMENT' AND oc."createdAt" >= ${since}
        ${caissePdvFilter}
      `,

      // 4. Décaissements caisse (OperationCaisse DECAISSEMENT groupé par catégorie) filtrés par PDV
      prisma.$queryRaw<{ categorie: string | null; total: string; cnt: string }[]>`
        SELECT oc.categorie,
               COALESCE(SUM(oc.montant), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "OperationCaisse" oc
        ${caissePdvJoin}
        WHERE oc.type = 'DECAISSEMENT' AND oc."createdAt" >= ${since}
        ${caissePdvFilter}
        GROUP BY oc.categorie
      `,

      // 5. Snapshot stock (valeur agrégée depuis StockSite) filtrée par PDV
      prisma.$queryRaw<{ valeur: string; nb: string }[]>`
        SELECT COALESCE(SUM(ss.quantite * p."prixUnitaire"), 0)::text AS valeur,
               COUNT(DISTINCT p.id)::text AS nb
        FROM "Produit" p
        LEFT JOIN "StockSite" ss ON ss."produitId" = p.id
        WHERE 1=1 ${stockPdvFilter}
      `,

      // 6. Encaissements ventes directes (hors BROUILLON / ANNULEE) filtrés par PDV
      prisma.$queryRaw<{ total: string; cnt: string }[]>`
        SELECT COALESCE(SUM(v."montantPaye"), 0)::text AS total,
               COUNT(*)::text AS cnt
        FROM "VenteDirecte" v
        WHERE v.statut NOT IN ('BROUILLON', 'ANNULEE')
          AND v."createdAt" >= ${since}
        ${venteDirPdvFilter}
      `,

      // 7. Souscriptions actives
      prisma.souscriptionPack.count({ where: { statut: "ACTIF" } }),

      // 8. Nombre de packs
      prisma.pack.count(),
    ]);

    // ── Map versements pack ───────────────────────────────────────────────────

    const vMap = Object.fromEntries(
      versementsParType.map((r) => [r.type, { montant: Number(r.total), count: Number(r.cnt) }])
    );
    const getV = (t: string) => vMap[t] ?? { montant: 0, count: 0 };

    const cotisInit       = getV("COTISATION_INITIALE");
    const versPeri        = getV("VERSEMENT_PERIODIQUE");
    const remb            = getV("REMBOURSEMENT");
    const bonus           = getV("BONUS");
    const ajust           = getV("AJUSTEMENT");
    const autresPacks     = { montant: bonus.montant + ajust.montant, count: bonus.count + ajust.count };
    const totalVersements = versementsParType.reduce((s, r) => s + Number(r.total), 0);
    const countVersements = versementsParType.reduce((s, r) => s + Number(r.cnt), 0);

    // ── OperationCaisse encaissements ─────────────────────────────────────────

    const caissEnc      = Number(opcEncTotaux[0]?.total ?? 0);
    const caissEncCount = Number(opcEncTotaux[0]?.cnt ?? 0);
    const ventesDir      = Number(ventesDirectesTotaux[0]?.total ?? 0);
    const ventesDirCount = Number(ventesDirectesTotaux[0]?.cnt ?? 0);
    const totalEncaissements = totalVersements + caissEnc + ventesDir;

    // ── OperationCaisse décaissements ─────────────────────────────────────────

    const opcDecMap = Object.fromEntries(
      opcDecParCat.map((r) => [r.categorie ?? "AUTRE", { montant: Number(r.total), count: Number(r.cnt) }])
    );
    const getD = (c: string) => opcDecMap[c] ?? { montant: 0, count: 0 };

    const salaires    = getD("SALAIRE");
    const avances     = getD("AVANCE");
    const fournisseurs = getD("FOURNISSEUR");
    const autresCaisse = {
      montant: (opcDecMap["AUTRE"]?.montant ?? 0),
      count:   (opcDecMap["AUTRE"]?.count   ?? 0),
    };
    const totalCaisseDec = opcDecParCat.reduce((s, r) => s + Number(r.total), 0);

    const decaisAppro    = Number(approTotaux[0]?.total ?? 0);
    const approCount     = Number(approTotaux[0]?.cnt ?? 0);
    const totalDecaissements = decaisAppro + totalCaisseDec;

    // ── Évolution jour par jour ───────────────────────────────────────────────

    const pdvMouvFilter      = pdvId !== null ? { pointDeVenteId: pdvId } : {};
    const pdvCaisseFilter    = pdvId !== null ? { session: { pointDeVenteId: pdvId } } : {};
    const pdvVersFilter      = pdvId !== null ? { souscription: { client: { pointDeVenteId: pdvId } } } : {};
    const pdvVenteDirFilter  = pdvId !== null ? { pointDeVenteId: pdvId } : {};

    const [versementsJour, approJour, opcEncJour, opcDecJour, ventesDirJour] = await Promise.all([
      prisma.versementPack.findMany({
        where: { datePaiement: { gte: since }, ...pdvVersFilter },
        select: { datePaiement: true, montant: true },
      }),
      prisma.mouvementStock.findMany({
        where: { type: "ENTREE", dateMouvement: { gte: since }, ...pdvMouvFilter },
        select: { dateMouvement: true, quantite: true, produit: { select: { prixUnitaire: true } } },
      }),
      prisma.operationCaisse.findMany({
        where: { type: "ENCAISSEMENT", createdAt: { gte: since }, ...pdvCaisseFilter },
        select: { createdAt: true, montant: true },
      }),
      prisma.operationCaisse.findMany({
        where: { type: "DECAISSEMENT", createdAt: { gte: since }, ...pdvCaisseFilter },
        select: { createdAt: true, montant: true },
      }),
      prisma.venteDirecte.findMany({
        where: { statut: { notIn: ["BROUILLON", "ANNULEE"] }, createdAt: { gte: since }, ...pdvVenteDirFilter },
        select: { createdAt: true, montantPaye: true },
      }),
    ]);

    const encaisMap: Record<string, number> = {};
    const decaisMap: Record<string, number> = {};

    for (const v of versementsJour) {
      const k = v.datePaiement.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + Number(v.montant);
    }
    for (const vd of ventesDirJour) {
      const k = vd.createdAt.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + Number(vd.montantPaye);
    }
    for (const op of opcEncJour) {
      const k = op.createdAt.toISOString().split("T")[0];
      encaisMap[k] = (encaisMap[k] ?? 0) + Number(op.montant);
    }
    for (const m of approJour) {
      const k = m.dateMouvement.toISOString().split("T")[0];
      decaisMap[k] = (decaisMap[k] ?? 0) + m.quantite * Number(m.produit.prixUnitaire);
    }
    for (const op of opcDecJour) {
      const k = op.createdAt.toISOString().split("T")[0];
      decaisMap[k] = (decaisMap[k] ?? 0) + Number(op.montant);
    }

    const evolution: { date: string; encaissements: number; decaissements: number }[] = [];
    for (let i = period; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split("T")[0];
      evolution.push({ date: k, encaissements: encaisMap[k] ?? 0, decaissements: decaisMap[k] ?? 0 });
    }

    return NextResponse.json({
      success: true,
      data: {
        periode: { debut: since.toISOString(), fin: now.toISOString(), jours: period },
        encaissements: {
          versements_packs:      { montant: totalVersements, count: countVersements },
          cotisations_init:      cotisInit,
          versements_peri:       versPeri,
          remboursements:        remb,
          autres:                autresPacks,
          caisse_encaissements:  { montant: caissEnc,   count: caissEncCount },
          ventes_directes:       { montant: ventesDir,   count: ventesDirCount },
          total: totalEncaissements,
        },
        decaissements: {
          approvisionnements: { montant: decaisAppro,     count: approCount },
          salaires:           salaires,
          avances:            avances,
          fournisseurs:       fournisseurs,
          autres_caisse:      autresCaisse,
          total: totalDecaissements,
        },
        resultat_net:     totalEncaissements - totalDecaissements,
        taux_utilisation: totalEncaissements > 0
          ? Math.round((totalDecaissements / totalEncaissements) * 100)
          : 0,
        evolution,
        snapshot: {
          stock:                { valeur: Number(stockSnapshot[0]?.valeur ?? 0), nombreProduits: Number(stockSnapshot[0]?.nb ?? 0) },
          souscriptionsActives,
          packs:                packsCount,
          versementsTotal:      countVersements,
        },
      },
    });
  } catch (error) {
    console.error("COMPTABLE SYNTHESE ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
