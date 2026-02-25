import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

/**
 * GET /api/comptable/journal
 *
 * Journal comptable basé sur les packs.
 * Paramètres :
 *   - page, limit
 *   - type: TOUS | ENCAISSEMENT | DECAISSEMENT
 *   - categorie: COTISATION_INITIALE | VERSEMENT_PERIODIQUE | REMBOURSEMENT
 *                | VERSEMENT_PACK | APPROVISIONNEMENT
 *   - search: recherche dans le libellé
 *   - dateDebut, dateFin
 */

type JournalType     = "ENCAISSEMENT" | "DECAISSEMENT";
type JournalCategory =
  | "COTISATION_INITIALE"
  | "VERSEMENT_PERIODIQUE"
  | "REMBOURSEMENT"
  | "VERSEMENT_PACK"
  | "APPROVISIONNEMENT";

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

interface VersementResult {
  id:            number;
  datePaiement:  Date;
  montant:       { toNumber(): number } | number;
  type:          string;
  notes:         string | null;
  encaisseParNom: string | null;
  souscription: {
    pack:   { nom: string; type: string };
    client: { nom: string; prenom: string } | null;
    user:   { nom: string; prenom: string } | null;
  };
}

interface ApproResult {
  id:            number;
  quantite:      number;
  dateMouvement: Date;
  reference:     string;
  motif:         string | null;
  produit:       { nom: string; prixUnitaire: { toNumber(): number } | number };
}

// TypeVersement → JournalCategory
function typeToCategorie(type: string): JournalCategory {
  switch (type) {
    case "COTISATION_INITIALE":  return "COTISATION_INITIALE";
    case "VERSEMENT_PERIODIQUE": return "VERSEMENT_PERIODIQUE";
    case "REMBOURSEMENT":        return "REMBOURSEMENT";
    default:                     return "VERSEMENT_PACK"; // BONUS, AJUSTEMENT
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

    const matchCat = (cat: JournalCategory) => !catFilter || catFilter === cat;

    // Determine which VersementPack types to query
    const versPackTypes: string[] =
      catFilter === "COTISATION_INITIALE"  ? ["COTISATION_INITIALE"] :
      catFilter === "VERSEMENT_PERIODIQUE" ? ["VERSEMENT_PERIODIQUE"] :
      catFilter === "REMBOURSEMENT"        ? ["REMBOURSEMENT"] :
      catFilter === "VERSEMENT_PACK"       ? ["BONUS", "AJUSTEMENT"] :
      catFilter === "APPROVISIONNEMENT"    ? [] :
      ["COTISATION_INITIALE", "VERSEMENT_PERIODIQUE", "REMBOURSEMENT", "BONUS", "AJUSTEMENT"];

    const [versements, appros] = await Promise.all([

      // VersementPack → ENCAISSEMENT
      includeEnc && versPackTypes.length > 0 && catFilter !== "APPROVISIONNEMENT"
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
          }).then((rows) => rows as VersementResult[])
        : Promise.resolve([] as VersementResult[]),

      // MouvementStock ENTREE → DECAISSEMENT
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
    ]);

    // ── Transformation en écritures uniformes ──────────────────────────────

    const entries: JournalEntry[] = [];

    for (const v of versements) {
      const cat = typeToCategorie(v.type);
      if (!matchCat(cat)) continue;
      const person    = v.souscription.client ?? v.souscription.user;
      const packLabel = `${v.souscription.pack.nom} (${v.souscription.pack.type})`;
      entries.push({
        id:        `VER-${v.id}`,
        sourceId:  v.id,
        date:      v.datePaiement,
        type:      "ENCAISSEMENT",
        categorie: cat,
        libelle:   `${TYPE_LABELS[v.type] ?? v.type} — ${packLabel}${person ? ` — ${person.prenom} ${person.nom}` : ""}`,
        montant:   Number(v.montant),
        reference: `VER-${String(v.id).padStart(6, "0")}`,
      });
    }

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

    // ── Totaux ────────────────────────────────────────────────────────────

    const totalEncaissements = filtered
      .filter((e) => e.type === "ENCAISSEMENT")
      .reduce((s, e) => s + e.montant, 0);
    const totalDecaissements = filtered
      .filter((e) => e.type === "DECAISSEMENT")
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
