import { NextRequest, NextResponse } from "next/server";
import { Prisma, TypePartenaireMarketing } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

const TYPES: TypePartenaireMarketing[] = ["INFLUENCEUR", "AFFILIE"];

/**
 * Influenceurs & Affiliés (CDC §47-49).
 * GET  — liste des partenaires (filtre ?type=INFLUENCEUR|AFFILIE).
 * POST — crée un partenaire.
 */
export async function GET(req: Request) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const where = type && TYPES.includes(type as TypePartenaireMarketing) ? { type: type as TypePartenaireMarketing } : {};

    const partenaires = await prisma.partenaireMarketing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { liens: true } } },
    });

    return NextResponse.json({
      data: partenaires.map((p) => ({ ...p, tarif: p.tarif !== null ? Number(p.tarif) : null, commissionPct: Number(p.commissionPct) })),
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/partenaires", e);
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
    const { type, nom, contact, plateforme, audienceTaille, tarif, commissionPct, actif } = body;

    if (!TYPES.includes(type)) return NextResponse.json({ error: "Type invalide (INFLUENCEUR ou AFFILIE)" }, { status: 400 });
    const nomTrim = typeof nom === "string" ? nom.trim() : "";
    if (!nomTrim) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const userId = Number(session.user.id);
    const partenaire = await prisma.$transaction(async (tx) => {
      const p = await tx.partenaireMarketing.create({
        data: {
          type, nom: nomTrim, contact: contact || null, plateforme: plateforme || null,
          audienceTaille: audienceTaille ? Number(audienceTaille) : null,
          tarif: tarif != null && tarif !== "" ? new Prisma.Decimal(Number(tarif)) : null,
          commissionPct: new Prisma.Decimal(Number(commissionPct) || 0),
          actif: actif === undefined ? true : Boolean(actif),
          creeParId: userId,
        },
      });
      await auditLog(tx, userId, "PARTENAIRE_CREE", "PartenaireMarketing", p.id);
      return p;
    });

    return NextResponse.json({ data: { ...partenaire, tarif: partenaire.tarif !== null ? Number(partenaire.tarif) : null, commissionPct: Number(partenaire.commissionPct) } }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/partenaires", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
