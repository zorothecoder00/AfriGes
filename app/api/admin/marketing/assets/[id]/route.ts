import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const { id } = await params;
  const asset = await prisma.assetMarketing.findUnique({
    where: { id: Number(id) },
    include: {
      uploadePar: { select: { id: true, nom: true, prenom: true } },
      campagnes: { include: { campagne: { select: { id: true, code: true, nom: true } } } },
      publications: { select: { id: true, statut: true, datePublicationPrevue: true } },
    },
  });
  if (!asset) return NextResponse.json({ error: "Asset introuvable" }, { status: 404 });
  return NextResponse.json({ data: asset });
}

/** PATCH — édition tags/droits/campagnes associées (le fichier lui-même n'est pas remplaçable ici). */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const { id } = await params;
  const assetId = Number(id);
  if (isNaN(assetId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const body = await req.json();
  const { nom, tags, droitsUtilisation, campagneIds } = body;

  const asset = await prisma.$transaction(async (tx) => {
    if (campagneIds !== undefined) {
      await tx.assetMarketingCampagne.deleteMany({ where: { assetId } });
      if ((campagneIds as number[]).length) {
        await tx.assetMarketingCampagne.createMany({
          data: (campagneIds as number[]).map((cId) => ({ assetId, campagneId: Number(cId) })),
          skipDuplicates: true,
        });
      }
    }
    return tx.assetMarketing.update({
      where: { id: assetId },
      data: {
        ...(nom !== undefined ? { nom } : {}),
        ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags : [] } : {}),
        ...(droitsUtilisation !== undefined ? { droitsUtilisation: droitsUtilisation || null } : {}),
      },
      include: { campagnes: { include: { campagne: { select: { id: true, nom: true } } } } },
    });
  });

  return NextResponse.json({ data: asset });
}
