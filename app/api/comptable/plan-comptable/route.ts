import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

// Plan SYSCOHADA de base pour import rapide (CDC Comptabilité §5). Ne couvre pas
// les ~500 comptes de la nomenclature officielle, mais un socle réaliste pour une
// PME commerciale togolaise, couvrant les 8 classes. Les comptes déjà livrés
// (marqués ci-dessous) ne sont JAMAIS renumérotés ou relabellisés — un import déjà
// effectué chez un client ne doit jamais changer de sens. Seuls des comptes
// supplémentaires ont été ajoutés. Certains numéros (165, 1672, 416, 776, 676)
// sont indispensables au module RIA (lib/riaComptable.ts) : sans eux, ses lignes
// d'écriture correspondantes étaient silencieusement omises faute de compte.
const PLAN_SYSCOHADA_BASE = [
  // ── Classe 1 — Ressources durables ──────────────────────────────────────────
  { numero: "101", libelle: "Capital social", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "104", libelle: "Primes liées au capital social", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "106", libelle: "Réserves", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "1061", libelle: "Réserve légale", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "1068", libelle: "Autres réserves", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "11",  libelle: "Report à nouveau", classe: 1, type: "PASSIF", nature: "REGROUPEMENT", sens: "CREDITEUR" },
  { numero: "110", libelle: "Report à nouveau créditeur", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "119", libelle: "Report à nouveau débiteur", classe: 1, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "131", libelle: "Résultat net : Bénéfice", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "132", libelle: "Résultat net : Perte", classe: 1, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "141", libelle: "Subventions d'équipement", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "151", libelle: "Amortissements dérogatoires", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "162", libelle: "Emprunts et dettes financières", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "163", libelle: "Avances reçues et comptes courants bloqués", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "165", libelle: "Provisions financières pour risques et charges (RIA)", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "1672", libelle: "Comptes courants associés — investisseurs (RIA)", classe: 1, type: "PASSIF", nature: "AUXILIAIRE", sens: "CREDITEUR" },
  { numero: "191", libelle: "Provisions pour litiges", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "198", libelle: "Autres provisions pour charges", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },

  // ── Classe 2 — Charges immobilisées & immobilisations ───────────────────────
  { numero: "201", libelle: "Frais de développement", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "212", libelle: "Brevets, licences, logiciels", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "213", libelle: "Fonds commercial", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "214", libelle: "Droit au bail", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "211", libelle: "Terrains", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "231", libelle: "Bâtiments", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "244", libelle: "Matériel et mobilier", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "245", libelle: "Matériel de transport", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "248", libelle: "Matériel informatique", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "25",  libelle: "Avances et acomptes versés sur immobilisations", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "26",  libelle: "Titres de participation", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "274", libelle: "Prêts", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "275", libelle: "Dépôts et cautionnements versés", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "281", libelle: "Amortissements des immobilisations incorporelles", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "2831", libelle: "Amortissements des bâtiments", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "2844", libelle: "Amortissements du matériel et mobilier", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "2845", libelle: "Amortissements du matériel de transport", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "2848", libelle: "Amortissements du matériel informatique", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "291", libelle: "Provisions pour dépréciation des immobilisations", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },

  // ── Classe 3 — Stocks ────────────────────────────────────────────────────────
  { numero: "31",  libelle: "Stocks de marchandises", classe: 3, type: "ACTIF", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  { numero: "311", libelle: "Marchandises", classe: 3, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "32",  libelle: "Matières premières et fournitures", classe: 3, type: "ACTIF", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  { numero: "391", libelle: "Dépréciation des stocks de marchandises", classe: 3, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },

  // ── Classe 4 — Comptes de tiers ──────────────────────────────────────────────
  { numero: "401", libelle: "Fournisseurs", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "402", libelle: "Fournisseurs — avances et acomptes versés", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "408", libelle: "Fournisseurs - Factures non reçues", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "409", libelle: "Fournisseurs débiteurs", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "411", libelle: "Clients", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "413", libelle: "Clients — retenues de garantie", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "416", libelle: "Créances clients — financement RIA", classe: 4, type: "ACTIF", nature: "AUXILIAIRE", sens: "DEBITEUR" },
  { numero: "418", libelle: "Clients - Produits non encore facturés", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "419", libelle: "Clients créditeurs (avances reçues)", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "421", libelle: "Personnel - Rémunérations dues", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "425", libelle: "Personnel — avances et acomptes", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "431", libelle: "CNSS", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "441", libelle: "État - Impôts et taxes", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "4431", libelle: "TVA collectée (18%)", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "4432", libelle: "TVA déductible sur achats", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "4435", libelle: "TVA à décaisser", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "444", libelle: "État — Impôts sur les bénéfices", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "447", libelle: "État — Impôts retenus à la source", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "471", libelle: "Débiteurs divers", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "476", libelle: "Écarts de conversion — actif", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "477", libelle: "Écarts de conversion — passif", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "481", libelle: "Créances sur cessions d'immobilisations", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "491", libelle: "Dépréciation des comptes clients", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "CREDITEUR" },

  // ── Classe 5 — Trésorerie ────────────────────────────────────────────────────
  { numero: "519", libelle: "Concours bancaires courants", classe: 5, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "521", libelle: "Banques comptes courants", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "57",  libelle: "Caisse", classe: 5, type: "TRESORERIE", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  { numero: "571", libelle: "Caisse siège", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "572", libelle: "Caisse succursale", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "585", libelle: "Virements de fonds", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },

  // ── Classe 6 — Charges ───────────────────────────────────────────────────────
  { numero: "601", libelle: "Achats de marchandises", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "602", libelle: "Achats de matières premières et fournitures", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "604", libelle: "Achats stockés - Matières et fournitures consommables", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "605", libelle: "Autres achats", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "606", libelle: "Achats non stockés de matières et fournitures", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "608", libelle: "Achats d'emballages", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "611", libelle: "Transport de biens et transit", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "613", libelle: "Locations", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "616", libelle: "Primes d'assurance", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "621", libelle: "Personnel extérieur à l'entreprise", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "622", libelle: "Rémunérations d'intermédiaires et honoraires", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "623", libelle: "Publicité, publications, relations publiques", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "624", libelle: "Transports du personnel", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "625", libelle: "Déplacements, missions et réceptions", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "626", libelle: "Frais postaux et de télécommunications", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "627", libelle: "Services bancaires et assimilés", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "628", libelle: "Divers (services extérieurs)", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "631", libelle: "Frais bancaires", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "633", libelle: "Frais de formation du personnel", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "635", libelle: "Autres impôts et taxes", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "641", libelle: "Impôts et taxes locaux", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "651", libelle: "Pertes sur créances irrécouvrables", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "658", libelle: "Charges diverses", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "661", libelle: "Rémunérations directes versées au personnel", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "663", libelle: "Indemnités forfaitaires versées aux dirigeants", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "664", libelle: "Charges sociales (CNSS, etc.)", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "671", libelle: "Intérêts des emprunts", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "674", libelle: "Autres intérêts", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "676", libelle: "Charges d'intérêts / distributions (RIA)", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "681", libelle: "Dotations aux amortissements", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "691", libelle: "Dotations aux provisions pour risques et charges", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },

  // ── Classe 7 — Produits ──────────────────────────────────────────────────────
  { numero: "701", libelle: "Ventes de marchandises", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "705", libelle: "Travaux facturés", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "706", libelle: "Services vendus", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "707", libelle: "Produits accessoires", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "721", libelle: "Variation des stocks de biens produits", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "755", libelle: "Quotes-parts de résultat sur opérations faites en commun", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "758", libelle: "Produits divers", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "771", libelle: "Intérêts de prêts et créances", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "776", libelle: "Revenus des participations (RIA)", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "781", libelle: "Transferts de charges d'exploitation", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "786", libelle: "Reprises de provisions", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "798", libelle: "Reprises d'amortissements", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },

  // ── Classe 8 — Autres charges/produits (HAO) ─────────────────────────────────
  { numero: "81", libelle: "Valeurs comptables des cessions d'immobilisations", classe: 8, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "82", libelle: "Produits des cessions d'immobilisations", classe: 8, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "83", libelle: "Charges hors activités ordinaires (HAO)", classe: 8, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "84", libelle: "Produits hors activités ordinaires (HAO)", classe: 8, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "891", libelle: "Impôts sur le résultat", classe: 8, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
];

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search   = ( searchParams.get("search") || "" ).trim();
    const classe   = searchParams.get("classe");
    const type     = searchParams.get("type");
    const nature   = searchParams.get("nature");
    const actif    = searchParams.get("actif");
    const page     = Math.max(1, Number(searchParams.get("page") || 1));
    const limit    = Math.min(200, Math.max(1, Number(searchParams.get("limit") || 100)));
    const skip     = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      ...(search && {
        OR: [
          { numero:  { contains: search, mode: "insensitive" } },
          { libelle: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(classe  && { classe: Number(classe) }),
      ...(type    && { type }),
      ...(nature  && { nature }),
      ...(actif !== null && actif !== "" && { actif: actif === "true" }),
    };

    const [comptes, total] = await Promise.all([
      prisma.compteComptable.findMany({
        where,
        include: { compteParent: { select: { numero: true, libelle: true } } },
        orderBy: { numero: "asc" },
        skip,
        take: limit,
      }),
      prisma.compteComptable.count({ where }),
    ]);

    // Stats par classe
    const stats = await prisma.compteComptable.groupBy({
      by: ["classe"],
      _count: true,
      orderBy: { classe: "asc" },
    });

    return NextResponse.json({
      data: comptes,
      stats: stats.map((s) => ({ classe: s.classe, count: s._count })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { action } = body;

    // Import du plan SYSCOHADA de base
    if (action === "import_syscohada") {
      const existing = await prisma.compteComptable.count();
      if (existing > 0) {
        return NextResponse.json({ error: "Le plan comptable n'est pas vide. Supprimez d'abord les comptes existants." }, { status: 400 });
      }
      const created = await prisma.compteComptable.createMany({
        data: PLAN_SYSCOHADA_BASE.map((c) => ({
          ...c,
          type: c.type as import("@prisma/client").TypeCompte,
          nature: c.nature as import("@prisma/client").NatureCompte,
          sens: c.sens as import("@prisma/client").SensCompte,
        })),
        skipDuplicates: true,
      });
      return NextResponse.json({ success: true, count: created.count });
    }

    // Création d'un compte individuel
    const { numero, libelle, classe, type, nature, sens, compteParentId, tiersType, tiersNom } = body;
    if (!numero || !libelle || !classe || !type) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const compte = await prisma.compteComptable.create({
      data: {
        numero,
        libelle,
        classe: Number(classe),
        type,
        nature: nature || "DETAIL",
        sens: sens || "DEBITEUR",
        compteParentId: compteParentId ? Number(compteParentId) : null,
        tiersType: tiersType || null,
        tiersNom: tiersNom || null,
      },
    });
    return NextResponse.json({ data: compte }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce numéro de compte existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    const compte = await prisma.compteComptable.update({
      where: { id: Number(id) },
      data: {
        ...(data.libelle   !== undefined && { libelle: data.libelle }),
        ...(data.actif     !== undefined && { actif: Boolean(data.actif) }),
        ...(data.tiersType !== undefined && { tiersType: data.tiersType }),
        ...(data.tiersNom  !== undefined && { tiersNom: data.tiersNom }),
        ...(data.nature    !== undefined && { nature: data.nature }),
      },
    });
    return NextResponse.json({ data: compte });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
