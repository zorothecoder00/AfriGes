import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { chargerParametragePrixAuto } from "@/lib/tarification";

/**
 * /api/admin/catalogue/prix-auto (Enterprise #6)
 * GET — lecture du paramétrage du moteur de prix automatique — admin.
 * PUT — modification — admin.
 */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });
  const param = await chargerParametragePrixAuto();
  return NextResponse.json({ data: param });
}

export async function PUT(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const dec = (v: unknown): Prisma.Decimal | undefined => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error("VAL_INVALIDE");
    return new Prisma.Decimal(n);
  };

  try {
    const data: Prisma.ParametragePrixAutoUpdateInput = {
      actif: typeof body.actif === "boolean" ? body.actif : undefined,
      appliquerSurCredit: typeof body.appliquerSurCredit === "boolean" ? body.appliquerSurCredit : undefined,
      margeCiblePct: dec(body.margeCiblePct),
      fraisLogistiquePct: dec(body.fraisLogistiquePct),
      margeCreditPct: dec(body.margeCreditPct),
      arrondi: body.arrondi != null && body.arrondi !== "" ? Math.max(0, Math.floor(Number(body.arrondi))) : undefined,
    };
    await chargerParametragePrixAuto();
    const updated = await prisma.parametragePrixAuto.update({ where: { id: 1 }, data });
    await prisma.auditLog.create({ data: { userId: Number(session.user.id), action: "MAJ_PRIX_AUTO", entite: "ParametragePrixAuto", entiteId: 1 } });
    return NextResponse.json({ data: updated });
  } catch (e) {
    if (e instanceof Error && e.message === "VAL_INVALIDE") {
      return NextResponse.json({ message: "Valeur invalide (les nombres doivent être positifs)" }, { status: 400 });
    }
    console.error("PUT /api/admin/catalogue/prix-auto", e);
    return NextResponse.json({ message: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}
