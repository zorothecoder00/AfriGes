import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRHSession, profilRHDansPerimetre } from "@/lib/authRH";

type Ctx = { params: Promise<{ id: string }> };

const INCLUDE = {
  profilRH: {
    select: {
      id: true, matricule: true,
      gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } },
    },
  },
};

/**
 * PATCH /api/responsableRH/sst/visites/[id]
 * Édition : { medecin?, lieu?, resultatAptitude?, restrictions?, dateProchaineVisite?, documentUrl?, notes? }
 * Registre légal — pas de suppression, uniquement correction.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRHSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.visiteMedicale.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    if (!(await profilRHDansPerimetre(session, existing.profilRHId))) {
      return NextResponse.json({ error: "Visite hors de votre périmètre" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["medecin", "lieu", "resultatAptitude", "restrictions", "dateProchaineVisite", "documentUrl", "notes"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === "dateProchaineVisite") data[key] = body[key] ? new Date(body[key]) : null;
        else data[key] = body[key] ?? null;
      }
    }

    const updated = await prisma.visiteMedicale.update({ where: { id: Number(id) }, data, include: INCLUDE });

    await prisma.auditLog.create({
      data: { userId: parseInt(session.user.id), action: "UPDATE", entite: "VisiteMedicale", entiteId: Number(id), details: `Visite médicale #${id} modifiée` },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/responsableRH/sst/visites/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
