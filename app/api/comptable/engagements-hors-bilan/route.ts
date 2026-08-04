import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/** Référence d'engagement, ex. "ENG-2026-000001" — séquence propre à l'année civile. */
async function genererReferenceEngagement(): Promise<string> {
  const annee = new Date().getFullYear();
  const prefixe = `ENG-${annee}-`;
  const count = await prisma.engagementHorsBilan.count({ where: { reference: { startsWith: prefixe } } });
  return `${prefixe}${String(count + 1).padStart(6, "0")}`;
}

/**
 * GET /api/comptable/engagements-hors-bilan?statut=&type=
 * Engagements hors-bilan (CDC §39) — cautions, garanties, crédit-bail, litiges.
 */
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const type = searchParams.get("type");

    const engagements = await prisma.engagementHorsBilan.findMany({
      where: { ...(statut && { statut: statut as never }), ...(type && { type: type as never }) },
      include: { creePar: { select: { nom: true, prenom: true } } },
      orderBy: { dateDebut: "desc" },
    });
    return NextResponse.json({ data: engagements });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/comptable/engagements-hors-bilan
 * Body: { type, libelle, montant, beneficiaire?, dateDebut, dateFin?, notes? }
 */
export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { type, libelle, montant, beneficiaire, dateDebut, dateFin, notes } = body as {
      type?: string; libelle?: string; montant?: number; beneficiaire?: string; dateDebut?: string; dateFin?: string; notes?: string;
    };

    const TYPES_VALIDES = ["CAUTION_DONNEE", "CAUTION_RECUE", "GARANTIE_DONNEE", "GARANTIE_RECUE", "CREDIT_BAIL", "LITIGE_EN_COURS", "AUTRE"];
    if (!type || !TYPES_VALIDES.includes(type)) return NextResponse.json({ error: "type invalide" }, { status: 400 });
    if (!libelle || !montant || !dateDebut) return NextResponse.json({ error: "libelle, montant et dateDebut sont requis" }, { status: 400 });

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const reference = await genererReferenceEngagement();

    const engagement = await prisma.$transaction(async (tx) => {
      const e = await tx.engagementHorsBilan.create({
        data: {
          reference, type: type as never, libelle, montant: Number(montant),
          beneficiaire: beneficiaire || null, dateDebut: new Date(dateDebut), dateFin: dateFin ? new Date(dateFin) : null,
          notes: notes || null, creeParId: userId,
        },
      });
      await auditLog(tx, userId, "CREATION_ENGAGEMENT_HORS_BILAN", "EngagementHorsBilan", e.id, { type, montant: Number(montant), reference }, meta);
      return e;
    });

    return NextResponse.json({ data: engagement }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
