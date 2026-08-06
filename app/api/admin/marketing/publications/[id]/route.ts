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
  const publication = await prisma.publicationSociale.findUnique({
    where: { id: Number(id) },
    include: {
      canal: true,
      campagne: { select: { id: true, code: true, nom: true } },
      pointDeVente: { select: { id: true, nom: true } },
      produit: { select: { id: true, nom: true } },
      asset: true,
      responsable: { select: { id: true, nom: true, prenom: true } },
      validePar: { select: { id: true, nom: true, prenom: true } },
      creePar: { select: { id: true, nom: true, prenom: true } },
    },
  });
  if (!publication) return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
  return NextResponse.json({ data: publication });
}

/** PATCH — édition des champs hors statut (le statut passe par /action). */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "MODIFICATION");
  if (denied) return denied;

  const { id } = await params;
  const publicationId = Number(id);
  if (isNaN(publicationId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  const body = await req.json();
  const { texte, canalId, campagneId, pointDeVenteId, produitId, assetId, responsableId, datePublicationPrevue } = body;

  const publication = await prisma.publicationSociale.update({
    where: { id: publicationId },
    data: {
      ...(texte !== undefined ? { texte: texte || null } : {}),
      ...(canalId !== undefined ? { canalId: Number(canalId) } : {}),
      ...(campagneId !== undefined ? { campagneId: campagneId ? Number(campagneId) : null } : {}),
      ...(pointDeVenteId !== undefined ? { pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null } : {}),
      ...(produitId !== undefined ? { produitId: produitId ? Number(produitId) : null } : {}),
      ...(assetId !== undefined ? { assetId: assetId ? Number(assetId) : null } : {}),
      ...(responsableId !== undefined ? { responsableId: Number(responsableId) } : {}),
      ...(datePublicationPrevue !== undefined ? { datePublicationPrevue: datePublicationPrevue ? new Date(datePublicationPrevue) : null } : {}),
    },
    include: { canal: true, campagne: { select: { id: true, nom: true } } },
  });
  return NextResponse.json({ data: publication });
}
