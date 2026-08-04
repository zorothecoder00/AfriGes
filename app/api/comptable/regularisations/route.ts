import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getRequestMeta } from "@/lib/requestMeta";
import { auditLog } from "@/lib/notifications";
import { creerRegularisation, listerRegularisations, type CreerRegularisationOpts } from "@/lib/comptabilite/regularisationsAvance";

/**
 * GET /api/comptable/regularisations — liste des CCA/PCA (filtrable par type/statut).
 * POST /api/comptable/regularisations — constate une charge/produit d'avance et génère son échéancier.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const statut = searchParams.get("statut") ?? undefined;

    const data = await listerRegularisations(prisma, { type: type as never, statut: statut as never });
    return NextResponse.json({ data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = (await req.json()) as Partial<CreerRegularisationOpts>;
    const { libelle, type, compteChargeOuProduitNumero, compteRegularisationNumero, montantTotal, dateDebut, dateFin } = body;
    if (!libelle || !type || !compteChargeOuProduitNumero || !compteRegularisationNumero || !montantTotal || !dateDebut || !dateFin) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const regularisation = await prisma.$transaction(async (tx) => {
      const r = await creerRegularisation(
        tx,
        {
          libelle,
          type,
          compteChargeOuProduitNumero,
          compteRegularisationNumero,
          montantTotal: Number(montantTotal),
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          societeId: body.societeId ?? null,
        },
        userId,
      );
      await auditLog(tx, userId, "CREATION_REGULARISATION", "RegularisationAvance", r.id, { libelle, type, montantTotal }, meta);
      return r;
    });

    return NextResponse.json({ data: regularisation }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message.startsWith("COMPTE_INTROUVABLE") || e.message === "MONTANT_INVALIDE" || e.message === "PERIODE_INVALIDE")) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
