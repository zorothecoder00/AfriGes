import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { extournerChargeProduitAttente } from "@/lib/comptabilite/chargesProduitsAttente";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

type Ctx = { params: Promise<{ id: string }> };

const MESSAGES: Record<string, [string, number]> = {
  ITEM_INTROUVABLE: ["Charge/produit à payer/recevoir introuvable", 404],
  DEJA_EXTOURNEE: ["Déjà extournée", 422],
};

/** POST /api/comptable/charges-produits-attente/[id]/extourner — Body: { date? } */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const dateExtourne = body?.date ? new Date(body.date) : new Date();

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const result = await prisma.$transaction(async (tx) => {
      const r = await extournerChargeProduitAttente(tx, Number(id), userId, dateExtourne);
      await auditLog(tx, userId, "EXTOURNE_CHARGE_PRODUIT_ATTENTE", "ChargeProduitAttente", Number(id), {}, meta);
      return r;
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    console.error(e);
    if (e instanceof Error && MESSAGES[e.message]) {
      const [message, status] = MESSAGES[e.message];
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
