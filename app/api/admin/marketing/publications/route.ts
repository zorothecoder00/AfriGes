import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

/**
 * GET /api/admin/marketing/publications — calendrier éditorial (CDC §27-28).
 * Filtres : statut, canalId, campagneId, pointDeVenteId, produitId, responsableId, debut/fin (datePublicationPrevue).
 */
export async function GET(req: NextRequest) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "LECTURE");
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const statut = sp.get("statut");
  const canalId = sp.get("canalId");
  const campagneId = sp.get("campagneId");
  const pointDeVenteId = sp.get("pointDeVenteId");
  const produitId = sp.get("produitId");
  const responsableId = sp.get("responsableId");
  const debut = sp.get("debut");
  const fin = sp.get("fin");

  const publications = await prisma.publicationSociale.findMany({
    where: {
      ...(statut ? { statut: statut as never } : {}),
      ...(canalId ? { canalId: Number(canalId) } : {}),
      ...(campagneId ? { campagneId: Number(campagneId) } : {}),
      ...(pointDeVenteId ? { pointDeVenteId: Number(pointDeVenteId) } : {}),
      ...(produitId ? { produitId: Number(produitId) } : {}),
      ...(responsableId ? { responsableId: Number(responsableId) } : {}),
      ...(debut || fin
        ? { datePublicationPrevue: { ...(debut ? { gte: new Date(debut) } : {}), ...(fin ? { lte: new Date(fin) } : {}) } }
        : {}),
    },
    include: {
      canal: true,
      campagne: { select: { id: true, code: true, nom: true } },
      pointDeVente: { select: { id: true, nom: true } },
      produit: { select: { id: true, nom: true } },
      asset: { select: { id: true, nom: true, url: true, categorie: true } },
      responsable: { select: { id: true, nom: true, prenom: true } },
      validePar: { select: { id: true, nom: true, prenom: true } },
    },
    orderBy: { datePublicationPrevue: "asc" },
  });
  return NextResponse.json({ data: publications });
}

/**
 * POST /api/admin/marketing/publications
 * Body: { texte?, canalId, campagneId?, pointDeVenteId?, produitId?, assetId?, responsableId?, datePublicationPrevue? }
 * Créée en statut IDEE (CDC §30).
 */
export async function POST(req: Request) {
  const session = await getMarketingSession();
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const denied = await requirePermission(session, "marketing", "CREATION");
  if (denied) return denied;

  const body = await req.json();
  const { texte, canalId, campagneId, pointDeVenteId, produitId, assetId, responsableId, datePublicationPrevue, niveauValidationRequis } = body;
  if (!canalId) return NextResponse.json({ error: "canalId requis" }, { status: 400 });

  const userId = Number(session.user.id);
  const publication = await prisma.publicationSociale.create({
    data: {
      texte: texte || null,
      canalId: Number(canalId),
      campagneId: campagneId ? Number(campagneId) : null,
      pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
      produitId: produitId ? Number(produitId) : null,
      assetId: assetId ? Number(assetId) : null,
      responsableId: responsableId ? Number(responsableId) : userId,
      datePublicationPrevue: datePublicationPrevue ? new Date(datePublicationPrevue) : null,
      // CDC §31 — "selon le niveau de contenu", choisi par le créateur à la soumission.
      niveauValidationRequis: niveauValidationRequis === "DIRECTION" ? "DIRECTION" : "RESPONSABLE_MARKETING",
      creeParId: userId,
    },
    include: { canal: true, campagne: { select: { id: true, nom: true } }, responsable: { select: { id: true, nom: true, prenom: true } } },
  });
  return NextResponse.json({ data: publication }, { status: 201 });
}
