import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { StatutAssemblee, TypeAssemblee } from "@prisma/client";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    const assemblee = await prisma.assemblee.findUnique({
      where: { id: assembleeId },
      include: {
        resolutions: {
          orderBy: { numero: "asc" },
          include: { votes: { include: { participant: { include: { gestionnaire: { include: { member: true } } } } } } },
        },
        participants: {
          include: { gestionnaire: { include: { member: true } } },
        },
      },
    });

    if (!assemblee) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: assemblee });
  } catch (error) {
    console.error("GET /api/admin/assemblees/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    const { titre, description, type, statut, dateAssemblee, lieu, ordreJour, notes } = await req.json();

    if (type && !Object.values(TypeAssemblee).includes(type)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }
    if (statut && !Object.values(StatutAssemblee).includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const assemblee = await prisma.assemblee.update({
      where: { id: assembleeId },
      data: {
        ...(titre && { titre }),
        ...(description !== undefined && { description }),
        ...(type && { type }),
        ...(statut && { statut }),
        ...(dateAssemblee && { dateAssemblee: new Date(dateAssemblee) }),
        ...(lieu && { lieu }),
        ...(ordreJour !== undefined && { ordreJour }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ data: assemblee });
  } catch (error) {
    console.error("PUT /api/admin/assemblees/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    await prisma.assemblee.delete({ where: { id: assembleeId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/assemblees/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
