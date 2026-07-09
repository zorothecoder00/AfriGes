import { NextResponse } from "next/server";
import { Prisma, StatutProduit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { enregistrerChangementPrix } from "@/lib/prixProduit";
import { auditLog } from "@/lib/notifications";
import { buildProduitData, strOrNull, numOrNull } from "@/lib/catalogueProduit";

/**
 * GET /api/admin/catalogue/produits — liste catalogue (filtres + champs enrichis) — admin.
 * POST — création d'un produit riche avec code produit auto-généré (Catalogue §3).
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, Number(searchParams.get("page") || 1));
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const search = (searchParams.get("search") || "").trim();
  const statut = searchParams.get("statut") as StatutProduit | null;
  const familleId  = numOrNull(searchParams.get("familleId"));
  const categorieId = numOrNull(searchParams.get("categorieId"));
  const marqueId   = numOrNull(searchParams.get("marqueId"));

  const insensitive = { mode: "insensitive" as const };
  const where: Prisma.ProduitWhereInput = {
    ...(statut && { statut }),
    ...(familleId && { familleId }),
    ...(categorieId && { categorieId }),
    ...(marqueId && { marqueId }),
    ...(search && {
      OR: [
        { nom:           { contains: search, ...insensitive } },
        { nomCommercial: { contains: search, ...insensitive } },
        { reference:     { contains: search, ...insensitive } },
        { codeProduit:   { contains: search, ...insensitive } },
        { codeBarre:     { contains: search } },
      ],
    }),
  };

  const [produits, total] = await Promise.all([
    prisma.produit.findMany({
      where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, codeProduit: true, reference: true, nom: true, nomCommercial: true, statut: true,
        prixUnitaire: true, prixAchat: true, alerteStock: true, imagePrincipaleUrl: true, codeBarre: true,
        marque: { select: { id: true, nom: true } },
        categorieProduit: { select: { id: true, nom: true } },
        famille: { select: { id: true, nom: true } },
        _count: { select: { stocks: true } },
      },
    }),
    prisma.produit.count({ where }),
  ]);

  return NextResponse.json({
    data: produits.map((p) => ({ ...p, prixUnitaire: Number(p.prixUnitaire), prixAchat: p.prixAchat != null ? Number(p.prixAchat) : null })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const nom = strOrNull(body.nom);
  if (!nom) return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  const prixVente = numOrNull(body.prixUnitaire);
  if (prixVente == null || prixVente <= 0) return NextResponse.json({ message: "Le prix de vente doit être supérieur à 0" }, { status: 400 });

  const data = buildProduitData(body);
  const userId = Number(session.user.id);

  // Génération du code produit (PRD-000001) avec retry en cas de collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await prisma.produit.count();
    const codeProduit = `PRD-${String(count + 1 + attempt).padStart(6, "0")}`;
    try {
      const produit = await prisma.$transaction(async (tx) => {
        const p = await tx.produit.create({
          data: { ...data, nom, prixUnitaire: new Prisma.Decimal(prixVente), codeProduit },
          select: { id: true, codeProduit: true, nom: true, prixUnitaire: true, prixAchat: true },
        });
        await enregistrerChangementPrix(tx, {
          produitId: p.id, nouveauPrixVente: p.prixUnitaire, nouveauPrixAchat: p.prixAchat,
          initial: true, source: "INITIAL", motif: "Création du produit (catalogue)", userId,
        });
        await auditLog(tx, userId, "PRODUIT_CREE_CATALOGUE", "Produit", p.id);
        return p;
      });
      return NextResponse.json({ data: { ...produit, prixUnitaire: Number(produit.prixUnitaire) } }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String(e.meta?.target ?? "");
        if (target.includes("codeProduit")) continue; // collision code → retry
        if (target.includes("codeBarre")) return NextResponse.json({ message: "Ce code-barres est déjà utilisé" }, { status: 409 });
        if (target.includes("reference")) return NextResponse.json({ message: "Cette référence est déjà utilisée" }, { status: 409 });
      }
      console.error("POST /api/admin/catalogue/produits", e);
      return NextResponse.json({ message: "Erreur lors de la création du produit" }, { status: 500 });
    }
  }
  return NextResponse.json({ message: "Impossible de générer un code produit unique, réessayez" }, { status: 500 });
}
