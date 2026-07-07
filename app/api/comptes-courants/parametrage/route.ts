import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC } from "@/lib/compteCourant";

/**
 * /api/comptes-courants/parametrage
 * GET  — lecture du paramétrage (rôles avec capacité READ)
 * PUT  — modification (admin uniquement, capacité CONFIG)
 */

export async function GET() {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const parametrage = await chargerParametrageCC();
  return NextResponse.json({ data: parametrage });
}

export async function PUT(req: Request) {
  const session = await getCompteCourantSession("CONFIG");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  // Montant ≥ 0 ; null autorisé pour les plafonds optionnels.
  const num = (v: unknown): Prisma.Decimal | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error("MONTANT_INVALIDE");
    return new Prisma.Decimal(n);
  };
  const int = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Math.floor(Number(v));
    if (isNaN(n) || n < 0) throw new Error("MONTANT_INVALIDE");
    return n;
  };

  try {
    const data: Prisma.ParametrageCompteCourantUpdateInput = {
      montantMinOuverture: num(body.montantMinOuverture) ?? undefined,
      soldeMinObligatoire: num(body.soldeMinObligatoire) ?? undefined,
      depotMin:            num(body.depotMin) ?? undefined,
      depotMax:            num(body.depotMax),
      retraitMin:          num(body.retraitMin),
      retraitMax:          num(body.retraitMax),
      soldeMaxAutorise:    num(body.soldeMaxAutorise),
      nbRetraitsMaxParMois: int(body.nbRetraitsMaxParMois),
      dureeInactiviteJours: typeof body.dureeInactiviteJours !== "undefined"
        ? (int(body.dureeInactiviteJours) ?? 0) : undefined,
      joursAlerteAvantSuspension: typeof body.joursAlerteAvantSuspension !== "undefined"
        ? (int(body.joursAlerteAvantSuspension) ?? 0) : undefined,
      autoriserSoldeNegatif: typeof body.autoriserSoldeNegatif === "boolean" ? body.autoriserSoldeNegatif : undefined,
      codeAgence:  typeof body.codeAgence === "string" && body.codeAgence.trim() ? body.codeAgence.trim() : undefined,
      codeGuichet: typeof body.codeGuichet === "string" && body.codeGuichet.trim() ? body.codeGuichet.trim() : undefined,
      compteCaisseNumero:        typeof body.compteCaisseNumero === "string" && body.compteCaisseNumero.trim() ? body.compteCaisseNumero.trim() : undefined,
      compteCourantClientNumero: typeof body.compteCourantClientNumero === "string" && body.compteCourantClientNumero.trim() ? body.compteCourantClientNumero.trim() : undefined,
      compteVentesNumero:        typeof body.compteVentesNumero === "string" && body.compteVentesNumero.trim() ? body.compteVentesNumero.trim() : undefined,
    };

    // Upsert du singleton (id=1)
    await chargerParametrageCC(); // garantit l'existence
    const updated = await prisma.parametrageCompteCourant.update({ where: { id: 1 }, data });

    await prisma.auditLog.create({
      data: { userId: Number(session.user.id), action: "MAJ_PARAMETRAGE_CC", entite: "ParametrageCompteCourant", entiteId: 1 },
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "MONTANT_INVALIDE") {
      return NextResponse.json({ error: "Valeur invalide (les montants doivent être positifs)" }, { status: 400 });
    }
    console.error("PUT /api/comptes-courants/parametrage", e);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
