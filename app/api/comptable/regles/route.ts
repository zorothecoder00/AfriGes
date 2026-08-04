import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/regles
 * Liste les règles comptables paramétrées (moteur central, CDC §7).
 */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const regles = await prisma.regleComptable.findMany({
      orderBy: [{ evenement: "asc" }, { priorite: "desc" }],
    });
    return NextResponse.json({ data: regles });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/regles
 * Crée une règle comptable. Une règle personnalisée active pour un `evenement`
 * donné prend le pas sur la règle par défaut câblée dans lib/comptabilite/moteur.ts.
 *
 * Body: { evenement, moduleSource, compteDebitNumero, compteCreditNumero, journal,
 *         conditionProduit?, conditionFamille?, conditionModePaiement?,
 *         priorite?, actif?, mode?, notes? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      evenement, moduleSource, compteDebitNumero, compteCreditNumero, journal,
      conditionProduit, conditionFamille, conditionModePaiement,
      priorite, actif, mode, notes,
    } = body;

    if (!evenement || !moduleSource || !compteDebitNumero || !compteCreditNumero || !journal) {
      return NextResponse.json(
        { error: "evenement, moduleSource, compteDebitNumero, compteCreditNumero et journal sont requis" },
        { status: 400 },
      );
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const regle = await prisma.$transaction(async (tx) => {
      const r = await tx.regleComptable.create({
        data: {
          evenement: String(evenement).trim(),
          moduleSource: String(moduleSource).trim(),
          compteDebitNumero: String(compteDebitNumero).trim(),
          compteCreditNumero: String(compteCreditNumero).trim(),
          journal,
          conditionProduit: conditionProduit || null,
          conditionFamille: conditionFamille || null,
          conditionModePaiement: conditionModePaiement || null,
          priorite: priorite != null ? Number(priorite) : 0,
          actif: actif != null ? Boolean(actif) : true,
          mode: mode || "AUTOMATIQUE",
          notes: notes || null,
        },
      });
      await auditLog(tx, userId, "CREATION_REGLE_COMPTABLE", "RegleComptable", r.id, { evenement: r.evenement, moduleSource: r.moduleSource }, meta);
      return r;
    });

    return NextResponse.json({ data: regle }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
