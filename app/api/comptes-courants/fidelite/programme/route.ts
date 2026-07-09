import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerProgrammeFidelite } from "@/lib/fidelite";

/**
 * /api/comptes-courants/fidelite/programme (CDC §19.D)
 * GET — lecture du paramétrage du programme de fidélité (capacité READ)
 * PUT — modification (capacité CONFIG)
 */

export async function GET() {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const programme = await chargerProgrammeFidelite();
  return NextResponse.json({ data: programme });
}

export async function PUT(req: Request) {
  const session = await getCompteCourantSession("CONFIG");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const int = (v: unknown): number | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Math.floor(Number(v));
    if (isNaN(n) || n < 0) throw new Error("VALEUR_INVALIDE");
    return n;
  };

  try {
    const data: Prisma.ProgrammeFideliteUpdateInput = {
      actif: typeof body.actif === "boolean" ? body.actif : undefined,
      pointsParMontant: int(body.pointsParMontant),
      bonusParDepot: int(body.bonusParDepot),
      seuilArgent: int(body.seuilArgent),
      seuilOr: int(body.seuilOr),
      seuilPlatine: int(body.seuilPlatine),
      reductionFraisArgent: int(body.reductionFraisArgent),
      reductionFraisOr: int(body.reductionFraisOr),
      reductionFraisPlatine: int(body.reductionFraisPlatine),
    };

    await chargerProgrammeFidelite(); // garantit l'existence du singleton
    const updated = await prisma.programmeFidelite.update({ where: { id: 1 }, data });

    await prisma.auditLog.create({
      data: { userId: Number(session.user.id), action: "MAJ_PROGRAMME_FIDELITE", entite: "ProgrammeFidelite", entiteId: 1 },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "VALEUR_INVALIDE") {
      return NextResponse.json({ error: "Valeur invalide (les nombres doivent être positifs)" }, { status: 400 });
    }
    console.error("PUT /api/comptes-courants/fidelite/programme", e);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
