import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { validerDepenseMarketing } from "@/lib/depenseMarketing";
import { creerEcritureDepenseMarketing } from "@/lib/ecritureDepenseMarketingServer";

/**
 * Dépenses marketing (CDC §53).
 * GET  — liste (filtre ?campagneId=).
 * POST — enregistre une dépense et crée son écriture comptable automatique.
 */
export async function GET(req: Request) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const campagneId = searchParams.get("campagneId");

    const depenses = await prisma.depenseMarketing.findMany({
      where: campagneId ? { campagneId: Number(campagneId) } : {},
      orderBy: { date: "desc" },
      include: { campagne: { select: { id: true, code: true, nom: true } }, creePar: { select: { id: true, nom: true, prenom: true } } },
    });

    return NextResponse.json({ data: depenses.map((d) => ({ ...d, montant: Number(d.montant) })) });
  } catch (e) {
    console.error("GET /api/admin/marketing/depenses", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const body = await req.json();
    const valid = await validerDepenseMarketing(body);
    if ("error" in valid) return NextResponse.json({ error: valid.error }, { status: valid.status });

    const userId = Number(session.user.id);
    const depense = await prisma.$transaction(async (tx) => {
      const d = await tx.depenseMarketing.create({ data: { ...valid.data, creeParId: userId } });
      if (valid.data.budgetId) {
        await tx.budgetMarketing.update({ where: { id: valid.data.budgetId }, data: { montantEngage: { increment: valid.data.montant } } });
      }
      await creerEcritureDepenseMarketing(tx, d.id, userId);
      await auditLog(tx, userId, "DEPENSE_MARKETING_CREEE", "DepenseMarketing", d.id);
      return tx.depenseMarketing.findUniqueOrThrow({ where: { id: d.id } });
    });

    return NextResponse.json({ data: { ...depense, montant: Number(depense.montant) } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/depenses", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
