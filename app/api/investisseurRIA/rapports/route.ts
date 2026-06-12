import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestisseurRIASession } from "@/lib/authInvestisseurRIA";

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export async function GET(req: Request) {
  try {
    const session = await getInvestisseurRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const userId = parseInt(session.user.id!);
    const { searchParams } = new URL(req.url);
    const annee = searchParams.get("annee") ? parseInt(searchParams.get("annee")!) : undefined;

    const gestionnaire = await prisma.gestionnaire.findUnique({ where: { memberId: userId } });
    if (!gestionnaire) return NextResponse.json({ rapports: [], total: 0 });

    const profil = await prisma.profilInvestisseurRIA.findUnique({ where: { gestionnaireId: gestionnaire.id } });
    if (!profil) return NextResponse.json({ rapports: [], total: 0 });

    const portefeuilles = await prisma.portefeuilleRIA.findMany({
      where: { profilRIAId: profil.id },
      select: { id: true },
    });
    const pfIds = portefeuilles.map((p) => p.id);

    const rapports = await prisma.rapportMensuelRIA.findMany({
      where: { portefeuilleId: { in: pfIds }, ...(annee ? { annee } : {}) },
      include: {
        portefeuille: { select: { reference: true, nom: true } },
      },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    });

    const data = rapports.map((r) => ({
      id:            r.id,
      portefeuilleId: r.portefeuilleId,
      portefeuille:  r.portefeuille.reference + (r.portefeuille.nom ? ` — ${r.portefeuille.nom}` : ""),
      mois:          r.mois,
      annee:         r.annee,
      label:         `${MOIS_FR[r.mois - 1]} ${r.annee}`,
      createdAt:     r.createdAt,
    }));

    return NextResponse.json({ rapports: data, total: data.length });
  } catch (error) {
    console.error("GET /api/investisseurRIA/rapports", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
