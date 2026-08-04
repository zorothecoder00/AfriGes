import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { getRequestMeta } from "@/lib/requestMeta";
import { auditLog } from "@/lib/notifications";
import { creerProvision, listerProvisions, type CreerProvisionOpts } from "@/lib/comptabilite/provisions";

/**
 * GET /api/comptable/provisions — liste (filtrable par type/statut).
 * POST /api/comptable/provisions — créer le registre d'une provision (CDC — provisions/dépréciations).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const statut = searchParams.get("statut") ?? undefined;

    const data = await listerProvisions(prisma, {
      type: type as never,
      statut: statut as never,
    });
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

    const body = (await req.json()) as Partial<CreerProvisionOpts>;
    const { libelle, type, compteProvisionNumero, compteDotationNumero, compteRepriseNumero, montantInitial, motif, dateConstitution } = body;
    if (!libelle || !type || !compteProvisionNumero || !compteDotationNumero || !compteRepriseNumero || !montantInitial || !motif || !dateConstitution) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);

    const provision = await prisma.$transaction(async (tx) => {
      const p = await creerProvision(
        tx,
        {
          libelle,
          type,
          compteProvisionNumero,
          compteDotationNumero,
          compteRepriseNumero,
          montantInitial: Number(montantInitial),
          motif,
          dateConstitution: new Date(dateConstitution),
          clientId: body.clientId ?? null,
          fournisseurId: body.fournisseurId ?? null,
          immobilisationId: body.immobilisationId ?? null,
          societeId: body.societeId ?? null,
        },
        userId,
      );
      await auditLog(tx, userId, "CREATION_PROVISION", "ProvisionDepreciation", p.id, { libelle, type, montantInitial }, meta);
      return p;
    });

    return NextResponse.json({ data: provision }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.startsWith("COMPTE_INTROUVABLE")) {
      return NextResponse.json({ error: `Compte introuvable : ${e.message.split(":")[1]}` }, { status: 422 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
