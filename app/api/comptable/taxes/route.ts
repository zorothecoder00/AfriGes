import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/** GET /api/comptable/taxes — registre des taxes paramétrables (CDC §21). */
export async function GET() {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const taxes = await prisma.taxeConfig.findMany({ orderBy: { code: "asc" } });
    return NextResponse.json({ data: taxes });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/taxes
 * Body: { code, nom, taux, nature, compteCollecteNumero, compteDeductibleNumero?,
 *         compteRegularisationNumero?, regimeFiscal?, applicableAchat?, applicableVente?,
 *         dateDebut?, dateFin? }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const {
      code, nom, taux, nature, compteCollecteNumero, compteDeductibleNumero, compteRegularisationNumero,
      regimeFiscal, applicableAchat, applicableVente, dateDebut, dateFin,
    } = body;

    if (!code || !nom || taux == null || !nature || !compteCollecteNumero) {
      return NextResponse.json({ error: "code, nom, taux, nature et compteCollecteNumero sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const taxe = await prisma.$transaction(async (tx) => {
      const t = await tx.taxeConfig.create({
        data: {
          code: String(code).trim(),
          nom: String(nom).trim(),
          taux: Number(taux),
          nature: String(nature).trim(),
          compteCollecteNumero: String(compteCollecteNumero).trim(),
          compteDeductibleNumero: compteDeductibleNumero || null,
          compteRegularisationNumero: compteRegularisationNumero || null,
          regimeFiscal: regimeFiscal || "REEL_NORMAL",
          applicableAchat: applicableAchat != null ? Boolean(applicableAchat) : true,
          applicableVente: applicableVente != null ? Boolean(applicableVente) : true,
          dateDebut: dateDebut ? new Date(dateDebut) : null,
          dateFin: dateFin ? new Date(dateFin) : null,
        },
      });
      await auditLog(tx, userId, "CREATION_TAXE_CONFIG", "TaxeConfig", t.id, { code: t.code, nom: t.nom, taux: t.taux }, meta);
      return t;
    });
    return NextResponse.json({ data: taxe }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce code de taxe existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
