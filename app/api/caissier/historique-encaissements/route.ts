import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCaissierSession, getCaissierPdvId } from "@/lib/authCaissier";

/**
 * GET /api/caissier/historique-encaissements
 * Historique UNIFIÉ de tous les encaissements du périmètre du caissier :
 *  - Remboursements de crédit (CONFIRME)
 *  - Versements de packs (confirmés)
 *  - Ventes directes encaissées (comptant)
 *  - Opérations de caisse ENCAISSEMENT manuelles (ex. créées par un responsable)
 *
 * Les 4 sources sont combinées en UNE requête SQL (UNION ALL), filtrée,
 * triée et paginée directement en base — pas de plafond par source suivi
 * d'une pagination en mémoire (l'ancienne approche coupait silencieusement
 * les lignes les plus anciennes d'un lot avant même que le tri/la recherche
 * ne s'appliquent, dès qu'une source dépassait son plafond).
 *
 * Params : ?aujourdHui=true | ?from=YYYY-MM-DD&to=YYYY-MM-DD · ?search= · ?page= · ?limit=
 */
type Item = {
  key: string;
  type: "REMBOURSEMENT_CREDIT" | "VERSEMENT_PACK" | "VENTE_DIRECTE" | "OPERATION_CAISSE";
  typeLabel: string;
  sourceId: number;
  client: string;
  libelle: string;
  reference: string;
  mode: string | null;
  montant: number;
  date: string;
  // Champs éditables
  editable?: boolean;            // remboursement crédit
  numeroJour?: number | null;
  observation?: string | null;
  agentCollecteurId?: number | null;
  montantMax?: number;          // versement pack (plafond de correction)
  creditId?: number | null;     // remboursement crédit — pour la facture crédit liée
};

type RawRow = {
  type: Item["type"];
  source_id: number;
  client: string;
  libelle: string;
  reference: string;
  mode: string | null;
  montant: number | string;
  date: Date | string;
  editable: boolean;
  numero_jour: number | string | null;
  observation: string | null;
  agent_collecteur_id: number | string | null;
  montant_max: number | string | null;
  credit_id: number | string | null;
};

const TYPE_LABEL: Record<Item["type"], string> = {
  REMBOURSEMENT_CREDIT: "Remboursement crédit",
  VERSEMENT_PACK: "Versement pack",
  VENTE_DIRECTE: "Vente directe",
  OPERATION_CAISSE: "Encaissement caisse",
};

/**
 * Correspondance nom/prénom tolérante à l'ordre et aux espaces : couvre
 * "nom prénom", "prénom nom" et la forme collée sans espace ("afinikada"),
 * en plus du nom/prénom pris isolément. `prenomCol`/`nomCol` sont des
 * fragments SQL de confiance (écrits en dur ci-dessous, jamais dérivés
 * d'une entrée utilisateur) — Prisma.raw() est donc sûr ici.
 */
function nameMatch(prenomCol: string, nomCol: string, search: string | null) {
  return Prisma.sql`(
    ${Prisma.raw(prenomCol)} ILIKE '%' || ${search} || '%'
    OR ${Prisma.raw(nomCol)} ILIKE '%' || ${search} || '%'
    OR (${Prisma.raw(prenomCol)} || ' ' || ${Prisma.raw(nomCol)}) ILIKE '%' || ${search} || '%'
    OR (${Prisma.raw(nomCol)} || ' ' || ${Prisma.raw(prenomCol)}) ILIKE '%' || ${search} || '%'
    OR regexp_replace(${Prisma.raw(prenomCol)} || ${Prisma.raw(nomCol)}, '\s+', '', 'g') ILIKE '%' || regexp_replace(${search}, '\s+', '', 'g') || '%'
    OR regexp_replace(${Prisma.raw(nomCol)} || ${Prisma.raw(prenomCol)}, '\s+', '', 'g') ILIKE '%' || regexp_replace(${search}, '\s+', '', 'g') || '%'
  )`;
}

/**
 * Construit la requête UNION ALL des 4 sources d'encaissement, filtrée par
 * période/PDV/recherche texte directement en SQL (pas en mémoire après coup).
 */
function buildUnion(gte: Date, lt: Date, pdvId: number | null, search: string | null) {
  const rembBranch = Prisma.sql`
    SELECT
      'REMBOURSEMENT_CREDIT'::text AS type, rc.id AS source_id,
      (cl.prenom || ' ' || cl.nom) AS client,
      ('Crédit ' || cc.reference) AS libelle,
      cc.reference AS reference,
      rc."modePaiement"::text AS mode,
      rc.montant AS montant,
      rc."dateRemboursement" AS date,
      true AS editable,
      rc."numeroJour" AS numero_jour,
      rc.notes AS observation,
      rc."agentCollecteurId" AS agent_collecteur_id,
      NULL::numeric AS montant_max,
      cc.id AS credit_id
    FROM "RemboursementCredit" rc
    JOIN "CreditClient" cc ON cc.id = rc."creditId"
    JOIN "Client" cl ON cl.id = cc."clientId"
    WHERE rc.statut = 'CONFIRME'
      AND rc."dateRemboursement" >= ${gte} AND rc."dateRemboursement" < ${lt}
      AND (${pdvId}::int IS NULL OR cl."pointDeVenteId" = ${pdvId})
      AND (${search}::text IS NULL OR ${nameMatch("cl.prenom", "cl.nom", search)} OR cc.reference ILIKE '%' || ${search} || '%')
  `;

  const versBranch = Prisma.sql`
    SELECT
      'VERSEMENT_PACK'::text AS type, vp.id AS source_id,
      COALESCE(cl.prenom || ' ' || cl.nom, us.prenom || ' ' || us.nom, '—') AS client,
      COALESCE(pk.nom, 'Pack') AS libelle,
      COALESCE(vp.reference, '') AS reference,
      NULL::text AS mode,
      vp.montant AS montant,
      vp."datePaiement" AS date,
      false AS editable,
      NULL::int AS numero_jour,
      vp.notes AS observation,
      NULL::int AS agent_collecteur_id,
      sp."montantTotal" AS montant_max,
      NULL::int AS credit_id
    FROM "VersementPack" vp
    JOIN "SouscriptionPack" sp ON sp.id = vp."souscriptionId"
    JOIN "Pack" pk ON pk.id = sp."packId"
    LEFT JOIN "Client" cl ON cl.id = sp."clientId"
    LEFT JOIN "User" us ON us.id = sp."userId"
    WHERE vp.statut != 'EN_ATTENTE'
      AND vp."datePaiement" >= ${gte} AND vp."datePaiement" < ${lt}
      AND sp.statut != 'ANNULE'
      AND (${pdvId}::int IS NULL OR cl."pointDeVenteId" = ${pdvId} OR EXISTS (
        SELECT 1 FROM "GestionnaireAffectation" ga WHERE ga."userId" = sp."userId" AND ga."pointDeVenteId" = ${pdvId} AND ga.actif = true
      ))
      AND (${search}::text IS NULL
        OR ${nameMatch("cl.prenom", "cl.nom", search)}
        OR ${nameMatch("us.prenom", "us.nom", search)}
        OR pk.nom ILIKE '%' || ${search} || '%' OR vp.reference ILIKE '%' || ${search} || '%')
  `;

  const venteBranch = Prisma.sql`
    SELECT
      'VENTE_DIRECTE'::text AS type, vd.id AS source_id,
      COALESCE(cl.prenom || ' ' || cl.nom, vd."clientNom", '—') AS client,
      ('Vente ' || vd.reference) AS libelle,
      vd.reference AS reference,
      vd."modePaiement"::text AS mode,
      COALESCE(NULLIF(vd."montantPaye", 0), vd."montantTotal") AS montant,
      vd."createdAt" AS date,
      false AS editable,
      NULL::int AS numero_jour,
      NULL::text AS observation,
      NULL::int AS agent_collecteur_id,
      NULL::numeric AS montant_max,
      NULL::int AS credit_id
    FROM "VenteDirecte" vd
    LEFT JOIN "Client" cl ON cl.id = vd."clientId"
    WHERE vd.statut IN ('PAID','CONFIRMEE','SORTIE_VALIDEE','LIVREE')
      AND vd."createdAt" >= ${gte} AND vd."createdAt" < ${lt}
      AND (${pdvId}::int IS NULL OR vd."pointDeVenteId" = ${pdvId})
      AND (${search}::text IS NULL OR ${nameMatch("cl.prenom", "cl.nom", search)}
        OR vd."clientNom" ILIKE '%' || ${search} || '%' OR vd.reference ILIKE '%' || ${search} || '%')
  `;

  const opBranch = Prisma.sql`
    SELECT
      'OPERATION_CAISSE'::text AS type, oc.id AS source_id,
      oc."operateurNom" AS client,
      oc.motif AS libelle,
      oc.reference AS reference,
      oc.mode::text AS mode,
      oc.montant AS montant,
      oc."createdAt" AS date,
      false AS editable,
      NULL::int AS numero_jour,
      NULL::text AS observation,
      NULL::int AS agent_collecteur_id,
      NULL::numeric AS montant_max,
      NULL::int AS credit_id
    FROM "OperationCaisse" oc
    JOIN "SessionCaisse" sc ON sc.id = oc."sessionId"
    WHERE oc.type = 'ENCAISSEMENT'
      AND oc."createdAt" >= ${gte} AND oc."createdAt" < ${lt}
      AND (${pdvId}::int IS NULL OR sc."pointDeVenteId" = ${pdvId})
      AND oc.motif !~* '^(remboursement|versement|vente)'
      AND (${search}::text IS NULL OR oc.motif ILIKE '%' || ${search} || '%' OR oc.reference ILIKE '%' || ${search} || '%' OR oc."operateurNom" ILIKE '%' || ${search} || '%')
  `;

  return Prisma.sql`${rembBranch} UNION ALL ${versBranch} UNION ALL ${venteBranch} UNION ALL ${opBranch}`;
}

export async function GET(req: Request) {
  try {
    const auth = await getCaissierSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(auth.user.id);
    const isAdmin = auth.user.role === "ADMIN" || auth.user.role === "SUPER_ADMIN";
    const pdvId = isAdmin ? null : await getCaissierPdvId(userId);
    if (!isAdmin && !pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const aujourdHui = searchParams.get("aujourdHui") === "true";
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const search = (searchParams.get("search") || "").trim().toLowerCase() || null;
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 30)));

    // Bornes de la période
    // Note : « Aujourd'hui » désactivé sans dates explicites = tout l'historique
    // (pas un repli silencieux sur aujourd'hui) — sinon une caissière qui
    // ressaisit des versements antidatés (rattrapage) ne les retrouve jamais.
    const now = new Date();
    let gte: Date, lt: Date;
    if (aujourdHui) {
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      lt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else {
      gte = fromStr ? new Date(fromStr) : new Date(2000, 0, 1);
      const to = toStr ? new Date(toStr) : now;
      lt = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
    }

    const union = buildUnion(gte, lt, pdvId, search);

    const [countRows, statsRows, rows] = await Promise.all([
      prisma.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS count FROM (${union}) t`),
      prisma.$queryRaw<{ type: Item["type"]; total: number | string }[]>(
        Prisma.sql`SELECT type, SUM(montant)::numeric AS total FROM (${union}) t GROUP BY type`
      ),
      prisma.$queryRaw<RawRow[]>(
        // Tri secondaire (type, source_id) : beaucoup de lignes partagent la même
        // date exacte (ex. plusieurs versements saisis le même jour) — sans
        // départage stable, LIMIT/OFFSET peut répéter ou sauter des lignes
        // à la frontière entre deux pages.
        Prisma.sql`SELECT * FROM (${union}) t ORDER BY date DESC, type DESC, source_id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`
      ),
    ]);

    const total = countRows[0]?.count ?? 0;

    const parType = { REMBOURSEMENT_CREDIT: 0, VERSEMENT_PACK: 0, VENTE_DIRECTE: 0, OPERATION_CAISSE: 0 };
    let montantTotal = 0;
    for (const s of statsRows) {
      const val = Number(s.total ?? 0);
      parType[s.type] = val;
      montantTotal += val;
    }

    const data: Item[] = rows.map((r) => ({
      key: `${r.type}-${r.source_id}`,
      type: r.type,
      typeLabel: TYPE_LABEL[r.type],
      sourceId: r.source_id,
      client: r.client,
      libelle: r.libelle,
      reference: r.reference,
      mode: r.mode,
      montant: Number(r.montant),
      date: new Date(r.date).toISOString(),
      editable: r.editable,
      numeroJour: r.numero_jour != null ? Number(r.numero_jour) : null,
      observation: r.observation,
      agentCollecteurId: r.agent_collecteur_id != null ? Number(r.agent_collecteur_id) : null,
      montantMax: r.montant_max != null ? Number(r.montant_max) : undefined,
      creditId: r.credit_id != null ? Number(r.credit_id) : null,
    }));

    const stats = { total, montantTotal, parType };
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({ data, stats, meta: { total, page, limit, totalPages } });
  } catch (error) {
    console.error("GET /api/caissier/historique-encaissements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
