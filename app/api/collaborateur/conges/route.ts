import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCollaborateurProfilRH } from "@/lib/authCollaborateur";
import { notifyNouvelleDemandeConge } from "@/lib/notificationsRH";
import { TypeConge } from "@prisma/client";

/**
 * Types de congé qu'un collaborateur peut demander lui-même en libre-service.
 * (MATERNITE / PATERNITE / SANS_SOLDE restent à l'initiative du RH.)
 */
const TYPES_SELF_SERVICE: TypeConge[] = [
  "ANNUEL", "MALADIE", "EXCEPTIONNEL", "PERMISSION", "FORMATION",
];

/** Statuts considérés comme « actifs » (bloquent un chevauchement de dates). */
const STATUTS_ACTIFS = ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH", "APPROUVE"] as const;

/**
 * GET /api/collaborateur/conges
 * Retourne, pour le collaborateur connecté :
 *   - ses soldes de congés de l'année courante (enrichis par les politiques)
 *   - l'historique complet de ses demandes
 * Retourne { profilRH: null } si l'utilisateur n'a pas de dossier RH.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const userId   = parseInt(session.user.id);
    const profilRH = await getCollaborateurProfilRH(userId);
    if (!profilRH) return NextResponse.json({ profilRH: null, soldes: [], demandes: [] });

    const annee = new Date().getFullYear();

    const [soldes, demandes, politiques] = await Promise.all([
      prisma.soldeConge.findMany({
        where:   { profilRHId: profilRH.id, annee },
        orderBy: { type: "asc" },
      }),
      prisma.demandeConge.findMany({
        where:   { profilRHId: profilRH.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.politiqueConge.findMany({ where: { actif: true } }),
    ]);

    const soldesParType = Object.fromEntries(soldes.map((s) => [s.type, s]));
    const soldesTotaux = politiques.map((p) => ({
      type:       p.type,
      annee,
      totalDroit: soldesParType[p.type]?.totalDroit ?? p.joursParAn,
      pris:       soldesParType[p.type]?.pris       ?? 0,
      restant:    soldesParType[p.type]?.restant     ?? p.joursParAn,
      reporte:    soldesParType[p.type]?.reporte     ?? 0,
    }));

    return NextResponse.json({
      profilRH: { id: profilRH.id, matricule: profilRH.matricule },
      soldes:   soldesTotaux,
      demandes,
      annee,
    });
  } catch (error) {
    console.error("GET /api/collaborateur/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/collaborateur/conges
 * Le collaborateur soumet lui-même une demande de congé/absence.
 * La demande est créée en statut EN_ATTENTE (entrée du workflow
 * Collaborateur → Manager → RH → Validation finale).
 *
 * Body: { type, dateDebut, dateFin, nbJours, motif? }
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
    const { type, dateDebut, dateFin, nbJours, motif } = body;

    if (!type || !dateDebut || !dateFin || nbJours == null) {
      return NextResponse.json(
        { error: "type, dateDebut, dateFin et nbJours sont obligatoires" },
        { status: 400 },
      );
    }

    if (!TYPES_SELF_SERVICE.includes(type)) {
      return NextResponse.json(
        { error: "Ce type de congé doit être demandé auprès du Responsable RH." },
        { status: 400 },
      );
    }

    const debut = new Date(dateDebut);
    const fin   = new Date(dateFin);
    const jours = Number(nbJours);

    if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) {
      return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
    }
    if (fin < debut) {
      return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }
    if (!(jours > 0)) {
      return NextResponse.json({ error: "Le nombre de jours doit être supérieur à 0." }, { status: 400 });
    }

    // Anti-chevauchement : pas de demande active recouvrant la même période
    const conflit = await prisma.demandeConge.findFirst({
      where: {
        profilRHId: profilRH.id,
        statut:     { in: [...STATUTS_ACTIFS] },
        dateDebut:  { lte: fin },
        dateFin:    { gte: debut },
      },
      select: { id: true, dateDebut: true, dateFin: true },
    });
    if (conflit) {
      return NextResponse.json(
        { error: "Vous avez déjà une demande en cours sur cette période." },
        { status: 409 },
      );
    }

    // Contrôle de solde pour les types plafonnés (joursParAn > 0)
    const politique = await prisma.politiqueConge.findUnique({ where: { type: type as TypeConge } });
    if (politique && politique.joursParAn > 0) {
      const annee = debut.getFullYear();
      const solde = await prisma.soldeConge.findUnique({
        where: { profilRHId_type_annee: { profilRHId: profilRH.id, type: type as TypeConge, annee } },
      });
      const restant = solde?.restant ?? politique.joursParAn;
      if (jours > restant) {
        return NextResponse.json(
          { error: `Solde insuffisant : il vous reste ${restant} jour(s) pour ce type de congé.` },
          { status: 409 },
        );
      }
    }

    const demande = await prisma.$transaction(async (tx) => {
      const d = await tx.demandeConge.create({
        data: {
          profilRHId: profilRH.id,
          type:       type as TypeConge,
          dateDebut:  debut,
          dateFin:    fin,
          nbJours:    jours,
          motif:      motif ?? null,
          statut:     "EN_ATTENTE",
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action:   "CREATE",
          entite:   "DemandeConge",
          entiteId: d.id,
          details:  `Demande ${type} soumise par le collaborateur (${jours}j)`,
        },
      });

      return d;
    });

    // Notification non-bloquante au manager direct + RH
    notifyNouvelleDemandeConge(demande.id).catch(() => {});

    return NextResponse.json({ data: demande }, { status: 201 });
  } catch (error) {
    console.error("POST /api/collaborateur/conges", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
