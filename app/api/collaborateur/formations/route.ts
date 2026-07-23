import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";
import { notifyNouvelleDemandeFormation } from "@/lib/notificationsRH";

/**
 * GET /api/collaborateur/formations
 * Retourne, pour le collaborateur connecté, l'historique de ses demandes de formation
 * ainsi que les sessions de formation à venir (pour choisir une session existante).
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ profilRH: null, demandes: [], sessionsDisponibles: [] });

    const [demandes, sessionsDisponibles] = await Promise.all([
      prisma.demandeFormation.findMany({
        where:   { profilRHId: profilRH.id },
        orderBy: { createdAt: "desc" },
        include: { formation: { select: { id: true, titre: true, dateDebut: true } } },
      }),
      prisma.formation.findMany({
        where:   { statut: "PLANIFIEE", dateDebut: { gte: new Date() } },
        orderBy: { dateDebut: "asc" },
        select:  { id: true, titre: true, dateDebut: true, lieu: true },
      }),
    ]);

    return NextResponse.json({
      profilRH: { id: profilRH.id, matricule: profilRH.matricule },
      demandes,
      sessionsDisponibles,
    });
  } catch (error) {
    console.error("GET /api/collaborateur/formations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/collaborateur/formations
 * Le collaborateur soumet lui-même une demande de formation.
 * Body: { intituleSouhaite, formationId?, motif? }
 */
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

    const body = await req.json();
    const { intituleSouhaite, formationId, motif } = body;

    if (!intituleSouhaite || !String(intituleSouhaite).trim()) {
      return NextResponse.json({ error: "intituleSouhaite est obligatoire" }, { status: 400 });
    }

    if (formationId) {
      const formation = await prisma.formation.findUnique({ where: { id: Number(formationId) } });
      if (!formation) return NextResponse.json({ error: "Session de formation introuvable" }, { status: 404 });
    }

    const demande = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeFormation.create({
        data: {
          profilRHId:       profilRH.id,
          intituleSouhaite: String(intituleSouhaite).trim(),
          formationId:      formationId ? Number(formationId) : null,
          motif:            motif ?? null,
          statut:           "EN_ATTENTE",
        },
      });

      await tx.auditLog.create({
        data: {
          userId, action: "CREATE", entite: "DemandeFormation", entiteId: d.id,
          details: `Demande de formation « ${d.intituleSouhaite} » soumise par le collaborateur`,
        },
      });

      return d;
    });

    notifyNouvelleDemandeFormation(demande.id).catch(() => {});

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /api/collaborateur/formations", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
