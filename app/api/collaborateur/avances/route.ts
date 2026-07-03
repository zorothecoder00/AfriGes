import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";
import { notifyNouvelleDemandeAvancePret } from "@/lib/notificationsRH";

/**
 * GET /api/collaborateur/avances
 * Retourne les demandes d'avance sur salaire du collaborateur connecté.
 * Retourne { profilRH: null } si l'utilisateur n'a pas de dossier RH.
 *
 * POST /api/collaborateur/avances
 * Le collaborateur soumet lui-même une demande d'avance sur salaire.
 * Créée en statut EN_ATTENTE (entrée du workflow Collaborateur → Manager → Direction).
 * Body: { montant, echeancesMois?, motif? }
 */

/** Statuts « actifs » (une demande en cours bloque une nouvelle demande). */
const STATUTS_ACTIFS = ["EN_ATTENTE", "VALIDE_MANAGER", "APPROUVE"] as const;

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ profilRH: null, demandes: [] });

    const demandes = await prisma.avanceSalaire.findMany({
      where:   { profilRHId: profilRH.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      profilRH: { id: profilRH.id, matricule: profilRH.matricule },
      demandes,
    });
  } catch (error) {
    console.error("GET /api/collaborateur/avances", error);
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

    const { montant, echeancesMois, motif } = await req.json();

    const montantNum = Number(montant);
    if (!montantNum || !(montantNum > 0)) {
      return NextResponse.json({ error: "Le montant doit être supérieur à 0." }, { status: 400 });
    }
    const echeances = echeancesMois ? Math.max(1, Number(echeancesMois)) : 1;

    // Anti-doublon : une seule demande active à la fois
    const enCours = await prisma.avanceSalaire.findFirst({
      where:  { profilRHId: profilRH.id, statut: { in: [...STATUTS_ACTIFS] } },
      select: { id: true },
    });
    if (enCours) {
      return NextResponse.json(
        { error: "Vous avez déjà une avance en cours ou en attente de validation." },
        { status: 409 },
      );
    }

    const avance = await prisma.$transaction(async (tx) => {
      const a = await tx.avanceSalaire.create({
        data: {
          profilRHId:     profilRH.id,
          montant:        montantNum,
          motif:          motif ?? null,
          echeancesMois:  echeances,
          montantRestant: montantNum,
          statut:         "EN_ATTENTE",
          demandeParId:   userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action:   "CREATE",
          entite:   "AvanceSalaire",
          entiteId: a.id,
          details:  `Demande d'avance soumise par le collaborateur (${montantNum} FCFA)`,
        },
      });

      return a;
    });

    notifyNouvelleDemandeAvancePret({ kind: "AVANCE", profilRHId: profilRH.id, montant: montantNum }).catch(() => {});

    return NextResponse.json({ data: avance }, { status: 201 });
  } catch (error) {
    console.error("POST /api/collaborateur/avances", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
