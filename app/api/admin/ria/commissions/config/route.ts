import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

const ROLE_TYPES = ["AGENT_TERRAIN", "CHEF_AGENCE", "RPV_REGIONAL"] as const;

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const configs = await prisma.configCommissionRIA.findMany({
      where: { roleType: { in: [...ROLE_TYPES] } },
      orderBy: { roleType: "asc" },
    });

    // Compléter avec les valeurs par défaut si manquantes
    const result = ROLE_TYPES.map((roleType) => {
      const existing = configs.find((c) => c.roleType === roleType);
      if (existing) return existing;
      return {
        id: null,
        roleType,
        tauxBase: roleType === "AGENT_TERRAIN" ? 1.0 : roleType === "CHEF_AGENCE" ? 0.5 : 0.3,
        description: null,
        actif: true,
        createdAt: null,
        updatedAt: null,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { roleType, tauxBase, description, actif } = body as {
      roleType: string;
      tauxBase: number;
      description?: string;
      actif?: boolean;
    };

    if (!roleType || !ROLE_TYPES.includes(roleType as typeof ROLE_TYPES[number])) {
      return NextResponse.json({ error: `roleType doit être l'un de : ${ROLE_TYPES.join(", ")}` }, { status: 400 });
    }
    if (tauxBase === undefined || tauxBase < 0 || tauxBase > 100) {
      return NextResponse.json({ error: "tauxBase doit être entre 0 et 100" }, { status: 400 });
    }

    const config = await prisma.configCommissionRIA.upsert({
      where: { roleType },
      create: { roleType, tauxBase, description: description ?? null, actif: actif ?? true },
      update: { tauxBase, description: description ?? undefined, actif: actif ?? undefined },
    });

    return NextResponse.json(config);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
