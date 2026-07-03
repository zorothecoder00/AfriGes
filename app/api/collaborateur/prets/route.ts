import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";
import { notifyNouvelleDemandeAvancePret } from "@/lib/notificationsRH";

/**
 * GET /api/collaborateur/prets
 * Retourne les demandes/prêts du collaborateur connecté.
 * Retourne { profilRH: null } si l'utilisateur n'a pas de dossier RH.
 *
 * POST /api/collaborateur/prets
 * Le collaborateur soumet lui-même une demande de prêt.
 * Créée en statut EN_ATTENTE (workflow Collaborateur → Manager → Direction).
 * Le taux d'intérêt et l'échéancier définitifs sont fixés par la Direction à
 * l'approbation ; ici on n'enregistre que le montant, la durée souhaitée et le motif.
 * Body: { montant, dureesMois, motif? }
 */

/** Statuts « actifs » (bloquent une nouvelle demande). */
const STATUTS_ACTIFS = ["EN_ATTENTE", "VALIDE_MANAGER", "EN_COURS"] as const;

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ profilRH: null, demandes: [] });

    const demandes = await prisma.pretEmploye.findMany({
      where:   { profilRHId: profilRH.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      profilRH: { id: profilRH.id, matricule: profilRH.matricule },
      demandes,
    });
  } catch (error) {
    console.error("GET /api/collaborateur/prets", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) {
      return NextResponse.json(
        { error: "Aucun dossier RH trouvé pour votre compte. Contactez le Responsable RH." },
        { status: 403 },
      );
    }

    const { montant, dureesMois, motif } = await req.json();

    const montantNum = Number(montant);
    const duree      = Number(dureesMois);
    if (!montantNum || !(montantNum > 0)) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0." }, { status: 400 });
    }
    if (!duree || !(duree > 0)) {
      return NextResponse.json({ error: "La durée (en mois) doit être supérieure à 0." }, { status: 400 });
    }

    const enCours = await prisma.pretEmploye.findFirst({
      where:  { profilRHId: profilRH.id, statut: { in: [...STATUTS_ACTIFS] } },
      select: { id: true },
    });
    if (enCours) {
      return NextResponse.json(
        { error: "Vous avez déjà un prêt en cours ou une demande en attente de validation." },
        { status: 409 },
      );
    }

    // Mensualité indicative (sans intérêt) — recalculée par la Direction à l'approbation.
    const mensualite = Math.ceil(montantNum / duree);

    const pret = await prisma.$transaction(async (tx) => {
      const p = await tx.pretEmploye.create({
        data: {
          profilRHId:     profilRH.id,
          montant:        montantNum,
          tauxInteret:    0,
          dureesMois:     duree,
          montantMensuel: mensualite,
          montantRestant: montantNum,
          motif:          motif ?? null,
          statut:         "EN_ATTENTE",
          demandeParId:   userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action:   "CREATE",
          entite:   "PretEmploye",
          entiteId: p.id,
          details:  `Demande de prêt soumise par le collaborateur (${montantNum} FCFA sur ${duree} mois)`,
        },
      });

      return p;
    });

    notifyNouvelleDemandeAvancePret({ kind: "PRET", profilRHId: profilRH.id, montant: montantNum }).catch(() => {});

    return NextResponse.json({ data: pret }, { status: 201 });
  } catch (error) {
    console.error("POST /api/collaborateur/prets", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
