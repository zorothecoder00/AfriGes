import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { StatutDividende } from "@prisma/client";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const dividendes = await prisma.dividende.findMany({
      orderBy: { createdAt: "desc" },
    });

    const totalVerse = dividendes
      .filter((d) => d.statut === "VERSE")
      .reduce((sum, d) => sum + Number(d.montantTotal), 0);

    return NextResponse.json({ data: dividendes, totalVerse });
  } catch (error) {
    console.error("GET /api/admin/dividendes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { periode, montantTotal, montantParPart, dateVersement, statut, notes } = await req.json();

    if (!periode || !montantTotal) {
      return NextResponse.json({ error: "Période et montant total obligatoires" }, { status: 400 });
    }

    if (statut && !Object.values(StatutDividende).includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const dividende = await prisma.dividende.create({
      data: {
        periode,
        montantTotal: Number(montantTotal),
        montantParPart: montantParPart ? Number(montantParPart) : null,
        dateVersement: dateVersement ? new Date(dateVersement) : null,
        statut: statut ?? "PLANIFIE",
        notes: notes ?? null,
      },
    });

    return NextResponse.json({ data: dividende }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/dividendes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
