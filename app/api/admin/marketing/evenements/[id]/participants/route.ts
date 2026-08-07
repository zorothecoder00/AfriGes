import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/marketing/evenements/[id]/participants
 * Ajoute un invité/inscrit à un événement (CDC §42).
 * Body: { nom, telephone?, email? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "CREATION");
    if (denied) return denied;

    const { id } = await params;
    const evenementId = Number(id);
    if (isNaN(evenementId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const evenement = await prisma.evenementMarketing.findUnique({ where: { id: evenementId }, select: { id: true } });
    if (!evenement) return NextResponse.json({ error: "Événement introuvable" }, { status: 404 });

    const body = await req.json();
    const nom = typeof body.nom === "string" ? body.nom.trim() : "";
    if (!nom) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const participant = await prisma.participantEvenement.create({
      data: {
        evenementId, nom,
        telephone: typeof body.telephone === "string" && body.telephone.trim() ? body.telephone.trim() : null,
        email: typeof body.email === "string" && body.email.trim() ? body.email.trim() : null,
        statut: "INVITE",
      },
    });

    return NextResponse.json({ data: participant }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/evenements/[id]/participants", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
