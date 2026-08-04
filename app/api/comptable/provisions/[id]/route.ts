import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/comptable/provisions/[id] — détail + historique des mouvements. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const provision = await prisma.provisionDepreciation.findUnique({
      where: { id: Number(id) },
      include: {
        compteProvision: { select: { numero: true, libelle: true } },
        compteDotation: { select: { numero: true, libelle: true } },
        compteReprise: { select: { numero: true, libelle: true } },
        client: { select: { nom: true, prenom: true } },
        fournisseur: { select: { nom: true } },
        immobilisation: { select: { designation: true } },
        mouvements: { orderBy: { date: "desc" } },
      },
    });
    if (!provision) return NextResponse.json({ error: "Provision introuvable" }, { status: 404 });
    return NextResponse.json({ data: provision });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
