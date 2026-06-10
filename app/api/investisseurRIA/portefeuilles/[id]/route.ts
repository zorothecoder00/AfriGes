import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestisseurRIASession } from "@/lib/authInvestisseurRIA";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getInvestisseurRIASession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId  = Number(session.user.id);
  const pfId    = Number(id);

  const gestionnaire = await prisma.gestionnaire.findUnique({
    where: { memberId: userId },
    select: { id: true, profilRIA: { select: { id: true } } },
  });
  if (!gestionnaire?.profilRIA) {
    return NextResponse.json({ error: "Profil investisseur introuvable" }, { status: 404 });
  }

  const pf = await prisma.portefeuilleRIA.findFirst({
    where: { id: pfId, profilRIAId: gestionnaire.profilRIA.id },
    include: {
      mouvements:    { orderBy: { createdAt: "desc" }, take: 50 },
      distributions: { orderBy: [{ annee: "desc" }, { mois: "desc" }], take: 12 },
      affectations:  {
        where: { actif: true },
        include: { client: { select: { id: true, nom: true, prenom: true, telephone: true } } },
      },
      financements:  {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { client: { select: { id: true, nom: true, prenom: true } } },
      },
    },
  });

  if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

  return NextResponse.json({ data: pf });
}
