import { NextResponse } from "next/server";
import { PrioriteNotification, TypePaiement } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, genererReferenceMouvementCC, creerEcritureCC, extraireMetaRequete, alerterSoldeFaible } from "@/lib/compteCourant";
import { enregistrerRemboursementCredit } from "@/lib/remboursementCredit";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptes-courants/[id]/paiements
 * Paie UN OU PLUSIEURS crédits du client en tirant sur le solde du compte courant
 * (CDC §8), en une seule transaction. Réutilise enregistrerRemboursementCredit
 * (échéances, solde, cascade RIA), débite le compte courant (un mouvement
 * PAIEMENT_CREDIT par crédit) et génère l'écriture Débit CC / Crédit Vente (§15).
 *
 * body = { paiements: [{ creditId, montant }], observation? }
 *   (rétro-compat : { creditId, montant } mono-crédit est aussi accepté)
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("DEPOSIT");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const observationLibre = typeof body?.observation === "string" && body.observation.trim() ? body.observation.trim() : null;

  // Normalise en liste de paiements (rétro-compat mono-crédit), dédoublonne, filtre.
  const rawList: unknown[] = Array.isArray(body?.paiements)
    ? body.paiements
    : (body?.creditId != null ? [{ creditId: body.creditId, montant: body.montant }] : []);
  const items: { creditId: number; montant: number }[] = [];
  const seen = new Set<number>();
  for (const p of rawList) {
    const cid = Number((p as { creditId?: unknown })?.creditId);
    const m = Number((p as { montant?: unknown })?.montant);
    if (!cid || seen.has(cid) || !m || isNaN(m) || m <= 0) continue;
    seen.add(cid);
    items.push({ creditId: cid, montant: m });
  }
  if (!items.length) return NextResponse.json({ error: "Aucun paiement valide" }, { status: 400 });
  const totalDemande = items.reduce((s, i) => s + i.montant, 0);

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
  if (totalDemande > Number(compte.solde)) {
    return NextResponse.json({ error: "Solde du compte courant insuffisant pour la totalité des paiements" }, { status: 422 });
  }

  // Tous les crédits doivent appartenir au client du compte.
  const credits = await prisma.creditClient.findMany({
    where: { id: { in: items.map((i) => i.creditId) }, clientId: compte.clientId },
    select: { id: true, reference: true },
  });
  if (credits.length !== items.length) {
    return NextResponse.json({ error: "Un ou plusieurs crédits sont introuvables pour ce client" }, { status: 404 });
  }
  const refById = new Map(credits.map((c) => [c.id, c.reference]));

  const param = await chargerParametrageCC();
  const userId = Number(session.user.id);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const { ip, userAgent } = extraireMetaRequete(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const results: { creditId: number; reference: string; montantApplique: number; estSolde: boolean; mouvement: { id: number; reference: string } | null }[] = [];
      let totalApplique = 0;
      let soldeApres = Number(compte.solde);
      let ecritureManquante = false;

      for (const it of items) {
        const ref = refById.get(it.creditId)!;

        // 1) Applique le remboursement au crédit (montant capé au solde restant).
        const remb = await enregistrerRemboursementCredit(tx, {
          creditId: it.creditId,
          montant: it.montant,
          numeroJour: null,
          observation: `Paiement depuis compte courant ${compte.numeroCompte}${observationLibre ? ` — ${observationLibre}` : ""}`,
          modePaiement: TypePaiement.WALLET_GENERAL,
          enregistreParId: userId,
          agentCollecteurId: userId,
          confirmer: true,
        });
        if (!remb.ok) throw new Error(remb.error);
        const applique = remb.montantEffectif;
        if (applique <= 0) {
          results.push({ creditId: it.creditId, reference: ref, montantApplique: 0, estSolde: remb.estSolde, mouvement: null });
          continue;
        }

        // 2) Débite le compte courant du montant réellement imputé.
        const courant = await tx.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
        const avant = Number(courant?.solde ?? 0);
        if (applique > avant) throw new Error("Solde du compte courant insuffisant");
        const apres = avant - applique;

        const ecritureId = await creerEcritureCC(tx, {
          journal: "OD",
          date: new Date(),
          libelle: `Paiement crédit ${ref} via compte courant ${compte.numeroCompte} — ${clientNom}`,
          userId,
          lignes: [
            { numero: param.compteCourantClientNumero, debit:  applique, libelle: `Utilisation CC ${compte.numeroCompte}` },
            { numero: param.compteVentesNumero,        credit: applique, libelle: `Règlement crédit ${ref}` },
          ],
        });
        if (ecritureId == null) ecritureManquante = true;

        const reference = await genererReferenceMouvementCC(tx, "PAY");
        const mouvement = await tx.mouvementCompteCourant.create({
          data: {
            reference, compteId, nature: "PAIEMENT_CREDIT",
            montant: -applique, soldeAvant: avant, soldeApres: apres,
            observation: `Crédit ${ref}${observationLibre ? ` · ${observationLibre}` : ""}`,
            statut: "VALIDE", userId, agence: compte.codeAgence, ecritureId, creditId: it.creditId, ip, userAgent,
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

        totalApplique += applique;
        soldeApres = apres;
        results.push({ creditId: it.creditId, reference: ref, montantApplique: applique, estSolde: remb.estSolde, mouvement });
      }

      if (totalApplique <= 0) throw new Error("Aucun montant appliqué (crédits déjà soldés)");

      // Alerte préventive « faible solde » (CDC §14).
      await alerterSoldeFaible(tx, {
        compteId, numeroCompte: compte.numeroCompte, clientNom,
        soldeApres, seuil: Number(param.soldeMinObligatoire),
      });

      const nbPayes = results.filter((r) => r.montantApplique > 0).length;
      await auditLog(tx, userId, "PAIEMENT_CREDIT_VIA_CC", "CompteCourant", compteId,
        { paiements: results.filter((r) => r.montantApplique > 0).map((r) => ({ credit: r.reference, montant: r.montantApplique })), totalApplique, soldeApres }, { ip, userAgent });
      await notifyAdmins(tx, {
        titre: "Paiement crédit via compte courant",
        message: `${totalApplique.toLocaleString("fr-FR")} FCFA prélevés du compte ${compte.numeroCompte} (${clientNom}) pour ${nbPayes} crédit(s). Nouveau solde CC : ${soldeApres.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return { results, totalApplique, soldeApres, count: nbPayes, ecritureGeneree: !ecritureManquante };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptes-courants/[id]/paiements", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur lors du paiement" }, { status: 500 });
  }
}
