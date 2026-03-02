import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/journal
 *
 * Sources incluses :
 *   1. VersementPack          → ENCAISSEMENT (packs)
 *   2. MouvementStock ENTREE  → DECAISSEMENT (approvisionnements)
 *   3. OperationCaisse        → ENCAISSEMENT ou DECAISSEMENT (caisse : salaires, loyers, etc.)
 *
 * Paramètres :
 *   page, limit, grandlivre=1
 *   type: TOUS | ENCAISSEMENT | DECAISSEMENT
 *   categorie: (voir JournalCategory ci-dessous)
 *   search, dateDebut, dateFin
 */

type JournalType     = "ENCAISSEMENT" | "DECAISSEMENT";
type JournalCategory =
  // VersementPack
  | "COTISATION_INITIALE"
  | "VERSEMENT_PERIODIQUE"
  | "REMBOURSEMENT"
  | "VERSEMENT_PACK"
  // MouvementStock
  | "APPROVISIONNEMENT"
  // OperationCaisse décaissements
  | "SALAIRE"
  | "AVANCE"
  | "FOURNISSEUR"
  | "CAISSE_AUTRE"
  // OperationCaisse encaissements
  | "CAISSE_ENCAISSEMENT";

interface JournalEntry {
  id:        string;
  sourceId:  number;
  date:      Date;
  type:      JournalType;
  categorie: JournalCategory;
  libelle:   string;
  montant:   number;
  reference: string;
}

// Catégories qui proviennent exclusivement de l'OperationCaisse
const CAISSE_CATS = new Set<string>(["SALAIRE", "AVANCE", "FOURNISSEUR", "CAISSE_AUTRE", "CAISSE_ENCAISSEMENT"]);
// Catégories qui proviennent exclusivement du VersementPack
const PACK_CATS   = new Set<string>(["COTISATION_INITIALE", "VERSEMENT_PERIODIQUE", "REMBOURSEMENT", "VERSEMENT_PACK"]);

function typeToCategorie(type: string): JournalCategory {
  switch (type) {
    case "COTISATION_INITIALE":  return "COTISATION_INITIALE";
    case "VERSEMENT_PERIODIQUE": return "VERSEMENT_PERIODIQUE";
    case "REMBOURSEMENT":        return "REMBOURSEMENT";
    default:                     return "VERSEMENT_PACK";
  }
}

function catDecToCategorie(cat: string | null): JournalCategory {
  switch (cat) {
    case "SALAIRE":     return "SALAIRE";
    case "AVANCE":      return "AVANCE";
    case "FOURNISSEUR": return "FOURNISSEUR";
    default:            return "CAISSE_AUTRE";
  }
}

const TYPE_LABELS: Record<string, string> = {
  COTISATION_INITIALE:  "Acompte initial",
  VERSEMENT_PERIODIQUE: "Versement périodique",
  REMBOURSEMENT:        "Remboursement",
  BONUS:                "Bonus",
  AJUSTEMENT:           "Ajustement",
};

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) {
      return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const isGrandLivre = searchParams.get("grandlivre") === "1";
    const page       = isGrandLivre ? 1 : Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit      = isGrandLivre ? 1000 : Math.min(50, Math.max(10, Number(searchParams.get("limit") ?? "20")));
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

    // Est-ce qu'on doit interroger chaque source ?
    const queryCaisseOnly = catFilter !== "" && CAISSE_CATS.has(catFilter);
    const queryPackOnly   = catFilter !== "" && PACK_CATS.has(catFilter);
    const queryAppro      = catFilter === "" || catFilter === "APPROVISIONNEMENT";
    const queryPack       = catFilter === "" || queryPackOnly;
    const queryCaisse     = catFilter === "" || queryCaisseOnly;

    // VersementPack types à récupérer
    const versPackTypes: string[] =
      catFilter === "COTISATION_INITIALE"  ? ["COTISATION_INITIALE"] :
      catFilter === "VERSEMENT_PERIODIQUE" ? ["VERSEMENT_PERIODIQUE"] :
      catFilter === "REMBOURSEMENT"        ? ["REMBOURSEMENT"] :
      catFilter === "VERSEMENT_PACK"       ? ["BONUS", "AJUSTEMENT"] :
      ["COTISATION_INITIALE", "VERSEMENT_PERIODIQUE", "REMBOURSEMENT", "BONUS", "AJUSTEMENT"];

    // OperationCaisse : filtre sur catégorie DECAISSEMENT si applicable
    const caisseCatFilter: string[] =
      catFilter === "SALAIRE"     ? ["SALAIRE"] :
      catFilter === "AVANCE"      ? ["AVANCE"] :
      catFilter === "FOURNISSEUR" ? ["FOURNISSEUR"] :
      catFilter === "CAISSE_AUTRE" ? ["AUTRE"] :
      ["SALAIRE", "AVANCE", "FOURNISSEUR", "AUTRE"];

    const [versements, appros, opsEnc, opsDec] = await Promise.all([

      // 1. VersementPack → ENCAISSEMENT
      includeEnc && queryPack
        ? prisma.versementPack.findMany({
            where: {
              datePaiement: { gte: dateDebut, lte: dateFin },
              ...(versPackTypes.length < 5
                ? { type: { in: versPackTypes as ("COTISATION_INITIALE" | "VERSEMENT_PERIODIQUE" | "REMBOURSEMENT" | "BONUS" | "AJUSTEMENT")[] } }
                : {}),
            },
            select: {
              id: true,
              datePaiement: true,
              montant: true,
              type: true,
              notes: true,
              encaisseParNom: true,
              souscription: {
                select: {
                  pack:   { select: { nom: true, type: true } },
                  client: { select: { nom: true, prenom: true } },
                  user:   { select: { nom: true, prenom: true } },
                },
              },
            },
            orderBy: { datePaiement: "desc" },
          })
        : Promise.resolve([]),

      // 2. MouvementStock ENTREE → DECAISSEMENT
      includeDec && queryAppro
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
          })
        : Promise.resolve([]),

      // 3. OperationCaisse ENCAISSEMENT
      includeEnc && (catFilter === "" || catFilter === "CAISSE_ENCAISSEMENT")
        ? prisma.operationCaisse.findMany({
            where: { type: "ENCAISSEMENT", createdAt: { gte: dateDebut, lte: dateFin } },
            select: {
              id: true,
              montant: true,
              motif: true,
              reference: true,
              operateurNom: true,
              mode: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),

      // 4. OperationCaisse DECAISSEMENT (salaires, avances, fournisseurs, autre)
      includeDec && queryCaisse
        ? prisma.operationCaisse.findMany({
            where: {
              type: "DECAISSEMENT",
              createdAt: { gte: dateDebut, lte: dateFin },
              ...(catFilter !== "" && CAISSE_CATS.has(catFilter) && catFilter !== "CAISSE_ENCAISSEMENT"
                ? { categorie: { in: caisseCatFilter as ("SALAIRE" | "AVANCE" | "FOURNISSEUR" | "AUTRE")[] } }
                : {}),
            },
            select: {
              id: true,
              montant: true,
              motif: true,
              reference: true,
              categorie: true,
              operateurNom: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
    ]);

    // ── Transformation en écritures uniformes ────────────────────────────────

    const entries: JournalEntry[] = [];

    // VersementPack
    for (const v of versements) {
      const cat    = typeToCategorie(v.type);
      const person = v.souscription.client ?? v.souscription.user;
      const pack   = `${v.souscription.pack.nom} (${v.souscription.pack.type})`;
      entries.push({
        id:        `VER-${v.id}`,
        sourceId:  v.id,
        date:      v.datePaiement,
        type:      "ENCAISSEMENT",
        categorie: cat,
        libelle:   `${TYPE_LABELS[v.type] ?? v.type} — ${pack}${person ? ` — ${person.prenom} ${person.nom}` : ""}`,
        montant:   Number(v.montant),
        reference: `VER-${String(v.id).padStart(6, "0")}`,
      });
    }

    // MouvementStock
    for (const m of appros) {
      entries.push({
        id:        `APPRO-${m.id}`,
        sourceId:  m.id,
        date:      m.dateMouvement,
        type:      "DECAISSEMENT",
        categorie: "APPROVISIONNEMENT",
        libelle:   `Appro. ${m.produit.nom} ×${m.quantite}${m.motif ? ` (${m.motif})` : ""}`,
        montant:   m.quantite * Number(m.produit.prixUnitaire),
        reference: m.reference,
      });
    }

    // OperationCaisse Encaissements
    for (const op of opsEnc) {
      entries.push({
        id:        `OPC-ENC-${op.id}`,
        sourceId:  op.id,
        date:      op.createdAt,
        type:      "ENCAISSEMENT",
        categorie: "CAISSE_ENCAISSEMENT",
        libelle:   `Encaissement caisse — ${op.motif}${op.mode ? ` (${op.mode})` : ""} — ${op.operateurNom}`,
        montant:   Number(op.montant),
        reference: op.reference,
      });
    }

    // OperationCaisse Décaissements
    for (const op of opsDec) {
      const cat = catDecToCategorie(op.categorie);
      entries.push({
        id:        `OPC-DEC-${op.id}`,
        sourceId:  op.id,
        date:      op.createdAt,
        type:      "DECAISSEMENT",
        categorie: cat,
        libelle:   `${cat === "SALAIRE" ? "Salaire" : cat === "AVANCE" ? "Avance" : cat === "FOURNISSEUR" ? "Fournisseur" : "Décaissement"} — ${op.motif} — ${op.operateurNom}`,
        montant:   Number(op.montant),
        reference: op.reference,
      });
    }

    // ── Filtre search ─────────────────────────────────────────────────────────

    const filtered = search
      ? entries.filter(
          (e) =>
            e.libelle.toLowerCase().includes(search) ||
            e.reference.toLowerCase().includes(search)
        )
      : entries;

    // ── Tri par date décroissante ─────────────────────────────────────────────

    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

    // ── Totaux ────────────────────────────────────────────────────────────────

    const totalEncaissements = filtered
      .filter((e) => e.type === "ENCAISSEMENT")
      .reduce((s, e) => s + e.montant, 0);
    const totalDecaissements = filtered
      .filter((e) => e.type === "DECAISSEMENT")
      .reduce((s, e) => s + e.montant, 0);

    // ── Pagination ────────────────────────────────────────────────────────────

    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginated  = filtered.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      success: true,
      data: paginated.map((e) => ({ ...e, date: e.date.toISOString() })),
      totaux: {
        encaissements: totalEncaissements,
        decaissements: totalDecaissements,
        activite: 0,
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
