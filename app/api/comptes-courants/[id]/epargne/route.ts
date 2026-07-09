import { NextResponse } from "next/server";
import { PrioriteNotification, FrequenceEpargne } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";
import { calculerProgression, type PlanBase } from "@/lib/epargneProgrammee";

type Ctx = { params: Promise<{ id: string }> };

const FREQUENCES = ["QUOTIDIENNE", "HEBDOMADAIRE", "MENSUELLE"] as const;

const planSelect = {
  id: true, libelle: true, objectifMontant: true, frequence: true, montantCotisation: true,
  dateDebut: true, dateEcheance: true, montantCumule: true, statut: true, dateAtteint: true,
  observation: true, createdAt: true,
  creePar: { select: { nom: true, prenom: true } },
  _count: { select: { cotisations: true } },
};

/**
 * Plans d'épargne programmée d'un compte (CDC §19.B).
 * GET  — liste des plans + progression calculée — capacité READ
 * POST — crée un plan (objectif + cotisation + échéance) — capacité CREATE
 */

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const plans = await prisma.planEpargne.findMany({
    where: { compteId },
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
    select: planSelect,
  });

  const data = plans.map((p) => ({
    ...p,
    objectifMontant: Number(p.objectifMontant),
    montantCotisation: Number(p.montantCotisation),
    montantCumule: Number(p.montantCumule),
    progression: calculerProgression(p as unknown as PlanBase),
  }));

  return NextResponse.json({ data });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { id: true, numeroCompte: true, statut: true, libelle: true, client: { select: { prenom: true, nom: true } } },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : création de plan impossible` }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const libelle = typeof body?.libelle === "string" && body.libelle.trim() ? body.libelle.trim() : null;
  const objectifMontant = Number(body?.objectifMontant);
  const montantCotisation = Number(body?.montantCotisation);
  const frequence: FrequenceEpargne | null = FREQUENCES.includes(body?.frequence) ? body.frequence : null;
  const observation = typeof body?.observation === "string" && body.observation.trim() ? body.observation.trim() : null;

  if (!libelle) return NextResponse.json({ error: "Intitulé de l'objectif requis" }, { status: 400 });
  if (!objectifMontant || isNaN(objectifMontant) || objectifMontant <= 0) {
    return NextResponse.json({ error: "Montant objectif invalide" }, { status: 400 });
  }
  if (!montantCotisation || isNaN(montantCotisation) || montantCotisation <= 0) {
    return NextResponse.json({ error: "Montant de cotisation invalide" }, { status: 400 });
  }
  if (montantCotisation > objectifMontant) {
    return NextResponse.json({ error: "La cotisation ne peut pas dépasser l'objectif" }, { status: 400 });
  }
  if (!frequence) return NextResponse.json({ error: "Fréquence invalide (QUOTIDIENNE, HEBDOMADAIRE ou MENSUELLE)" }, { status: 400 });

  const now = new Date();
  const dateDebut = body?.dateDebut ? new Date(body.dateDebut) : now;
  const dateEcheance = body?.dateEcheance ? new Date(body.dateEcheance) : null;
  if (!dateEcheance || isNaN(dateEcheance.getTime())) {
    return NextResponse.json({ error: "Date d'échéance requise" }, { status: 400 });
  }
  if (isNaN(dateDebut.getTime())) {
    return NextResponse.json({ error: "Date de début invalide" }, { status: 400 });
  }
  if (dateEcheance <= dateDebut) {
    return NextResponse.json({ error: "L'échéance doit être postérieure au début" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.planEpargne.create({
      data: {
        compteId, libelle, objectifMontant, montantCotisation, frequence,
        dateDebut, dateEcheance, observation, creeParId: userId,
      },
      select: planSelect,
    });
    await auditLog(tx, userId, "CREATION_PLAN_EPARGNE", "PlanEpargne", created.id, { objectifMontant, frequence }, { ip, userAgent });
    await notifyAdmins(tx, {
      titre: "Nouveau plan d'épargne",
      message: `Plan « ${libelle} » (objectif ${objectifMontant.toLocaleString("fr-FR")} FCFA) créé sur le compte ${compte.libelle ?? compte.numeroCompte}.`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
    });
    return created;
  });

  return NextResponse.json({
    data: { ...plan, progression: calculerProgression(plan as unknown as PlanBase) },
  }, { status: 201 });
}
