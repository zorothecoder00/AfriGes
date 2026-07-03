import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/collaborateur/prets/[id]
 * Seule action autorisée : ANNULER sa propre demande, tant qu'elle n'est pas
 * approuvée/décaissée (EN_ATTENTE ou VALIDE_MANAGER).
 * Body: { action: "ANNULER" }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ error: "Aucun dossier RH trouvé" }, { status: 403 });

    const { id } = await params;
    const { action } = await req.json();

    if (action !== "ANNULER") {
      return NextResponse.json({ error: "Action non autorisée" }, { status: 403 });
    }

    const pret = await prisma.pretEmploye.findUnique({ where: { id: Number(id) } });
    if (!pret) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    if (pret.profilRHId !== profilRH.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!["EN_ATTENTE", "VALIDE_MANAGER"].includes(pret.statut)) {
      return NextResponse.json(
        { error: `Impossible d'annuler une demande au statut ${pret.statut}.` },
        { status: 422 },
      );
    }

    const updated = await prisma.pretEmploye.update({
      where: { id: Number(id) },
      data:  { statut: "ANNULE" },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action:   "UPDATE",
        entite:   "PretEmploye",
        entiteId: updated.id,
        details:  { avant: { statut: pret.statut }, apres: { statut: "ANNULE" }, note: "Annulée par le collaborateur" },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/collaborateur/prets/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
