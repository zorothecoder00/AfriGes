import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, extraireMetaRequete, alerterSoldeFaible, payerCreditDepuisCC, montantBloqueActif } from "@/lib/compteCourant";
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
  // Épargne bloquée (CDC §19.E) : déduite du solde disponible pour les paiements.
  const bloque = await montantBloqueActif(prisma, compteId);
  if (totalDemande > Number(compte.solde) - bloque) {
    return NextResponse.json(
      { error: bloque > 0
          ? `Solde disponible insuffisant : ${bloque.toLocaleString("fr-FR")} FCFA d'épargne bloquée.`
          : "Solde du compte courant insuffisant pour la totalité des paiements" },
      { status: 422 },
    );
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

        // Paiement d'un crédit via le CC (remboursement + débit + écriture) — helper mutualisé.
        const paye = await payerCreditDepuisCC(tx, {
          compteId, numeroCompte: compte.numeroCompte, codeAgence: compte.codeAgence, clientNom,
          creditId: it.creditId, creditRef: ref, montant: it.montant, userId, param,
          observation: observationLibre, ip, userAgent,
        });
        if (!paye.ecritureGeneree) ecritureManquante = true;
        if (paye.montantApplique <= 0) {
          results.push({ creditId: it.creditId, reference: ref, montantApplique: 0, estSolde: paye.estSolde, mouvement: null });
          continue;
        }
        totalApplique += paye.montantApplique;
        soldeApres = paye.soldeApres ?? soldeApres;
        results.push({ creditId: it.creditId, reference: ref, montantApplique: paye.montantApplique, estSolde: paye.estSolde, mouvement: paye.mouvement });
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
