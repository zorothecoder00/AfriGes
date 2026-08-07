import { NextRequest, NextResponse } from "next/server";
import { TypeObjectifChallenge, SegmentClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMarketingSession } from "@/lib/authMarketing";
import { requirePermission } from "@/lib/permissions";
import { auditLog } from "@/lib/notifications";

const TYPES_OBJECTIF: TypeObjectifChallenge[] = ["NB_ACHATS", "MONTANT_ACHATS"];
const SEGMENTS: SegmentClient[] = ["ORDINAIRE", "RIA"];

/**
 * Challenges de gamification (CDC §37) — objectif quantifiable minimal
 * (NB_ACHATS ou MONTANT_ACHATS sur une période).
 * GET  — liste des challenges (avec nb de participants en cours/réussis).
 * POST — crée un challenge.
 */
export async function GET() {
  try {
    const session = await getMarketingSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const denied = await requirePermission(session, "marketing", "LECTURE");
    if (denied) return denied;

    const challenges = await prisma.challengeMarketing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creePar: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { participations: true } },
      },
    });

    const reussiesParChallenge = await prisma.participationChallenge.groupBy({
      by: ["challengeId"], where: { statut: "REUSSI" }, _count: { _all: true },
    });
    const reussiesMap = new Map(reussiesParChallenge.map((r) => [r.challengeId, r._count._all]));

    return NextResponse.json({
      data: challenges.map((c) => ({ ...c, nbReussis: reussiesMap.get(c.id) ?? 0 })),
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/challenges", e);
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
    const { nom, description, typeObjectif, seuil, recompensePoints, dateDebut, dateFin, segment, statut } = body;

    if (!nom || !TYPES_OBJECTIF.includes(typeObjectif)) return NextResponse.json({ error: "Nom et type d'objectif (valide) sont requis" }, { status: 400 });
    const seuilNum = Number(seuil);
    if (!seuilNum || seuilNum <= 0) return NextResponse.json({ error: "Le seuil doit être supérieur à 0" }, { status: 400 });
    const pointsNum = Number(recompensePoints);
    if (!pointsNum || pointsNum <= 0) return NextResponse.json({ error: "La récompense en points doit être supérieure à 0" }, { status: 400 });

    const dDebut = dateDebut ? new Date(dateDebut) : null;
    const dFin = dateFin ? new Date(dateFin) : null;
    if (!dDebut || isNaN(dDebut.getTime())) return NextResponse.json({ error: "Date de début invalide" }, { status: 400 });
    if (!dFin || isNaN(dFin.getTime())) return NextResponse.json({ error: "Date de fin invalide" }, { status: 400 });
    if (dFin < dDebut) return NextResponse.json({ error: "La date de fin doit être postérieure à la date de début" }, { status: 400 });

    const segmentVal = segment && SEGMENTS.includes(segment) ? (segment as SegmentClient) : null;
    const userId = Number(session.user.id);

    const challenge = await prisma.$transaction(async (tx) => {
      const c = await tx.challengeMarketing.create({
        data: {
          nom, description: description || null, typeObjectif: typeObjectif as TypeObjectifChallenge,
          seuil: seuilNum, recompensePoints: pointsNum,
          dateDebut: dDebut, dateFin: dFin,
          statut: statut === "TERMINE" ? "TERMINE" : "ACTIF",
          segment: segmentVal, creeParId: userId,
        },
      });
      await auditLog(tx, userId, "CHALLENGE_CREE", "ChallengeMarketing", c.id);
      return c;
    });

    return NextResponse.json({ data: challenge }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/challenges", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
