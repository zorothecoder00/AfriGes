import { NextResponse } from "next/server";
import { PrioriteNotification, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, genererReferenceMouvementCC, creerEcritureCC, extraireMetaRequete } from "@/lib/compteCourant";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptes-courants/[id]/paiements
 * Paie un crédit du client en tirant sur le solde du compte courant (CDC §8).
 * Réutilise enregistrerRemboursementCredit (échéances, solde, cascade RIA),
 * débite le compte courant (mouvement PAIEMENT_CREDIT) et génère l'écriture
 * comptable Débit Compte courant / Crédit Vente (CDC §15).
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("DEPOSIT");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const creditId = Number(body?.creditId);
  const montant  = Number(body?.montant);
  const observationLibre = typeof body?.observation === "string" && body.observation.trim() ? body.observation.trim() : null;

  if (!creditId) return NextResponse.json({ error: "Crédit requis" }, { status: 400 });
  if (!montant || isNaN(montant) || montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true, clientId: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : opération impossible` }, { status: 422 });
  }
  if (montant > Number(compte.solde)) {
    return NextResponse.json({ error: "Solde du compte courant insuffisant" }, { status: 422 });
  }

  const credit = await prisma.creditClient.findUnique({
    where: { id: creditId },
    select: { id: true, reference: true, clientId: true, statut: true },
  });
  if (!credit || credit.clientId !== compte.clientId) {
    return NextResponse.json({ error: "Crédit introuvable pour ce client" }, { status: 404 });
  }

  const param = await chargerParametrageCC();
  const userId = Number(session.user.id);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const { ip, userAgent } = extraireMetaRequete(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Applique le remboursement au crédit (montant capé au solde restant).
      const remb = await enregistrerRemboursementCredit(tx, {
        creditId,
        montant,
        numeroJour: null,
        observation: `Paiement depuis compte courant ${compte.numeroCompte}${observationLibre ? ` — ${observationLibre}` : ""}`,
        modePaiement: TypePaiement.WALLET_GENERAL,
        enregistreParId: userId,
        agentCollecteurId: userId,
        confirmer: true,
      });
      if (!remb.ok) throw new Error(remb.error);
      const applique = remb.montantEffectif;
      if (applique <= 0) throw new Error("Ce crédit est déjà soldé");

      // 2) Débite le compte courant du montant réellement imputé.
      const courant = await tx.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
      const avant = Number(courant?.solde ?? 0);
      if (applique > avant) throw new Error("Solde du compte courant insuffisant");
      const apres = avant - applique;

      const ecritureId = await creerEcritureCC(tx, {
        journal: "OD",
        date: new Date(),
        libelle: `Paiement crédit ${credit.reference} via compte courant ${compte.numeroCompte} — ${clientNom}`,
        userId,
        lignes: [
          { numero: param.compteCourantClientNumero, debit:  applique, libelle: `Utilisation CC ${compte.numeroCompte}` },
          { numero: param.compteVentesNumero,        credit: applique, libelle: `Règlement crédit ${credit.reference}` },
        ],
      });

      const reference = await genererReferenceMouvementCC(tx, "PAY");
      const mouvement = await tx.mouvementCompteCourant.create({
        data: {
          reference, compteId, nature: "PAIEMENT_CREDIT",
          montant: -applique, soldeAvant: avant, soldeApres: apres,
          observation: `Crédit ${credit.reference}${observationLibre ? ` · ${observationLibre}` : ""}`,
          statut: "VALIDE", userId, agence: compte.codeAgence, ecritureId, creditId, ip, userAgent,
        },
        select: { id: true, reference: true },
      });

      await tx.compteCourant.update({
        where: { id: compteId },
        data: {
          solde: apres,
          totalUtilise: { increment: applique },
          nbMouvements: { increment: 1 },
          derniereOperationAt: new Date(),
        },
      });

      await auditLog(tx, userId, "PAIEMENT_CREDIT_VIA_CC", "CompteCourant", compteId,
        { creditId, credit: credit.reference, montant: applique, soldeAvant: avant, soldeApres: apres }, { ip, userAgent });
      await notifyAdmins(tx, {
        titre: "Paiement crédit via compte courant",
        message: `${applique.toLocaleString("fr-FR")} FCFA prélevés du compte ${compte.numeroCompte} (${clientNom}) pour le crédit ${credit.reference}. Nouveau solde CC : ${apres.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return { mouvement, montantApplique: applique, soldeApres: apres, estSolde: remb.estSolde, ecritureGeneree: ecritureId != null };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptes-courants/[id]/paiements", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur lors du paiement" }, { status: 500 });
  }
}
