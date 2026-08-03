import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — nom, devise, référentiel, statut actif/inactif (jamais de suppression physique). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { nom, pays, deviseFonctionnelleCode, referentielComptable, typeEntite, actif } = body;

    const updated = await prisma.societe.update({
      where: { id: Number(id) },
      data: {
        ...(nom !== undefined && { nom }),
        ...(pays !== undefined && { pays }),
        ...(deviseFonctionnelleCode !== undefined && { deviseFonctionnelleCode }),
        ...(referentielComptable !== undefined && { referentielComptable }),
        ...(typeEntite !== undefined && { typeEntite }),
        ...(actif !== undefined && { actif: Boolean(actif) }),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
