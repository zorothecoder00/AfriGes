import { NextRequest, NextResponse } from "next/server";
import { TypeZoneChalandise } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

const TYPES: TypeZoneChalandise[] = ["VILLE", "COMMUNE", "QUARTIER", "MARCHE", "ENTREPRISE", "ECOLE", "INSTITUTION"];

/**
 * Zones de chalandise par agence (CDC §50).
 * GET  — liste (filtre ?pointDeVenteId=).
 * POST — ajoute une entrée (ville/commune/quartier/marché/entreprise/école/institution).
 */
export async function GET(req: Request) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const pointDeVenteId = searchParams.get("pointDeVenteId");

    const zones = await prisma.zoneChalandise.findMany({
      where: pointDeVenteId ? { pointDeVenteId: Number(pointDeVenteId) } : {},
      orderBy: [{ pointDeVenteId: "asc" }, { type: "asc" }],
      include: { pointDeVente: { select: { id: true, nom: true, code: true } } },
    });

    return NextResponse.json({ data: zones });
  } catch (e) {
    console.error("GET /api/admin/marketing/zones-chalandise", e);
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
    const { pointDeVenteId, type, nom, notes } = body;

    if (!pointDeVenteId) return NextResponse.json({ error: "L'agence est requise" }, { status: 400 });
    if (!TYPES.includes(type)) return NextResponse.json({ error: "Type de zone invalide" }, { status: 400 });
    const nomTrim = typeof nom === "string" ? nom.trim() : "";
    if (!nomTrim) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const pdv = await prisma.pointDeVente.findUnique({ where: { id: Number(pointDeVenteId) }, select: { id: true } });
    if (!pdv) return NextResponse.json({ error: "Agence introuvable" }, { status: 404 });

    const userId = Number(session.user.id);
    const zone = await prisma.$transaction(async (tx) => {
      const z = await tx.zoneChalandise.create({
        data: { pointDeVenteId: Number(pointDeVenteId), type, nom: nomTrim, notes: notes || null },
      });
      await auditLog(tx, userId, "ZONE_CHALANDISE_CREEE", "ZoneChalandise", z.id);
      return z;
    });

    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/zones-chalandise", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
