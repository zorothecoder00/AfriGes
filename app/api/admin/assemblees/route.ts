import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { TypeAssemblee } from "@prisma/client";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const assemblees = await prisma.assemblee.findMany({
      orderBy: { dateAssemblee: "desc" },
      include: {
        resolutions: { orderBy: { numero: "asc" } },
        _count: { select: { participants: true } },
      },
    });

    return NextResponse.json({ data: assemblees });
  } catch (error) {
    console.error("GET /api/admin/assemblees", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { titre, description, type, dateAssemblee, lieu, ordreJour, notes } = await req.json();

    if (!titre || !type || !dateAssemblee || !lieu) {
      return NextResponse.json({ error: "Titre, type, date et lieu obligatoires" }, { status: 400 });
    }

    if (!Object.values(TypeAssemblee).includes(type)) {
      return NextResponse.json({ error: "Type invalide (AGO, AGE, CS, CA)" }, { status: 400 });
    }

    const assemblee = await prisma.assemblee.create({
      data: {
        titre,
        description: description ?? null,
        type,
        dateAssemblee: new Date(dateAssemblee),
        lieu,
        ordreJour: ordreJour ?? null,
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: assemblee }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/assemblees", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
