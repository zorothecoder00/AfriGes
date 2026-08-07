import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { statsPartenaire } from "@/lib/partenaireMarketing";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/partenaires/[id] — détail + liens + stats (clics/ventes/CA/commission/ROI). */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const partenaireId = Number(id);
    if (isNaN(partenaireId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const partenaire = await prisma.partenaireMarketing.findUnique({
      where: { id: partenaireId },
      include: {
        liens: {
          orderBy: { createdAt: "desc" },
          include: { campagne: { select: { id: true, code: true, nom: true } }, coupon: { select: { id: true, code: true } } },
        },
      },
    });
    if (!partenaire) return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });

    const stats = await statsPartenaire(partenaireId);

    return NextResponse.json({
      data: {
        ...partenaire,
        tarif: partenaire.tarif !== null ? Number(partenaire.tarif) : null,
        commissionPct: Number(partenaire.commissionPct),
      },
      stats,
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/partenaires/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/partenaires/[id] — édition. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const partenaireId = Number(id);
    if (isNaN(partenaireId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { nom, contact, plateforme, audienceTaille, tarif, commissionPct, actif } = body;
    const userId = Number(session.user.id);

    const partenaire = await prisma.$transaction(async (tx) => {
      const updated = await tx.partenaireMarketing.update({
        where: { id: partenaireId },
        data: {
          ...(nom !== undefined ? { nom } : {}),
          ...(contact !== undefined ? { contact: contact || null } : {}),
          ...(plateforme !== undefined ? { plateforme: plateforme || null } : {}),
          ...(audienceTaille !== undefined ? { audienceTaille: audienceTaille ? Number(audienceTaille) : null } : {}),
          ...(tarif !== undefined ? { tarif: tarif != null && tarif !== "" ? new Prisma.Decimal(Number(tarif)) : null } : {}),
          ...(commissionPct !== undefined ? { commissionPct: new Prisma.Decimal(Number(commissionPct) || 0) } : {}),
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "PartenaireMarketing", partenaireId, { actif });
      return updated;
    });

    return NextResponse.json({ data: { ...partenaire, tarif: partenaire.tarif !== null ? Number(partenaire.tarif) : null, commissionPct: Number(partenaire.commissionPct) } });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/partenaires/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
