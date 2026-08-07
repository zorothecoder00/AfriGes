import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";
import { genererCodeLien, creerLienAffiliation } from "@/lib/partenaireMarketing";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/partenaires/[id]/liens
 * Crée un lien/code d'affiliation pour ce partenaire (CDC §47-49). Si
 * `remise` est fourni, le lien est aussi utilisable comme coupon de réduction
 * à l'achat (même code, réutilise le pipeline Coupon existant).
 * Body: { campagneId?, code?, destinationUrl?, remise?: { typeRemise, valeur, dateDebut, dateFin } }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const { id } = await params;
    const partenaireId = Number(id);
    if (isNaN(partenaireId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const partenaire = await prisma.partenaireMarketing.findUnique({ where: { id: partenaireId }, select: { id: true } });
    if (!partenaire) return NextResponse.json({ error: "Partenaire introuvable" }, { status: 404 });

    const body = await req.json();
    const { campagneId, destinationUrl, remise } = body;

    let remiseData: { typeRemise: "POURCENTAGE" | "MONTANT"; valeur: number; dateDebut: Date; dateFin: Date } | undefined;
    if (remise) {
      const dateDebut = remise.dateDebut ? new Date(remise.dateDebut) : null;
      const dateFin = remise.dateFin ? new Date(remise.dateFin) : null;
      if (!["POURCENTAGE", "MONTANT"].includes(remise.typeRemise) || !Number(remise.valeur) || !dateDebut || !dateFin || isNaN(dateDebut.getTime()) || isNaN(dateFin.getTime())) {
        return NextResponse.json({ error: "Remise invalide (typeRemise/valeur/dateDebut/dateFin requis)" }, { status: 400 });
      }
      remiseData = { typeRemise: remise.typeRemise, valeur: Number(remise.valeur), dateDebut, dateFin };
    }

    const userId = Number(session.user.id);
    const codeFourni = typeof body.code === "string" && body.code.trim() ? body.code.trim().toUpperCase() : null;
    const code = codeFourni ?? (await genererCodeLien());

    try {
      const lien = await prisma.$transaction(async (tx) => {
        const l = await creerLienAffiliation(tx, {
          partenaireId, campagneId: campagneId ? Number(campagneId) : null, code,
          destinationUrl: destinationUrl || null, creeParId: userId, remise: remiseData,
        });
        await auditLog(tx, userId, "LIEN_AFFILIATION_CREE", "LienAffiliation", l.id);
        return l;
      });
      return NextResponse.json({ data: lien }, { status: 201 });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
        return NextResponse.json({ error: "Ce code est déjà utilisé" }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    console.error("POST /api/admin/marketing/partenaires/[id]/liens", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
