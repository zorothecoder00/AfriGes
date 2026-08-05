import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptableLectureSession } from "@/lib/authComptable";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

/**
 * GET /api/comptable/referentiels
 * POST /api/comptable/referentiels
 * Référentiels comptables versionnés (CDC §77) : Référentiel/Version/Date
 * d'application/Pays. `actif` sur ConfigurationComptableInitiale.referentielActifId
 * détermine celui en vigueur (voir /referentiels/[id]/activer).
 */
export async function GET() {
  try {
    const session = await getComptableLectureSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "LECTURE");
    if (denied) return denied;

    const [referentiels, config] = await Promise.all([
      prisma.referentielComptable.findMany({ orderBy: { dateApplication: "desc" } }),
      prisma.configurationComptableInitiale.findUnique({ where: { id: 1 }, select: { referentielActifId: true } }),
    ]);
    return NextResponse.json({ data: referentiels, referentielActifId: config?.referentielActifId ?? null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "comptabilite", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const { code, nom, version, pays, dateApplication, notes } = body;
    if (!code || !nom || !version || !pays || !dateApplication) {
      return NextResponse.json({ error: "code, nom, version, pays et dateApplication sont requis" }, { status: 400 });
    }

    const userId = Number(session.user.id);
    const meta = getRequestMeta(req);
    const referentiel = await prisma.$transaction(async (tx) => {
      const r = await tx.referentielComptable.create({
        data: {
          code: String(code).trim(),
          nom: String(nom).trim(),
          version: String(version).trim(),
          pays: String(pays).trim(),
          dateApplication: new Date(dateApplication),
          notes: notes || null,
        },
      });
      await auditLog(tx, userId, "CREATION_REFERENTIEL_COMPTABLE", "ReferentielComptable", r.id, { code: r.code, version: r.version }, meta);
      return r;
    });

    return NextResponse.json({ data: referentiel }, { status: 201 });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ce code de référentiel existe déjà" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
