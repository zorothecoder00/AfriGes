import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    const resolutions = await prisma.resolutionAssemblee.findMany({
      where: { assembleeId },
      orderBy: { numero: "asc" },
      include: {
        votes: {
          include: {
            participant: { include: { gestionnaire: { include: { member: true } } } },
          },
        },
      },
    });

    // Calculer les stats de vote pour chaque résolution
    const result = resolutions.map((r) => {
      const pour = r.votes.filter((v) => v.decision === "POUR").length;
      const contre = r.votes.filter((v) => v.decision === "CONTRE").length;
      const abstention = r.votes.filter((v) => v.decision === "ABSTENTION").length;
      return { ...r, stats: { pour, contre, abstention, total: r.votes.length } };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/admin/assemblees/[id]/resolutions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await params;
    const assembleeId = parseInt(id);

    const { titre, description } = await req.json();
    if (!titre) {
      return NextResponse.json({ error: "Titre obligatoire" }, { status: 400 });
    }

    // Déterminer le prochain numéro
    const last = await prisma.resolutionAssemblee.findFirst({
      where: { assembleeId },
      orderBy: { numero: "desc" },
    });
    const numero = (last?.numero ?? 0) + 1;

    const resolution = await prisma.resolutionAssemblee.create({
      data: {
        assembleeId,
        numero,
        titre,
        description: description ?? null,
      },
    });

    return NextResponse.json({ data: resolution }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/assemblees/[id]/resolutions", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
