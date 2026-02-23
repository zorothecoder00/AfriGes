import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActionnaireSession } from "@/lib/authActionnaire";

export async function GET() {
  try {
    const session = await getActionnaireSession();
    if (!session) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const dividendes = await prisma.dividende.findMany({
      orderBy: { createdAt: "desc" },
    });

    const total = dividendes
      .filter((d) => d.statut === "VERSE")
      .reduce((sum, d) => sum + Number(d.montantTotal), 0);

    return NextResponse.json({ data: dividendes, totalVerse: total });
  } catch (error) {
    console.error("GET /api/actionnaire/dividendes", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
