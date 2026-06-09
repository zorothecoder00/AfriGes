import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeEtapeOnboarding } from "@prisma/client";

/**
 * GET /api/admin/rh/onboarding/templates
 * Liste des templates de checklist
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const templates = await prisma.templateOnboarding.findMany({
      orderBy: { nom: "asc" },
      include: {
        etapes:   { orderBy: { ordre: "asc" } },
        _count:   { select: { onboardings: true } },
      },
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error("GET /api/admin/rh/onboarding/templates", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/rh/onboarding/templates
 * Créer un nouveau template avec ses étapes
 *
 * Body: {
 *   nom:         string
 *   description?: string
 *   etapes: [{
 *     ordre:       number
 *     titre:       string
 *     description?: string
 *     type:        TypeEtapeOnboarding
 *     delaiJours:  number
 *     obligatoire: boolean
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, description, etapes } = body;

    if (!nom?.trim()) return NextResponse.json({ error: "nom requis" }, { status: 400 });
    if (!Array.isArray(etapes) || etapes.length === 0) {
      return NextResponse.json({ error: "Au moins une étape requise" }, { status: 400 });
    }

    const template = await prisma.templateOnboarding.create({
      data: {
        nom:         nom.trim(),
        description: description ?? null,
        createdById: Number(session.user.id),
        etapes: {
          create: etapes.map((e: {
            ordre: number; titre: string; description?: string;
            type?: string; delaiJours?: number; obligatoire?: boolean;
          }) => ({
            ordre:       Number(e.ordre),
            titre:       e.titre.trim(),
            description: e.description ?? null,
            type:        (e.type ?? "AUTRE") as TypeEtapeOnboarding,
            delaiJours:  Number(e.delaiJours ?? 0),
            obligatoire: e.obligatoire ?? true,
          })),
        },
      },
      include: { etapes: { orderBy: { ordre: "asc" } } },
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/rh/onboarding/templates", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
