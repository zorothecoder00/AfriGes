import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";
import { notifyAdmins } from "@/lib/notifications";
import { PrioriteNotification } from "@prisma/client";

async function resolvePdvId(session: Awaited<ReturnType<typeof getRVCSession>>): Promise<number | null> {
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  if (isAdmin) return null; // admin voit tout
  const aff = await prisma.gestionnaireAffectation.findFirst({
    where: { userId: parseInt(session.user.id), actif: true },
    select: { pointDeVenteId: true },
  });
  return aff?.pointDeVenteId ?? null;
}

/**
 * GET /api/rvc/produits
 * Recherche les produits disponibles dans le stock du PDV du RVC connecté.
 * Query: search, limit (défaut 10)
 * Retourne aussi la quantité en stock sur ce PDV.
 */
export async function GET(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await resolvePdvId(session);
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const limit  = Math.min(20, Math.max(1, Number(searchParams.get("limit") || 10)));

    const searchCond: Prisma.ProduitWhereInput = search
      ? {
          OR: [
            { nom:         { contains: search, mode: "insensitive" } },
            { reference:   { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const produits = await prisma.produit.findMany({
      where: {
        actif: true,
        ...searchCond,
      },
      take: limit,
      orderBy: { nom: "asc" },
      select: {
        id:           true,
        nom:          true,
        unite:        true,
        prixUnitaire: true,
        reference:    true,
        stocks: {
          where: { pointDeVenteId: pdvId },
          select: { quantite: true },
        },
      },
    });

    return NextResponse.json({
      data: produits.map((p) => ({
        id:           p.id,
        nom:          p.nom,
        unite:        p.unite,
        prixUnitaire: Number(p.prixUnitaire),
        reference:    p.reference,
        stock:        p.stocks[0]?.quantite ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /api/rvc/produits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/rvc/produits
 * Le RVC crée un produit directement dans le catalogue (sans validation).
 * Un StockSite à 0 est initialisé sur son PDV.
 * Body: { nom, prixUnitaire, unite?, description?, reference? }
 */
export async function POST(req: Request) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const pdvId = await resolvePdvId(session);
    if (!pdvId) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });

    const body = await req.json();
    const { nom, prixUnitaire, unite, description, reference } = body as {
      nom: string;
      prixUnitaire: number;
      unite?: string;
      description?: string;
      reference?: string;
    };

    if (!nom?.trim()) return NextResponse.json({ error: "Le nom du produit est requis" }, { status: 400 });
    if (!prixUnitaire || Number(prixUnitaire) <= 0) {
      return NextResponse.json({ error: "Le prix unitaire doit être positif" }, { status: 400 });
    }

    const rvcNom = `${session.user.prenom} ${session.user.nom}`;
    const userId = parseInt(session.user.id);

    const produit = await prisma.$transaction(async (tx) => {
      // Vérifier doublon de nom
      const existing = await tx.produit.findFirst({
        where: { nom: { equals: nom.trim(), mode: "insensitive" } },
        select: { id: true, nom: true },
      });
      if (existing) throw new Error(`PRODUIT_EXISTE:${existing.id}:${existing.nom}`);

      const created = await tx.produit.create({
        data: {
          nom:          nom.trim(),
          prixUnitaire: Number(prixUnitaire),
          unite:        unite?.trim() || null,
          description:  description?.trim() || null,
          reference:    reference?.trim() || null,
          actif:        true,
        },
      });

      // StockSite à 0 sur le PDV du RVC
      await tx.stockSite.create({
        data: {
          produitId:      created.id,
          pointDeVenteId: pdvId,
          quantite:       0,
        },
      });

      await tx.auditLog.create({
        data: {
          action:   "CREATION_PRODUIT_RVC",
          entite:   "Produit",
          entiteId: created.id,
          userId,
        },
      });

      await notifyAdmins(tx, {
        titre:    `Nouveau produit créé par le RVC`,
        message:  `${rvcNom} a ajouté le produit "${created.nom}" au catalogue (${Number(prixUnitaire).toLocaleString("fr-FR")} FCFA).`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/produits`,
      });

      return created;
    });

    return NextResponse.json({
      data: {
        id:           produit.id,
        nom:          produit.nom,
        unite:        produit.unite,
        prixUnitaire: Number(produit.prixUnitaire),
        reference:    produit.reference,
        stock:        0,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/rvc/produits", error);
    if (error instanceof Error && error.message.startsWith("PRODUIT_EXISTE:")) {
      const [, id, nom] = error.message.split(":");
      return NextResponse.json({ error: `Un produit nommé "${nom}" existe déjà`, existingId: Number(id) }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
