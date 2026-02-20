import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/journal
 *
 * Journal comptable unifié (toutes les opérations financières).
 * Paramètres :
 *   - page, limit
 *   - type: TOUS | ENCAISSEMENT | DECAISSEMENT
 *   - categorie: VENTE | COTISATION | CONTRIBUTION_TONTINE | REMBOURSEMENT_CREDIT
 *                | APPROVISIONNEMENT | CREDIT_DECAISSE | POT_TONTINE
 *   - search: recherche dans le libellé
 *   - dateDebut, dateFin (ISO strings, défaut : 30 derniers jours)
 */

type JournalType = "ENCAISSEMENT" | "DECAISSEMENT" | "ACTIVITE";
type JournalCategory =
  | "VENTE"
  | "COTISATION"
  | "CONTRIBUTION_TONTINE"
  | "REMBOURSEMENT_CREDIT"
  | "APPROVISIONNEMENT"
  | "CREDIT_DECAISSE"
  | "POT_TONTINE";

interface JournalEntry {
  id: string;
  sourceId: number;
  date: Date;
  type: JournalType;
  categorie: JournalCategory;
  libelle: string;
  montant: number;
  reference: string;
}

// Types explicites pour chaque résultat de requête
interface VenteResult {
  id: number;
  createdAt: Date;
  quantite: number;
  prixUnitaire: { toNumber(): number } | number;
  produit: { nom: string };
  creditAlimentaire: {
    member: { nom: string; prenom: string } | null;
    client: { nom: string; prenom: string } | null;
  } | null;
}

interface CotisationResult {
  id: number;
  montant: { toNumber(): number } | number;
  datePaiement: Date | null;
  periode: string;
  member: { nom: string; prenom: string } | null;
  client: { nom: string; prenom: string } | null;
}

interface ContributionResult {
  id: number;
  montant: { toNumber(): number } | number;
  datePaiement: Date | null;
  cycle: { tontine: { nom: string } };
}

interface CreditTransactionResult {
  id: number;
  montant: { toNumber(): number } | number;
  createdAt: Date;
  creditId: number;
  credit: {
    member: { nom: string; prenom: string } | null;
    client: { nom: string; prenom: string } | null;
  };
}

interface ApproResult {
  id: number;
  quantite: number;
  dateMouvement: Date;
  reference: string;
  motif: string | null;
  produit: { nom: string; prixUnitaire: { toNumber(): number } | number };
}

interface PotTontineResult {
  id: number;
  montantPot: { toNumber(): number } | number;
  numeroCycle: number;
  dateCloture: Date | null;
  tontine: { nom: string };
  beneficiaire: {
    member: { nom: string; prenom: string } | null;
    client: { nom: string; prenom: string } | null;
  };
}

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page       = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit      = Math.min(50, Math.max(10, Number(searchParams.get("limit") ?? "20")));
    const typeFilter = searchParams.get("type") ?? "TOUS";
    const catFilter  = searchParams.get("categorie") ?? "";
    const search     = (searchParams.get("search") ?? "").trim().toLowerCase();

    const dateFinParam   = searchParams.get("dateFin");
    const dateDebutParam = searchParams.get("dateDebut");

    const dateFin   = dateFinParam   ? new Date(dateFinParam)   : new Date();
    const dateDebut = dateDebutParam ? new Date(dateDebutParam) : new Date(dateFin);
    if (!dateDebutParam) dateDebut.setDate(dateDebut.getDate() - 30);
    dateFin.setHours(23, 59, 59, 999);

    const includeEnc = typeFilter === "TOUS" || typeFilter === "ENCAISSEMENT";
    const includeDec = typeFilter === "TOUS" || typeFilter === "DECAISSEMENT";
    const includeAct = typeFilter === "TOUS" || typeFilter === "ACTIVITE";

    const matchCat = (cat: JournalCategory) => !catFilter || catFilter === cat;

    // ── Requêtes parallèles ─────────────────────────────────────────────────

    const [ventes, cotisations, contributions, rembCredits, decaisCredits, appros, potsTontines] =
      await Promise.all([

        // VENTE (activité produits — consommation de crédits pré-financés)
        includeAct && matchCat("VENTE")
          ? prisma.venteCreditAlimentaire.findMany({
              where: { createdAt: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                createdAt: true,
                quantite: true,
                prixUnitaire: true,
                produit: { select: { nom: true } },
                creditAlimentaire: {
                  select: {
                    member: { select: { nom: true, prenom: true } },
                    client: { select: { nom: true, prenom: true } },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            }).then((rows) => rows as VenteResult[])
          : Promise.resolve([] as VenteResult[]),

        // COTISATION payée (encaissement)
        includeEnc && matchCat("COTISATION")
          ? prisma.cotisation.findMany({
              where: { statut: "PAYEE", datePaiement: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                montant: true,
                datePaiement: true,
                periode: true,
                member: { select: { nom: true, prenom: true } },
                client: { select: { nom: true, prenom: true } },
              },
              orderBy: { datePaiement: "desc" },
            }).then((rows) => rows as CotisationResult[])
          : Promise.resolve([] as CotisationResult[]),

        // CONTRIBUTION TONTINE payée (encaissement)
        includeEnc && matchCat("CONTRIBUTION_TONTINE")
          ? prisma.tontineContribution.findMany({
              where: { statut: "PAYEE", datePaiement: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                montant: true,
                datePaiement: true,
                cycle: { select: { tontine: { select: { nom: true } } } },
              },
              orderBy: { datePaiement: "desc" },
            }).then((rows) => rows as ContributionResult[])
          : Promise.resolve([] as ContributionResult[]),

        // REMBOURSEMENT CRÉDIT (encaissement)
        includeEnc && matchCat("REMBOURSEMENT_CREDIT")
          ? prisma.creditTransaction.findMany({
              where: { type: "REMBOURSEMENT", createdAt: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                montant: true,
                createdAt: true,
                creditId: true,
                credit: {
                  select: {
                    member: { select: { nom: true, prenom: true } },
                    client: { select: { nom: true, prenom: true } },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            }).then((rows) => rows as CreditTransactionResult[])
          : Promise.resolve([] as CreditTransactionResult[]),

        // CRÉDIT DÉCAISSÉ (décaissement)
        includeDec && matchCat("CREDIT_DECAISSE")
          ? prisma.creditTransaction.findMany({
              where: { type: "DECAISSEMENT", createdAt: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                montant: true,
                createdAt: true,
                creditId: true,
                credit: {
                  select: {
                    member: { select: { nom: true, prenom: true } },
                    client: { select: { nom: true, prenom: true } },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            }).then((rows) => rows as CreditTransactionResult[])
          : Promise.resolve([] as CreditTransactionResult[]),

        // APPROVISIONNEMENT (décaissement)
        includeDec && matchCat("APPROVISIONNEMENT")
          ? prisma.mouvementStock.findMany({
              where: { type: "ENTREE", dateMouvement: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                quantite: true,
                dateMouvement: true,
                reference: true,
                motif: true,
                produit: { select: { nom: true, prixUnitaire: true } },
              },
              orderBy: { dateMouvement: "desc" },
            }).then((rows) => rows as ApproResult[])
          : Promise.resolve([] as ApproResult[]),

        // POT TONTINE versé (décaissement)
        includeDec && matchCat("POT_TONTINE")
          ? prisma.tontineCycle.findMany({
              where: { statut: "COMPLETE", dateCloture: { gte: dateDebut, lte: dateFin } },
              select: {
                id: true,
                montantPot: true,
                numeroCycle: true,
                dateCloture: true,
                tontine: { select: { nom: true } },
                beneficiaire: {
                  select: {
                    member: { select: { nom: true, prenom: true } },
                    client: { select: { nom: true, prenom: true } },
                  },
                },
              },
              orderBy: { dateCloture: "desc" },
            }).then((rows) => rows as PotTontineResult[])
          : Promise.resolve([] as PotTontineResult[]),
      ]);

    // ── Transformation en écritures uniformes ──────────────────────────────

    const entries: JournalEntry[] = [];

    for (const v of ventes) {
      const who = v.creditAlimentaire?.member ?? v.creditAlimentaire?.client;
      entries.push({
        id: `VENTE-${v.id}`,
        sourceId: v.id,
        date: v.createdAt,
        type: "ACTIVITE",
        categorie: "VENTE",
        libelle: `Vente ${v.produit.nom} ×${v.quantite}${who ? ` — ${who.prenom} ${who.nom}` : ""}`,
        montant: v.quantite * Number(v.prixUnitaire),
        reference: `V#${v.id}`,
      });
    }

    for (const c of cotisations) {
      if (!c.datePaiement) continue;
      const who = c.member ?? c.client;
      entries.push({
        id: `COT-${c.id}`,
        sourceId: c.id,
        date: c.datePaiement,
        type: "ENCAISSEMENT",
        categorie: "COTISATION",
        libelle: `Cotisation ${c.periode.toLowerCase()}${who ? ` — ${who.prenom} ${who.nom}` : ""}`,
        montant: Number(c.montant),
        reference: `COT#${c.id}`,
      });
    }

    for (const ct of contributions) {
      if (!ct.datePaiement) continue;
      entries.push({
        id: `CONTRIB-${ct.id}`,
        sourceId: ct.id,
        date: ct.datePaiement,
        type: "ENCAISSEMENT",
        categorie: "CONTRIBUTION_TONTINE",
        libelle: `Contribution tontine "${ct.cycle.tontine.nom}"`,
        montant: Number(ct.montant),
        reference: `CONTRIB#${ct.id}`,
      });
    }

    for (const cr of rembCredits) {
      const who = cr.credit.member ?? cr.credit.client;
      entries.push({
        id: `RMB-${cr.id}`,
        sourceId: cr.id,
        date: cr.createdAt,
        type: "ENCAISSEMENT",
        categorie: "REMBOURSEMENT_CREDIT",
        libelle: `Remboursement crédit #${cr.creditId}${who ? ` — ${who.prenom} ${who.nom}` : ""}`,
        montant: Number(cr.montant),
        reference: `RMB#${cr.id}`,
      });
    }

    for (const cd of decaisCredits) {
      const who = cd.credit.member ?? cd.credit.client;
      entries.push({
        id: `DEC-${cd.id}`,
        sourceId: cd.id,
        date: cd.createdAt,
        type: "DECAISSEMENT",
        categorie: "CREDIT_DECAISSE",
        libelle: `Décaissement crédit #${cd.creditId}${who ? ` — ${who.prenom} ${who.nom}` : ""}`,
        montant: Number(cd.montant),
        reference: `DEC#${cd.id}`,
      });
    }

    for (const m of appros) {
      entries.push({
        id: `APPRO-${m.id}`,
        sourceId: m.id,
        date: m.dateMouvement,
        type: "DECAISSEMENT",
        categorie: "APPROVISIONNEMENT",
        libelle: `Appro. ${m.produit.nom} ×${m.quantite}${m.motif ? ` (${m.motif})` : ""}`,
        montant: m.quantite * Number(m.produit.prixUnitaire),
        reference: m.reference,
      });
    }

    for (const pt of potsTontines) {
      if (!pt.dateCloture) continue;
      const who = pt.beneficiaire.member ?? pt.beneficiaire.client;
      entries.push({
        id: `POT-${pt.id}`,
        sourceId: pt.id,
        date: pt.dateCloture,
        type: "DECAISSEMENT",
        categorie: "POT_TONTINE",
        libelle: `Versement pot "${pt.tontine.nom}" cycle #${pt.numeroCycle}${who ? ` — ${who.prenom} ${who.nom}` : ""}`,
        montant: Number(pt.montantPot),
        reference: `POT#${pt.id}`,
      });
    }

    // ── Filtre search ──────────────────────────────────────────────────────

    const filtered = search
      ? entries.filter(
          (e) =>
            e.libelle.toLowerCase().includes(search) ||
            e.reference.toLowerCase().includes(search)
        )
      : entries;

    // ── Tri par date décroissante ──────────────────────────────────────────

    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

    // ── Totaux (sur tout le résultat filtré avant pagination) ──────────────

    const totalEncaissements = filtered
      .filter((e) => e.type === "ENCAISSEMENT")
      .reduce((s, e) => s + e.montant, 0);
    const totalDecaissements = filtered
      .filter((e) => e.type === "DECAISSEMENT")
      .reduce((s, e) => s + e.montant, 0);
    const totalActivite = filtered
      .filter((e) => e.type === "ACTIVITE")
      .reduce((s, e) => s + e.montant, 0);

    // ── Pagination ────────────────────────────────────────────────────────

    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginated  = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginated.map((e) => ({ ...e, date: e.date.toISOString() })),
      totaux: {
        encaissements: totalEncaissements,
        decaissements: totalDecaissements,
        activite: totalActivite,
        net: totalEncaissements - totalDecaissements,
      },
      meta: {
        total,
        page,
        limit,
        totalPages,
        dateDebut: dateDebut.toISOString(),
        dateFin:   dateFin.toISOString(),
      },
    });
  } catch (error) {
    console.error("COMPTABLE JOURNAL ERROR:", error);
    return NextResponse.json({ success: false, message: "Erreur serveur" }, { status: 500 });
  }
}
