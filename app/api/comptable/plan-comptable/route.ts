import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

// Plan SYSCOHADA minimal pré-défini pour import rapide
const PLAN_SYSCOHADA_BASE = [
  // Classe 1 - Ressources durables
  { numero: "101", libelle: "Capital social", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "106", libelle: "Réserves", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "131", libelle: "Résultat net : Bénéfice", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "132", libelle: "Résultat net : Perte", classe: 1, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "162", libelle: "Emprunts et dettes financières", classe: 1, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  // Classe 2 - Actifs immobilisés
  { numero: "211", libelle: "Terrains", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "231", libelle: "Bâtiments", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "244", libelle: "Matériel et mobilier", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "245", libelle: "Matériel de transport", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "248", libelle: "Matériel informatique", classe: 2, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  // Classe 3 - Stocks
  { numero: "31",  libelle: "Stocks de marchandises", classe: 3, type: "ACTIF", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  { numero: "311", libelle: "Marchandises", classe: 3, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "32",  libelle: "Matières premières et fournitures", classe: 3, type: "ACTIF", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  // Classe 4 - Comptes de tiers
  { numero: "401", libelle: "Fournisseurs", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "408", libelle: "Fournisseurs - Factures non reçues", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "411", libelle: "Clients", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "418", libelle: "Clients - Produits non encore facturés", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "421", libelle: "Personnel - Rémunérations dues", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "431", libelle: "CNSS", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "441", libelle: "État - Impôts et taxes", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "4431", libelle: "TVA collectée (18%)", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "4432", libelle: "TVA déductible sur achats", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "4435", libelle: "TVA à décaisser", classe: 4, type: "PASSIF", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "471", libelle: "Débiteurs divers", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "481", libelle: "Créances sur cessions d'immobilisations", classe: 4, type: "ACTIF", nature: "DETAIL", sens: "DEBITEUR" },
  // Classe 5 - Trésorerie
  { numero: "521", libelle: "Banques comptes courants", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "57",  libelle: "Caisse", classe: 5, type: "TRESORERIE", nature: "REGROUPEMENT", sens: "DEBITEUR" },
  { numero: "571", libelle: "Caisse siège", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "572", libelle: "Caisse succursale", classe: 5, type: "TRESORERIE", nature: "DETAIL", sens: "DEBITEUR" },
  // Classe 6 - Charges
  { numero: "601", libelle: "Achats de marchandises", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "602", libelle: "Achats de matières premières et fournitures", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "604", libelle: "Achats stockés - Matières et fournitures consommables", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "605", libelle: "Autres achats", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "611", libelle: "Transport de biens et transit", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "621", libelle: "Personnel extérieur à l'entreprise", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "623", libelle: "Publicité, publications, relations publiques", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "631", libelle: "Frais bancaires", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "641", libelle: "Impôts et taxes locaux", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "661", libelle: "Rémunérations directes versées au personnel", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "664", libelle: "Charges sociales (CNSS, etc.)", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  { numero: "681", libelle: "Dotations aux amortissements", classe: 6, type: "CHARGES", nature: "DETAIL", sens: "DEBITEUR" },
  // Classe 7 - Produits
  { numero: "701", libelle: "Ventes de marchandises", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "706", libelle: "Services vendus", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "707", libelle: "Produits accessoires", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "721", libelle: "Variation des stocks de biens produits", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "755", libelle: "Quotes-parts de résultat sur opérations faites en commun", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "771", libelle: "Intérêts de prêts et créances", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
  { numero: "781", libelle: "Transferts de charges d'exploitation", classe: 7, type: "PRODUITS", nature: "DETAIL", sens: "CREDITEUR" },
];

export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search   = searchParams.get("search") || "";
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
