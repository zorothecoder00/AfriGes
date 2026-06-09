import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { TypeEtapeOnboarding } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/rh/onboarding/templates/[id]
 * Modifier un template (nom, description, actif) et remplacer ses étapes si fournies.
 *
 * Body: {
 *   nom?:         string
 *   description?: string
 *   actif?:       boolean
 *   etapes?:      EtapeTemplate[]  — si fourni, remplace toutes les étapes existantes
 * }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body   = await req.json();
    const { nom, description, actif, etapes } = body;

    const template = await prisma.templateOnboarding.findUnique({ where: { id: Number(id) } });
    if (!template) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      // Mettre à jour les métadonnées
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {};
      if (nom         !== undefined) data.nom         = nom.trim();
      if (description !== undefined) data.description = description ?? null;
      if (actif       !== undefined) data.actif       = Boolean(actif);

      const t = await tx.templateOnboarding.update({ where: { id: Number(id) }, data });

      // Remplacer les étapes si fournies
      if (Array.isArray(etapes)) {
        await tx.etapeTemplate.deleteMany({ where: { templateId: Number(id) } });
        if (etapes.length > 0) {
          await tx.etapeTemplate.createMany({
            data: etapes.map((e: {
              ordre: number; titre: string; description?: string;
              type?: string; delaiJours?: number; obligatoire?: boolean;
            }) => ({
              templateId:  Number(id),
              ordre:       Number(e.ordre),
              titre:       e.titre.trim(),
              description: e.description ?? null,
              type:        (e.type ?? "AUTRE") as TypeEtapeOnboarding,
              delaiJours:  Number(e.delaiJours ?? 0),
              obligatoire: e.obligatoire ?? true,
            })),
          });
        }
      }

      return t;
    });

    const result = await prisma.templateOnboarding.findUnique({
      where:   { id: Number(id) },
      include: { etapes: { orderBy: { ordre: "asc" } } },
    });

    return NextResponse.json({ data: result ?? updated });
  } catch (error) {
    console.error("PATCH /api/admin/rh/onboarding/templates/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/rh/onboarding/templates/[id]
 * Désactiver un template (soft delete via actif=false) si des onboardings y sont liés.
 * Suppression physique sinon.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;

    const template = await prisma.templateOnboarding.findUnique({
      where:  { id: Number(id) },
      include: { _count: { select: { onboardings: true } } },
    });
    if (!template) return NextResponse.json({ error: "Template introuvable" }, { status: 404 });

    if (template._count.onboardings > 0) {
      // Soft delete — des onboardings utilisent ce template
      await prisma.templateOnboarding.update({
        where: { id: Number(id) },
        data:  { actif: false },
      });
      return NextResponse.json({ message: "Template désactivé (utilisé par des onboardings existants)" });
    }

    await prisma.templateOnboarding.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Template supprimé" });
  } catch (error) {
    console.error("DELETE /api/admin/rh/onboarding/templates/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
