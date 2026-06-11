import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const seuilRetard = Number(body.seuilRetard ?? 3);   // jours → EN_RETARD
    const seuilDefaut = Number(body.seuilDefaut ?? 30);  // jours EN_RETARD → DEFAUT

    const now = new Date();

    // ── ACTIF avec échéance dépassée → EN_RETARD ───────────────────────
    const seuilRetardDate = new Date(now);
    seuilRetardDate.setDate(seuilRetardDate.getDate() - seuilRetard);

    const retardResult = await prisma.operationFinancementRIA.updateMany({
      where: {
        statut:       "ACTIF",
        dateEcheance: { lt: seuilRetardDate },
        encours:      { gt: 0 },
      },
      data: { statut: "EN_RETARD" },
    });

    // ── EN_RETARD avec échéance > seuilDefaut jours → DEFAUT ──────────
    const seuilDefautDate = new Date(now);
    seuilDefautDate.setDate(seuilDefautDate.getDate() - seuilDefaut);

    const enRetardIds = await prisma.operationFinancementRIA.findMany({
      where: {
        statut:       "EN_RETARD",
        dateEcheance: { lt: seuilDefautDate },
        encours:      { gt: 0 },
      },
      select: { id: true, portefeuilleId: true, encours: true },
    });

    let defautCount = 0;
    for (const fin of enRetardIds) {
      await prisma.$transaction(async (tx) => {
        const encours = Number(fin.encours);
        await tx.operationFinancementRIA.update({
          where: { id: fin.id },
          data:  { statut: "DEFAUT" },
        });
        // capital flow : capitalEngage → capitalBloque
        await tx.portefeuilleRIA.update({
          where: { id: fin.portefeuilleId },
          data: {
            capitalEngage: { decrement: encours },
            capitalBloque: { increment: encours },
          },
        });
      });
      defautCount++;
    }

    return NextResponse.json({
      message:      "Escalade effectuée",
      enRetard:     retardResult.count,
      enDefaut:     defautCount,
    });
  } catch (error) {
    console.error("POST /api/admin/ria/recouvrement/escalade", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
