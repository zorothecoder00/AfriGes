import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { ClasseRisqueRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const { actif, pourcentage, montantAlloue, classeRisque, notes, dateDebut } = await req.json();

    const affectation = await prisma.affectationClientRIA.findUnique({
      where: { id: parseInt(id) },
      include: { portefeuille: { select: { capitalInvesti: true } } },
    });
    if (!affectation) return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });

    const capitalInvesti = Number(affectation.portefeuille.capitalInvesti);

    // Dériver le champ manquant pour garantir la cohérence
    let newPourcentage  = pourcentage  !== undefined ? Number(pourcentage)  : undefined;
    let newMontant      = montantAlloue !== undefined ? Number(montantAlloue) : undefined;

    if (newPourcentage !== undefined) {
      // Le pourcentage fait autorité → recalcule le montant
      newMontant = Math.round(newPourcentage / 100 * capitalInvesti);
    } else if (newMontant !== undefined && capitalInvesti > 0) {
      // Le montant fait autorité (pas de pourcentage fourni) → recalcule le pourcentage
      newPourcentage = parseFloat((newMontant / capitalInvesti * 100).toFixed(4));
    }

    const updated = await prisma.affectationClientRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(actif             !== undefined ? { actif, dateFin: actif === false ? new Date() : null } : {}),
        ...(newPourcentage    !== undefined ? { pourcentage: newPourcentage }   : {}),
        ...(newMontant        !== undefined ? { montantAlloue: newMontant }     : {}),
        ...(classeRisque      !== undefined ? { classeRisque: classeRisque as ClasseRisqueRIA } : {}),
        ...(notes             !== undefined ? { notes }                        : {}),
        ...(dateDebut         !== undefined ? { dateDebut: new Date(dateDebut) } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/ria/affectations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
