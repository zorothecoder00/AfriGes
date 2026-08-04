import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { creerChargeProduitAttente } from "@/lib/comptabilite/chargesProduitsAttente";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/charges-produits-attente?statut=&type=
 * Charges à payer / produits à recevoir (CDC §27).
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");

    const items = await prisma.chargeProduitAttente.findMany({
      where: { ...(statut && { statut: statut as never }), ...(type && { type: type as never }) },
      include: {
        compteChargeOuProduit: { select: { numero: true, libelle: true } },
        compteAttente: { select: { numero: true, libelle: true } },
        creePar: { select: { nom: true, prenom: true } },
      },
      orderBy: { dateConstatation: "desc" },
    });
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/charges-produits-attente
 * Body: { libelle, type, compteChargeOuProduitNumero, compteAttenteNumero?, montant, dateConstatation, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { libelle, type, compteChargeOuProduitNumero, compteAttenteNumero, montant, dateConstatation, notes } = body as {
      libelle?: string; type?: "CHARGE_A_PAYER" | "PRODUIT_A_RECEVOIR"; compteChargeOuProduitNumero?: string;
      compteAttenteNumero?: string; montant?: number; dateConstatation?: string; notes?: string;
    };

    if (!libelle || !type || !compteChargeOuProduitNumero || !montant || !dateConstatation) {
      return NextResponse.json({ error: "libelle, type, compteChargeOuProduitNumero, montant et dateConstatation sont requis" }, { status: 400 });
    }
    if (type !== "CHARGE_A_PAYER" && type !== "PRODUIT_A_RECEVOIR") {
      return NextResponse.json({ error: "type invalide" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const item = await prisma.$transaction(async (tx) => {
      const i = await creerChargeProduitAttente(tx, {
        libelle, type, compteChargeOuProduitNumero, compteAttenteNumero,
        montant: Number(montant), dateConstatation: new Date(dateConstatation), notes,
      }, userId);
      await auditLog(tx, userId, "CONSTATATION_CHARGE_PRODUIT_ATTENTE", "ChargeProduitAttente", i.id, { type, montant: Number(montant) }, meta);
      return i;
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("COMPTE_INTROUVABLE")) return NextResponse.json({ error: `Compte introuvable : ${msg.split(":")[1]}` }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
