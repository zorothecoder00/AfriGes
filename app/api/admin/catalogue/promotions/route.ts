import { NextResponse } from "next/server";
import { Prisma, PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog, notifyRoles } from "@/lib/notifications";
import { validerPromotion } from "@/lib/promotionValidation";

/**
 * Promotions du catalogue (Catalogue §9) — Phase 5.
 * GET  — liste des promotions (filtres statut/cible) — admin.
 * POST — crée une promotion (périmètre + remise + période) — admin.
 */
export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut"); // EN_COURS | PROGRAMMEE | EXPIREE | INACTIVE
  const now = new Date();

  const where: Prisma.PromotionWhereInput = {};
  if (statut === "INACTIVE") where.actif = false;
  else if (statut === "EN_COURS") Object.assign(where, { actif: true, dateDebut: { lte: now }, dateFin: { gte: now } });
  else if (statut === "PROGRAMMEE") Object.assign(where, { actif: true, dateDebut: { gt: now } });
  else if (statut === "EXPIREE") Object.assign(where, { actif: true, dateFin: { lt: now } });

  const promos = await prisma.promotion.findMany({
    where,
    orderBy: [{ actif: "desc" }, { dateDebut: "desc" }],
    select: {
      id: true, code: true, nom: true, description: true, cible: true,
      typeRemise: true, valeur: true, lotAchete: true, lotPaye: true,
      segment: true, dateDebut: true, dateFin: true, actif: true, priorite: true, createdAt: true,
      produit: { select: { id: true, nom: true, codeProduit: true } },
      categorie: { select: { id: true, nom: true } },
      famille: { select: { id: true, nom: true } },
      marque: { select: { id: true, nom: true } },
      pointDeVente: { select: { id: true, nom: true } },
      client: { select: { id: true, nom: true, prenom: true } },
    },
  });

  return NextResponse.json({ data: promos.map((p) => ({ ...p, valeur: Number(p.valeur) })) });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });

  const valid = await validerPromotion(body);
  if ("error" in valid) return NextResponse.json({ message: valid.error }, { status: valid.status });

  const userId = Number(session.user.id);

  for (let attempt = 0; attempt < 6; attempt++) {
    const count = await prisma.promotion.count();
    const code = `PROMO-${String(count + 1 + attempt).padStart(6, "0")}`;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const p = await tx.promotion.create({
          data: { ...valid.data, code, creeParId: userId },
          select: { id: true, code: true, nom: true, actif: true },
        });
        await auditLog(tx, userId, "PROMOTION_CREEE", "Promotion", p.id);
        if (p.actif) {
          await notifyRoles(tx, ["CAISSIER", "RESPONSABLE_POINT_DE_VENTE", "COMMERCIAL", "AGENT_TERRAIN"], {
            titre: "Nouvelle promotion",
            message: `La promotion « ${p.nom} » (${p.code}) est disponible.`,
            priorite: PrioriteNotification.NORMAL,
            actionUrl: "/dashboard/admin/catalogue/promotions",
          });
        }
        return p;
      });
      return NextResponse.json({ data: created }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("code")) continue;
      console.error("POST /api/admin/catalogue/promotions", e);
      return NextResponse.json({ message: "Erreur lors de la création de la promotion" }, { status: 500 });
    }
  }
  return NextResponse.json({ message: "Impossible de générer un code de promotion unique, réessayez" }, { status: 500 });
}
