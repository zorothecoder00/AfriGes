import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ code: string }> };

/**
 * GET /api/marketing/r/[code] — public, sans auth.
 * Lien traqué d'un partenaire (influenceur/affilié, CDC §47-49) : compte le
 * clic puis redirige vers l'URL de destination (ou le catalogue par défaut).
 */
export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const base = new URL(req.url).origin;

  const lien = await prisma.lienAffiliation.findUnique({
    where: { code: code.toUpperCase() },
    select: { id: true, actif: true, destinationUrl: true },
  }).catch(() => null);

  if (!lien || !lien.actif) return NextResponse.redirect(`${base}/catalogue`);

  await prisma.lienAffiliation.update({ where: { id: lien.id }, data: { nbClics: { increment: 1 } } }).catch(() => {});

  const url = lien.destinationUrl && lien.destinationUrl.startsWith("http") ? lien.destinationUrl : `${base}${lien.destinationUrl || "/catalogue"}`;
  return NextResponse.redirect(url);
}
