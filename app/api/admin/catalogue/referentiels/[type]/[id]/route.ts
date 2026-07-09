import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ type: string; id: string }> };

const TYPES = ["familles", "sous-familles", "categories", "sous-categories", "marques", "unites"] as const;
type RefType = (typeof TYPES)[number];

// Construit le payload de mise à jour commun (nom / actif + champs spécifiques).
function buildData(type: RefType, body: Record<string, unknown>): Prisma.MarqueProduitUpdateInput {
  const data: Record<string, unknown> = {};
  if (typeof body.nom === "string" && body.nom.trim()) data.nom = body.nom.trim();
  if (typeof body.actif === "boolean") data.actif = body.actif;
  if ((type === "familles" || type === "categories") && typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (type === "marques" && typeof body.logoUrl === "string") data.logoUrl = body.logoUrl.trim() || null;
  if (type === "unites" && typeof body.symbole === "string") data.symbole = body.symbole.trim() || null;
  return data as Prisma.MarqueProduitUpdateInput;
}

/**
 * PATCH / DELETE /api/admin/catalogue/referentiels/[type]/[id] — admin.
 * PATCH : renomme / (dés)active / met à jour les champs spécifiques.
 * DELETE : supprime (refusé si des produits y sont rattachés → 409).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { type, id } = await params;
  const refId = Number(id);
  if (!TYPES.includes(type as RefType) || !refId) {
    return NextResponse.json({ message: "Requête invalide" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });
  const data = buildData(type as RefType, body);
  if (Object.keys(data).length === 0) return NextResponse.json({ message: "Aucune modification" }, { status: 400 });

  try {
    let updated: unknown;
    switch (type as RefType) {
      case "familles":        updated = await prisma.familleProduit.update({ where: { id: refId }, data }); break;
      case "categories":      updated = await prisma.categorieProduit.update({ where: { id: refId }, data }); break;
      case "marques":         updated = await prisma.marqueProduit.update({ where: { id: refId }, data }); break;
      case "unites":          updated = await prisma.uniteProduit.update({ where: { id: refId }, data }); break;
      case "sous-familles":   updated = await prisma.sousFamilleProduit.update({ where: { id: refId }, data }); break;
      case "sous-categories": updated = await prisma.sousCategorieProduit.update({ where: { id: refId }, data }); break;
    }
    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Un élément avec ce nom existe déjà" }, { status: 409 });
    }
    console.error("PATCH referentiels", e);
    return NextResponse.json({ message: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { type, id } = await params;
  const refId = Number(id);
  if (!TYPES.includes(type as RefType) || !refId) {
    return NextResponse.json({ message: "Requête invalide" }, { status: 400 });
  }

  // Refus si des produits (ou sous-éléments) sont rattachés — sinon la relation
  // optionnelle serait simplement mise à NULL (orphelinage silencieux).
  const rattache = async (): Promise<boolean> => {
    switch (type as RefType) {
      case "familles":        return (await prisma.produit.count({ where: { familleId: refId } })) > 0
                                  || (await prisma.sousFamilleProduit.count({ where: { familleId: refId } })) > 0;
      case "categories":      return (await prisma.produit.count({ where: { categorieId: refId } })) > 0
                                  || (await prisma.sousCategorieProduit.count({ where: { categorieId: refId } })) > 0;
      case "marques":         return (await prisma.produit.count({ where: { marqueId: refId } })) > 0;
      case "unites":          return (await prisma.produit.count({ where: { OR: [{ uniteVenteId: refId }, { uniteAchatId: refId }] } })) > 0;
      case "sous-familles":   return (await prisma.produit.count({ where: { sousFamilleId: refId } })) > 0;
      case "sous-categories": return (await prisma.produit.count({ where: { sousCategorieId: refId } })) > 0;
    }
  };

  try {
    if (await rattache()) {
      return NextResponse.json({ message: "Impossible de supprimer : des éléments y sont rattachés. Désactivez-le plutôt." }, { status: 409 });
    }
    switch (type as RefType) {
      case "familles":        await prisma.familleProduit.delete({ where: { id: refId } }); break;
      case "categories":      await prisma.categorieProduit.delete({ where: { id: refId } }); break;
      case "marques":         await prisma.marqueProduit.delete({ where: { id: refId } }); break;
      case "unites":          await prisma.uniteProduit.delete({ where: { id: refId } }); break;
      case "sous-familles":   await prisma.sousFamilleProduit.delete({ where: { id: refId } }); break;
      case "sous-categories": await prisma.sousCategorieProduit.delete({ where: { id: refId } }); break;
    }
    return NextResponse.json({ data: { id: refId } });
  } catch (e) {
    console.error("DELETE referentiels", e);
    return NextResponse.json({ message: "Erreur lors de la suppression" }, { status: 500 });
  }
}
