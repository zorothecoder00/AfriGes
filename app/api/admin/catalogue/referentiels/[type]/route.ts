import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ type: string }> };

const TYPES = ["familles", "sous-familles", "categories", "sous-categories", "marques", "unites"] as const;

/**
 * POST /api/admin/catalogue/referentiels/[type]
 * Crée un élément de référentiel du catalogue (Catalogue §2, §3) — admin.
 * type ∈ familles | sous-familles | categories | sous-categories | marques | unites
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { type } = await params;
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return NextResponse.json({ message: "Type de référentiel invalide" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const nom = typeof body?.nom === "string" ? body.nom.trim() : "";
  if (!nom) return NextResponse.json({ message: "Le nom est requis" }, { status: 400 });
  const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

  try {
    let created: unknown;
    switch (type) {
      case "familles":
        created = await prisma.familleProduit.create({ data: { nom, description } });
        break;
      case "categories":
        created = await prisma.categorieProduit.create({ data: { nom, description } });
        break;
      case "marques":
        created = await prisma.marqueProduit.create({
          data: { nom, logoUrl: typeof body?.logoUrl === "string" && body.logoUrl.trim() ? body.logoUrl.trim() : null },
        });
        break;
      case "unites":
        created = await prisma.uniteProduit.create({
          data: { nom, symbole: typeof body?.symbole === "string" && body.symbole.trim() ? body.symbole.trim() : null },
        });
        break;
      case "sous-familles": {
        const familleId = Number(body?.familleId);
        if (!familleId) return NextResponse.json({ message: "Famille parente requise" }, { status: 400 });
        created = await prisma.sousFamilleProduit.create({ data: { nom, familleId } });
        break;
      }
      case "sous-categories": {
        const categorieId = Number(body?.categorieId);
        if (!categorieId) return NextResponse.json({ message: "Catégorie parente requise" }, { status: 400 });
        created = await prisma.sousCategorieProduit.create({ data: { nom, categorieId } });
        break;
      }
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ message: "Un élément avec ce nom existe déjà" }, { status: 409 });
    }
    console.error("POST /api/admin/catalogue/referentiels/[type]", e);
    return NextResponse.json({ message: "Erreur lors de la création" }, { status: 500 });
  }
}
