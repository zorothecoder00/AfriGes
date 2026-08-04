import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getRequestMeta } from "@/lib/requestMeta";
import { auditLog } from "@/lib/notifications";
import { doterProvision } from "@/lib/comptabilite/provisions";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/comptable/provisions/[id]/doter — Body: { montant, date? }. */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const provisionId = Number(id);
    if (isNaN(provisionId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const montant = Number(body?.montant);
    if (!montant || montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

    const userId = Number(session.user.id);
    const date = body?.date ? new Date(body.date) : new Date();
    const meta = getRequestMeta(req);

    const result = await prisma.$transaction(async (tx) => {
      const r = await doterProvision(tx, provisionId, montant, date, userId);
      await auditLog(tx, userId, "DOTATION_PROVISION", "ProvisionDepreciation", provisionId, { montant }, meta);
      return r;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    if (e instanceof Error && ["PROVISION_INTROUVABLE", "PROVISION_SOLDEE", "MONTANT_INVALIDE"].includes(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
