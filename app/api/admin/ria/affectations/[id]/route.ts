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
    const { actif, pourcentage, montantAlloue, classeRisque, notes } = await req.json();

    const affectation = await prisma.affectationClientRIA.findUnique({ where: { id: parseInt(id) } });
    if (!affectation) return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });

    const updated = await prisma.affectationClientRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(actif       !== undefined ? { actif, dateFin: actif === false ? new Date() : null } : {}),
        ...(pourcentage !== undefined ? { pourcentage: Number(pourcentage) }          : {}),
        ...(montantAlloue !== undefined ? { montantAlloue: Number(montantAlloue) }    : {}),
        ...(classeRisque  !== undefined ? { classeRisque: classeRisque as ClasseRisqueRIA } : {}),
        ...(notes         !== undefined ? { notes }                                   : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/admin/ria/affectations/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
