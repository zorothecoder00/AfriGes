import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const config = await prisma.configBeneficeRIA.findFirst({
      where: { actif: true },
      orderBy: { createdAt: "desc" },
    });

    const all = await prisma.configBeneficeRIA.findMany({ orderBy: { createdAt: "desc" } });

    return NextResponse.json({ data: config, history: all });
  } catch (error) {
    console.error("GET /api/admin/ria/config", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { tauxGenere, tauxDistribue, tauxReinvesti, tauxFondSecurite } = await req.json();

    const total = Number(tauxDistribue) + Number(tauxReinvesti) + Number(tauxFondSecurite);
    if (Math.abs(total - Number(tauxGenere)) > 0.01) {
      return NextResponse.json({
        error: `tauxDistribue + tauxReinvesti + tauxFondSecurite (${total}%) doit égaler tauxGenere (${tauxGenere}%)`,
      }, { status: 400 });
    }

    // Désactiver la config actuelle
    await prisma.configBeneficeRIA.updateMany({ where: { actif: true }, data: { actif: false } });

    const config = await prisma.configBeneficeRIA.create({
      data: {
        tauxGenere:       Number(tauxGenere),
        tauxDistribue:    Number(tauxDistribue),
        tauxReinvesti:    Number(tauxReinvesti),
        tauxFondSecurite: Number(tauxFondSecurite),
        actif:            true,
      },
    });

    return NextResponse.json({ data: config }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/config", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
