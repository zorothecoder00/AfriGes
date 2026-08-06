import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/modeles — bibliothèque de modèles de message (CDC §22).
 */
export async function GET() {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const modeles = await prisma.modeleMessage.findMany({
    include: { canal: true, creePar: { select: { id: true, nom: true, prenom: true } }, _count: { select: { envois: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: modeles });
}

/**
 * POST /api/admin/marketing/modeles
 * Body: { nom, categorie, canalId, objet?, contenuTexte?, contenuBlocs? }
 */
export async function POST(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "CREATION");
  if (denied) return denied;

  const body = await req.json();
  const { nom, categorie, canalId, objet, contenuTexte, contenuBlocs } = body;
  if (!nom || !categorie || !canalId) {
    return NextResponse.json({ error: "nom, categorie et canalId sont requis" }, { status: 400 });
  }

  const modele = await prisma.modeleMessage.create({
    data: {
      nom, categorie, canalId: Number(canalId),
      objet: objet || null,
      contenuTexte: contenuTexte || null,
      contenuBlocs: contenuBlocs ?? undefined,
      creeParId: Number(session.user.id),
    },
    include: { canal: true },
  });
  return NextResponse.json({ data: modele }, { status: 201 });
}
