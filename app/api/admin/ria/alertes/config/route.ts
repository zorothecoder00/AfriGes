import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

const CLES_VALIDES = [
  "CAPITAL_FAIBLE_SEUIL",
  "RISQUE_ELEVE_SEUIL",
  "RENTABILITE_BAISSE_SEUIL",
  "TAUX_DEFAUT_SEUIL",
  "IMPAYES_MONTANT_SEUIL",
] as const;

const DEFAULTS: Record<string, { valeur: number; description: string }> = {
  CAPITAL_FAIBLE_SEUIL:     { valeur: 20,      description: "Seuil capital disponible / investi (%)" },
  RISQUE_ELEVE_SEUIL:       { valeur: 30,      description: "Seuil % affectations classe D ou E" },
  RENTABILITE_BAISSE_SEUIL: { valeur: 10,      description: "Seuil de baisse mensuelle de rentabilité (%)" },
  TAUX_DEFAUT_SEUIL:        { valeur: 10,      description: "Seuil taux de défaut global (%)" },
  IMPAYES_MONTANT_SEUIL:    { valeur: 1000000, description: "Seuil montant impayés critiques (FCFA)" },
};

export async function GET() {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const saved = await prisma.configAlerteRIA.findMany({
      where: { cle: { in: [...CLES_VALIDES] } },
    });

    const result = CLES_VALIDES.map((cle) => {
      const row = saved.find((r) => r.cle === cle);
      return {
        cle,
        valeur:      row ? parseFloat(row.valeur) : DEFAULTS[cle].valeur,
        description: row?.description ?? DEFAULTS[cle].description,
        modifie:     !!row,
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

    const body = await req.json() as { cle: string; valeur: number }[];

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Body doit être un tableau [{ cle, valeur }]" }, { status: 400 });
    }

    const upserts = body
      .filter((item) => CLES_VALIDES.includes(item.cle as typeof CLES_VALIDES[number]) && typeof item.valeur === "number")
      .map((item) =>
        prisma.configAlerteRIA.upsert({
          where: { cle: item.cle },
          create: {
            cle: item.cle,
            valeur: String(item.valeur),
            description: DEFAULTS[item.cle]?.description,
          },
          update: { valeur: String(item.valeur) },
        })
      );

    await Promise.all(upserts);

    return NextResponse.json({ success: true, updated: upserts.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
