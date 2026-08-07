import { NextRequest, NextResponse } from "next/server";
import { Prisma, TypeRemisePromotion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { genererCodeCoupon } from "@/lib/coupon";
import { TYPES_REMISE } from "@/lib/promotions";

/**
 * Coupons marketing (CDC §35) — codes saisis, remise sur le panier (scopé
 * vente admin pour cette phase).
 * GET  — liste des coupons.
 * POST — crée un coupon (code fourni ou généré, remise, restrictions, période).
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        campagne: { select: { id: true, code: true, nom: true } },
        audience: { select: { id: true, nom: true } },
        pointDeVente: { select: { id: true, nom: true } },
        produit: { select: { id: true, nom: true } },
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { utilisations: true } },
      },
    });

    return NextResponse.json({ data: coupons.map((c) => ({ ...c, valeur: Number(c.valeur) })) });
  } catch (e) {
    console.error("GET /api/admin/marketing/coupons", e);
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
    const { nom, description, campagneId, typeRemise, valeur, audienceId, pointDeVenteId, produitId, dateDebut, dateFin, utilisationMax, actif } = body;

    if (!nom || !typeRemise || !TYPES_REMISE.includes(typeRemise as (typeof TYPES_REMISE)[number])) {
      return NextResponse.json({ error: "Nom et type de remise (valide) sont requis" }, { status: 400 });
    }
    if (typeRemise === "LOT") {
      return NextResponse.json({ error: "Le type LOT n'a pas de sens sur un coupon panier — utilisez POURCENTAGE ou MONTANT" }, { status: 400 });
    }
    const valeurNum = Number(valeur);
    if (!valeurNum || valeurNum <= 0) return NextResponse.json({ error: "La valeur de la remise doit être supérieure à 0" }, { status: 400 });
    if (typeRemise === "POURCENTAGE" && valeurNum > 100) return NextResponse.json({ error: "Le pourcentage doit être ≤ 100" }, { status: 400 });

    const dDebut = dateDebut ? new Date(dateDebut) : null;
    const dFin = dateFin ? new Date(dateFin) : null;
    if (!dDebut || isNaN(dDebut.getTime())) return NextResponse.json({ error: "Date de début invalide" }, { status: 400 });
    if (!dFin || isNaN(dFin.getTime())) return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 });
    if (dFin < dDebut) return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 });

    const userId = Number(session.user.id);
    const codeFourni = typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : null;
    const code = codeFourni ?? (await genererCodeCoupon());

    try {
      const coupon = await prisma.$transaction(async (tx) => {
        const c = await tx.coupon.create({
          data: {
            code, nom, description: description || null,
            campagneId: campagneId ? Number(campagneId) : null,
            typeRemise: typeRemise as TypeRemisePromotion,
            valeur: new Prisma.Decimal(valeurNum),
            audienceId: audienceId ? Number(audienceId) : null,
            pointDeVenteId: pointDeVenteId ? Number(pointDeVenteId) : null,
            produitId: produitId ? Number(produitId) : null,
            dateDebut: dDebut, dateFin: dFin,
            utilisationMax: utilisationMax ? Number(utilisationMax) : null,
            actif: actif === undefined ? true : Boolean(actif),
            creeParId: userId,
          },
        });
        await auditLog(tx, userId, "COUPON_CREE", "Coupon", c.id);
        return c;
      });
      return NextResponse.json({ data: { ...coupon, valeur: Number(coupon.valeur) } }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "Ce code coupon est déjà utilisé" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/admin/marketing/coupons", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
