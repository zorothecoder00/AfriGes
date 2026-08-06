import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/** GET/PATCH — réglage frequency capping (CDC §73), ligne unique id=1. */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const param = await prisma.parametrageMarketing.upsert({
    where: { id: 1 }, create: { id: 1 }, update: {},
  });
  return NextResponse.json({ data: param });
}

export async function PATCH(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const { maxCommunicationsParSemaine } = await req.json();
  const valeur = Number(maxCommunicationsParSemaine);
  if (!Number.isInteger(valeur) || valeur < 1) {
    return NextResponse.json({ error: "maxCommunicationsParSemaine doit être un entier ≥ 1" }, { status: 400 });
  }

  const param = await prisma.parametrageMarketing.upsert({
    where: { id: 1 },
    create: { id: 1, maxCommunicationsParSemaine: valeur },
    update: { maxCommunicationsParSemaine: valeur },
  });
  return NextResponse.json({ data: param });
}
