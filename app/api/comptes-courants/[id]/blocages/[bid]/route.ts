import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; bid: string }> };

/**
 * PATCH /api/comptes-courants/[id]/blocages/[bid] — capacité CREATE
 * action: "LIBERER" (déblocage anticipé) | "ANNULER" (blocage créé par erreur).
 * Dans les deux cas les fonds redeviennent disponibles ; seul un blocage ACTIF
 * peut être modifié.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("CREATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, bid } = await params;
  const compteId = Number(id);
  const blocageId = Number(bid);
  if (!compteId || !blocageId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const blocage = await prisma.blocageEpargne.findFirst({
    where: { id: blocageId, compteId },
    select: { id: true, statut: true, montant: true, compte: { select: { numeroCompte: true, libelle: true } } },
  });
  if (!blocage) return NextResponse.json({ error: "Blocage introuvable" }, { status: 404 });
  if (blocage.statut !== "ACTIF") {
    return NextResponse.json({ error: "Ce blocage n'est plus actif" }, { status: 422 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action === "ANNULER" ? "ANNULER" : body?.action === "LIBERER" ? "LIBERER" : null;
  if (!action) return NextResponse.json({ error: "Action invalide (LIBERER ou ANNULER)" }, { status: 400 });

  const userId = Number(session.user.id);
  const { ip, userAgent } = extraireMetaRequete(req);
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.blocageEpargne.update({
      where: { id: blocageId },
      data: action === "ANNULER" ? { statut: "ANNULE", libereLe: now } : { statut: "LIBERE", libereLe: now },
      select: {
        id: true, montant: true, motif: true, dateBlocage: true, dateDeblocage: true,
        statut: true, libereLe: true, createdAt: true,
        creePar: { select: { nom: true, prenom: true } },
      },
    });
    await auditLog(tx, userId, action === "ANNULER" ? "ANNULATION_BLOCAGE_EPARGNE" : "DEBLOCAGE_ANTICIPE_EPARGNE",
      "CompteCourant", compteId, { montant: Number(blocage.montant) }, { ip, userAgent });
    await notifyAdmins(tx, {
      titre: action === "ANNULER" ? "Blocage d'épargne annulé" : "Déblocage anticipé d'épargne",
      message: `${Number(blocage.montant).toLocaleString("fr-FR")} FCFA ${action === "ANNULER" ? "débloqués (annulation)" : "débloqués par anticipation"} sur le compte ${blocage.compte.libelle ?? blocage.compte.numeroCompte}.`,
      priorite: PrioriteNotification.NORMAL,
      actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
    });
    return u;
  });

  return NextResponse.json({ data: { ...updated, montant: Number(updated.montant) } });
}
