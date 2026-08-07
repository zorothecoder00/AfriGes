import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/marketing/coupons/[id] — détail + historique d'utilisation. */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { id } = await params;
    const couponId = Number(id);
    if (isNaN(couponId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        audience: { select: { id: true, nom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        produit: { select: { id: true, nom: true } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        utilisations: {
          orderBy: { dateUtilisation: "desc" },
          include: { client: { select: { id: true, nom: true, prenom: true } }, vente: { select: { id: true, reference: true } } },
        },
      },
    });
    if (!coupon) return NextResponse.json({ error: "Coupon introuvable" }, { status: 404 });

    return NextResponse.json({
      data: {
        ...coupon,
        valeur: Number(coupon.valeur),
        utilisations: coupon.utilisations.map((u) => ({ ...u, montantRemise: Number(u.montantRemise) })),
      },
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/coupons/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** PATCH /api/admin/marketing/coupons/[id] — actif/dates/plafond. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "MODIFICATION");
    if (denied) return denied;

    const { id } = await params;
    const couponId = Number(id);
    if (isNaN(couponId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const { actif, dateDebut, dateFin, utilisationMax, nom, description } = body;
    const userId = Number(session.user.id);

    const coupon = await prisma.$transaction(async (tx) => {
      const updated = await tx.coupon.update({
        where: { id: couponId },
        data: {
          ...(actif !== undefined ? { actif: Boolean(actif) } : {}),
          ...(dateDebut !== undefined ? { dateDebut: new Date(dateDebut) } : {}),
          ...(dateFin !== undefined ? { dateFin: new Date(dateFin) } : {}),
          ...(utilisationMax !== undefined ? { utilisationMax: utilisationMax === null ? null : Number(utilisationMax) } : {}),
          ...(nom !== undefined ? { nom } : {}),
          ...(description !== undefined ? { description: description || null } : {}),
        },
      });
      await auditLog(tx, userId, "UPDATE", "Coupon", couponId, { actif });
      return updated;
    });

    return NextResponse.json({ data: { ...coupon, valeur: Number(coupon.valeur) } });
  } catch (e) {
    console.error("PATCH /api/admin/marketing/coupons/[id]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
