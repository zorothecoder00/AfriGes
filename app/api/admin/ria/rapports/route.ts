import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export async function GET(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const portefeuilleId = searchParams.get("portefeuilleId") ? parseInt(searchParams.get("portefeuilleId")!) : undefined;
    const annee          = searchParams.get("annee") ? parseInt(searchParams.get("annee")!) : undefined;

    const rapports = await prisma.rapportMensuelRIA.findMany({
      where: {
        ...(portefeuilleId ? { portefeuilleId } : {}),
        ...(annee          ? { annee }          : {}),
      },
      include: {
        portefeuille: {
          select: {
            id: true, reference: true, nom: true,
            profilRIA: {
              select: { numero: true, gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } },
            },
          },
        },
      },
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    });

    const data = rapports.map((r) => ({
      id:            r.id,
      portefeuilleId: r.portefeuilleId,
      portefeuille:  r.portefeuille.reference + (r.portefeuille.nom ? ` — ${r.portefeuille.nom}` : ""),
      investisseur:  r.portefeuille.profilRIA?.gestionnaire?.member
        ? `${r.portefeuille.profilRIA.gestionnaire.member.prenom} ${r.portefeuille.profilRIA.gestionnaire.member.nom}`
        : "—",
      mois:          r.mois,
      annee:         r.annee,
      label:         `${MOIS_FR[r.mois - 1]} ${r.annee}`,
      createdAt:     r.createdAt,
    }));

    return NextResponse.json({ rapports: data, total: data.length });
  } catch (error) {
    console.error("GET /api/admin/ria/rapports", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
