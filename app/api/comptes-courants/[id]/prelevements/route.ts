import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const autoSelect = {
  id: true, actif: true, montantMax: true, montantMinSolde: true,
  dernierPrelevementAt: true, totalPreleve: true, nbPrelevements: true, createdAt: true,
  credit: { select: { id: true, reference: true, statut: true, soldeRestant: true, montantTotal: true, montantJournalier: true } },
  creePar: { select: { nom: true, prenom: true } },
};

/**
 * Autorisations de prélèvement automatique d'un compte (CDC §19.C).
 * GET  — liste — capacité READ
 * POST — crée une autorisation pour un crédit en cours — capacité CREATE
 */

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const autorisations = await prisma.autorisationPrelevement.findMany({
    where: { compteId },
    orderBy: [{ actif: "desc" }, { createdAt: "desc" }],
    select: autoSelect,
  });

  return NextResponse.json({
    data: autorisations.map((a) => ({
      ...a,
      montantMax: a.montantMax != null ? Number(a.montantMax) : null,
      montantMinSolde: a.montantMinSolde != null ? Number(a.montantMinSolde) : null,
      totalPreleve: Number(a.totalPreleve),
      credit: { ...a.credit, soldeRestant: Number(a.credit.soldeRestant), montantTotal: Number(a.credit.montantTotal), montantJournalier: Number(a.credit.montantJournalier) },
    })),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const compteId = Number((await params).id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: { id: true, numeroCompte: true, statut: true, clientId: true, libelle: true, client: { select: { prenom: true, nom: true } } },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : autorisation impossible` }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const creditId = Number(body?.creditId);
  if (!creditId) return NextResponse.json({ error: "Crédit requis" }, { status: 400 });

  const parseMontant = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return isNaN(n) || n < 0 ? NaN : n;
  };
  const montantMax = parseMontant(body?.montantMax);
  const montantMinSolde = parseMontant(body?.montantMinSolde);
  if (Number.isNaN(montantMax) || Number.isNaN(montantMinSolde)) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  // Le crédit doit appartenir au titulaire du compte et être en cours.
  const credit = await prisma.creditClient.findFirst({
    where: { id: creditId, clientId: compte.clientId },
    select: { id: true, reference: true, statut: true },
  });
  if (!credit) return NextResponse.json({ error: "Crédit introuvable pour ce client" }, { status: 404 });
  if (!["ACTIF", "EN_RETARD"].includes(credit.statut)) {
    return NextResponse.json({ error: "Seul un crédit en cours peut être prélevé automatiquement" }, { status: 422 });
  }

  const existe = await prisma.autorisationPrelevement.findUnique({ where: { creditId }, select: { id: true } });
  if (existe) return NextResponse.json({ error: "Ce crédit a déjà une autorisation de prélèvement" }, { status: 409 });

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);

  const created = await prisma.$transaction(async (tx) => {
    const a = await tx.autorisationPrelevement.create({
      data: { compteId, creditId, montantMax, montantMinSolde, creeParId: userId },
      select: autoSelect,
    });
    await auditLog(tx, userId, "CREATION_PRELEVEMENT_AUTO", "CompteCourant", compteId, { credit: credit.reference }, { ip, userAgent });
    await notifyAdmins(tx, {
      titre: "Prélèvement automatique activé",
      message: `Prélèvement automatique du crédit ${credit.reference} activé sur le compte ${compte.libelle ?? compte.numeroCompte} (${compte.client.prenom} ${compte.client.nom}).`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
    });
    return a;
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
