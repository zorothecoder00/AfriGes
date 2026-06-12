import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { RoleMembreCommissionRIA } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { role, notes, actif } = body;

    const membre = await prisma.membreCommissionRIA.update({
      where: { id: parseInt(id) },
      data: {
        ...(role !== undefined ? { role: role as RoleMembreCommissionRIA } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(actif !== undefined ? { actif, ...(actif === false ? { dateSortie: new Date() } : { dateSortie: null }) } : {}),
      },
      include: {
        user: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    return NextResponse.json(membre);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    await prisma.membreCommissionRIA.update({
      where: { id: parseInt(id) },
      data: { actif: false, dateSortie: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
