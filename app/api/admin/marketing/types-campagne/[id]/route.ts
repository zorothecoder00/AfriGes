import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — édition/désactivation d'un type de campagne (§81, sans code). */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const { id } = await params;
  const typeId = Number(id);
  if (isNaN(typeId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const { libelle, actif, ordre } = await req.json();
  const type = await prisma.typeCampagne.update({
    where: { id: typeId },
    data: {
      ...(libelle !== undefined ? { libelle } : {}),
      ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
      ...(ordre !== undefined ? { ordre: Number(ordre) } : {}),
    },
  });
  return NextResponse.json({ data: type });
}
