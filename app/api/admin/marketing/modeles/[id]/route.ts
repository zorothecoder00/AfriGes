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
  const modele = await prisma.modeleMessage.findUnique({
    where: { id: Number(id) },
    include: { canal: true, creePar: { select: { id: true, nom: true, prenom: true } } },
  });
  if (!modele) return NextResponse.json({ error: "Modèle introuvable" }, { status: 404 });
  return NextResponse.json({ data: modele });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const { id } = await params;
  const modeleId = Number(id);
  if (isNaN(modeleId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const body = await req.json();
  const { nom, categorie, objet, contenuTexte, contenuBlocs, actif } = body;

  const modele = await prisma.modeleMessage.update({
    where: { id: modeleId },
    data: {
      ...(nom !== undefined ? { nom } : {}),
      ...(categorie !== undefined ? { categorie } : {}),
      ...(objet !== undefined ? { objet: objet || null } : {}),
      ...(contenuTexte !== undefined ? { contenuTexte: contenuTexte || null } : {}),
      ...(contenuBlocs !== undefined ? { contenuBlocs } : {}),
      ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
    },
    include: { canal: true },
  });
  return NextResponse.json({ data: modele });
}
