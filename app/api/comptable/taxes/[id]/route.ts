import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — modification/désactivation (jamais de suppression physique). */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const {
      nom, taux, compteCollecteNumero, compteDeductibleNumero, compteRegularisationNumero,
      applicableAchat, applicableVente, dateFin, actif,
    } = body;

    const updated = await prisma.taxeConfig.update({
      where: { id: Number(id) },
      data: {
        ...(nom !== undefined && { nom }),
        ...(taux !== undefined && { taux: Number(taux) }),
        ...(compteCollecteNumero !== undefined && { compteCollecteNumero }),
        ...(compteDeductibleNumero !== undefined && { compteDeductibleNumero: compteDeductibleNumero || null }),
        ...(compteRegularisationNumero !== undefined && { compteRegularisationNumero: compteRegularisationNumero || null }),
        ...(applicableAchat !== undefined && { applicableAchat: Boolean(applicableAchat) }),
        ...(applicableVente !== undefined && { applicableVente: Boolean(applicableVente) }),
        ...(dateFin !== undefined && { dateFin: dateFin ? new Date(dateFin) : null }),
        ...(actif !== undefined && { actif: Boolean(actif) }),
      },
    });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
