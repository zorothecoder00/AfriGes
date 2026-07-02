import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/collaborateur/conges/[id]
 * Seule action autorisée pour le collaborateur : ANNULER sa propre demande,
 * tant qu'elle n'a pas reçu sa décision finale (EN_ATTENTE, VALIDE_MANAGER, VALIDE_RH).
 *
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

    const demande = await prisma.demandeConge.findUnique({ where: { id: Number(id) } });
    if (!demande) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    // On ne peut annuler que ses propres demandes
    if (demande.profilRHId !== profilRH.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const annulables = ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"];
    if (!annulables.includes(demande.statut)) {
      return NextResponse.json(
        { error: `Impossible d'annuler une demande au statut ${demande.statut}.` },
        { status: 422 },
      );
    }

    const updated = await prisma.demandeConge.update({
      where: { id: Number(id) },
      data:  { statut: "ANNULE", dateDecisionFinale: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action:   "UPDATE",
        entite:   "DemandeConge",
        entiteId: updated.id,
        details:  { avant: { statut: demande.statut }, apres: { statut: "ANNULE" }, note: "Annulée par le collaborateur" },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/collaborateur/conges/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
