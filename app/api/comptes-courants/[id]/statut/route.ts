import { NextResponse } from "next/server";
import { PrioriteNotification, StatutCompteCourant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { extraireMetaRequete } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

const LABELS: Record<StatutCompteCourant, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};

// Statuts « à risque » : notification en priorité haute.
const CRITIQUES: StatutCompteCourant[] = ["BLACKLIST", "FRAUDULEUX", "CLOTURE", "DECEDE"];

/**
 * PATCH /api/comptes-courants/[id]/statut
 * Change le statut d'un compte courant (CDC §3) : suspension, clôture, décès,
 * blacklist, fraude, ou réactivation. Motif obligatoire hors réactivation.
 * C'est ce statut qui pilote le blocage automatique des opérations (CDC §10).
 * Capacité VALIDATE (Chef d'agence, Directeur/Responsable économique, Admin).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("VALIDATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const statut = body?.statut as StatutCompteCourant | undefined;
  const motif = typeof body?.motif === "string" ? body.motif.trim() : "";

  if (!statut || !Object.values(StatutCompteCourant).includes(statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  // Motif obligatoire pour tout blocage ; facultatif pour la réactivation.
  if (statut !== "ACTIF" && motif.length < 3) {
    return NextResponse.json({ error: "Un motif est obligatoire pour ce changement de statut" }, { status: 400 });
  }

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  if (compte.statut === statut) {
    return NextResponse.json({ error: `Le compte est déjà « ${LABELS[statut]} »` }, { status: 400 });
  }
  // Clôture impossible tant que le solde n'est pas régularisé.
  if (statut === "CLOTURE" && Number(compte.solde) !== 0) {
    return NextResponse.json(
      { error: `Solde non nul (${Number(compte.solde).toLocaleString("fr-FR")} FCFA) : régularisez le compte avant clôture` },
      { status: 422 },
    );
  }

  const userId = Number(session.user.id);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const { ip, userAgent } = extraireMetaRequete(req);
  const ancienStatut = compte.statut;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.compteCourant.update({
        where: { id: compteId },
        data: { statut, motifBlocage: statut === "ACTIF" ? null : motif },
        select: { id: true, statut: true, motifBlocage: true },
      });

      await auditLog(tx, userId, "CHANGEMENT_STATUT_COMPTE_COURANT", "CompteCourant", compteId,
        { ancienneValeur: ancienStatut, nouvelleValeur: statut, motif: motif || null }, { ip, userAgent });
      await notifyAdmins(tx, {
        titre: `Compte courant — ${LABELS[statut]}`,
        message: `Compte ${compte.numeroCompte} (${clientNom}) passé « ${LABELS[compte.statut]} » → « ${LABELS[statut]} »${motif ? ` · Motif : ${motif}` : ""}.`,
        priorite: CRITIQUES.includes(statut) ? PrioriteNotification.HAUTE : PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return res;
    });

    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error("PATCH /api/comptes-courants/[id]/statut", e);
    return NextResponse.json({ error: "Erreur lors du changement de statut" }, { status: 500 });
  }
}
