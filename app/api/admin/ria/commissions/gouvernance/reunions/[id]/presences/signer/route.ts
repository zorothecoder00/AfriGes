import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCommissionMembreSession } from "@/lib/authCommissionRIA";
import crypto from "crypto";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — signer sa présence (membre authentifié)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const auth = await getCommissionMembreSession();
    if (!auth) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const reunionId = parseInt(id);
    const userId    = parseInt(auth.session.user.id);

    // Trouver le membre correspondant
    const membre = await prisma.membreCommissionRIA.findFirst({
      where: { userId, actif: true },
      select: { id: true },
    });
    if (!membre) return NextResponse.json({ error: "Vous n'êtes pas membre d'une commission" }, { status: 403 });

    // Vérifier que la présence existe pour cette réunion
    const presence = await prisma.presenceReunionRIA.findUnique({
      where: { reunionId_membreId: { reunionId, membreId: membre.id } },
    });
    if (!presence) return NextResponse.json({ error: "Présence introuvable pour cette réunion" }, { status: 404 });
    if (presence.signatureNumerique) return NextResponse.json({ error: "Déjà signé" }, { status: 409 });

    const token = crypto.randomBytes(32).toString("hex");

    const updated = await prisma.presenceReunionRIA.update({
      where: { reunionId_membreId: { reunionId, membreId: membre.id } },
      data: {
        present:           true,
        signatureNumerique: true,
        dateSignature:      new Date(),
        signatureToken:     token,
      },
    });

    return NextResponse.json({ success: true, dateSignature: updated.dateSignature });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
