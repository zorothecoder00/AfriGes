import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/produits
 * Liste des produits avec stock total (somme de tous les PDV).
 * Query: search, categorie, actif, page, limit
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page      = Math.max(1, Number(searchParams.get("page")  || 1));
    const limit     = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
    const skip      = (page - 1) * limit;
    const search    = searchParams.get("search")   || "";
    const categorie = searchParams.get("categorie")|| "";
    const actifQ    = searchParams.get("actif");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (search)    where.OR = [
      { nom:         { contains: search, mode: "insensitive" } },
      { reference:   { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
    if (categorie) where.categorie = { contains: categorie, mode: "insensitive" };
    if (actifQ !== null && actifQ !== "") where.actif = actifQ === "true";

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: "asc" },
        include: {
          stocks: {
            include: { pointDeVente: { select: { id: true, nom: true, code: true } } },
          },
        },
      }),
      prisma.produit.count({ where }),
    ]);

    // Enrichir chaque produit avec le stock total (somme tous PDV)
    const data = produits.map(p => ({
      ...p,
      stockTotal:  p.stocks.reduce((acc, s) => acc + s.quantite, 0),
      enRupture:   p.stocks.every(s => s.quantite === 0),
      stockFaible: p.stocks.some(s => s.quantite > 0 && s.quantite <= (s.alerteStock ?? p.alerteStock)),
    }));

    return NextResponse.json({
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /logistique/produits:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/produits
 * Créer un nouveau produit.
 * Body: { nom, description?, reference?, categorie?, unite?, prixUnitaire, alerteStock? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, description, reference, categorie, unite, prixUnitaire, alerteStock } = body;

    if (!nom || prixUnitaire === undefined) {
      return NextResponse.json({ error: "nom et prixUnitaire sont obligatoires" }, { status: 400 });
    }
    if (Number(prixUnitaire) <= 0) {
      return NextResponse.json({ error: "Le prix unitaire doit être supérieur à 0" }, { status: 400 });
    }

    if (reference) {
      const existing = await prisma.produit.findUnique({ where: { reference } });
      if (existing) return NextResponse.json({ error: `La référence "${reference}" est déjà utilisée` }, { status: 409 });
    }

    const produit = await prisma.$transaction(async (tx) => {
      const p = await tx.produit.create({
        data: {
          nom,
          description: description || null,
          reference:   reference   || null,
          categorie:   categorie   || null,
          unite:       unite       || null,
          prixUnitaire:new Prisma.Decimal(prixUnitaire),
          alerteStock: Number(alerteStock) || 0,
        },
      });

      await auditLog(tx, parseInt(session.user.id), "PRODUIT_CREE", "Produit", p.id);

      await notifyRoles(tx, ["MAGAZINIER", "RESPONSABLE_POINT_DE_VENTE"], {
        titre:    `Nouveau produit : ${p.nom}`,
        message:  `${session.user.prenom} ${session.user.nom} a créé le produit "${p.nom}" (réf: ${p.reference ?? "—"}) au prix de ${Number(p.prixUnitaire).toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl:`/dashboard/admin/stock`,
      });

      return p;
    });

    return NextResponse.json({ data: produit }, { status: 201 });
  } catch (error) {
    console.error("POST /logistique/produits:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
