import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, creerEcritureCC } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string; rid: string }> };

/**
 * PATCH /api/comptes-courants/[id]/retraits/[rid]
 * Valide ou rejette un retrait en attente (CDC §9, Lot 4) — capacité VALIDATE.
 *
 * body = { action: "VALIDER", password }  → ré-authentification du valideur, débit
 *   du compte + écriture comptable Débit Compte courant / Crédit Caisse, statut VALIDE.
 * body = { action: "REJETER", motif }     → statut ANNULE, aucun mouvement de fonds.
 *
 * Séparation des tâches : le valideur doit être différent de l'initiateur
 * (les ADMIN/SUPER_ADMIN peuvent déroger). OTP/biométrie/QR = phase 2.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("VALIDATE");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id, rid } = await params;
  const compteId = Number(id);
  const retraitId = Number(rid);
  if (!compteId || !retraitId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "VALIDER" || body?.action === "REJETER" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Action invalide" }, { status: 400 });

  const retrait = await prisma.mouvementCompteCourant.findFirst({
    where: { id: retraitId, compteId, nature: "RETRAIT" },
    select: {
      id: true, reference: true, montant: true, statut: true, userId: true, observation: true,
      compte: {
        select: {
          id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true,
          client: { select: { prenom: true, nom: true } },
        },
      },
    },
  });
  if (!retrait) return NextResponse.json({ error: "Retrait introuvable" }, { status: 404 });
  if (retrait.statut !== "EN_ATTENTE") {
    return NextResponse.json({ error: "Ce retrait a déjà été traité" }, { status: 409 });
  }

  const userId = Number(session.user.id);
  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const compte = retrait.compte;
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const montant = Math.abs(Number(retrait.montant));

  // Séparation des tâches : l'initiateur ne peut pas valider son propre retrait.
  if (!isAdmin && retrait.userId === userId) {
    return NextResponse.json({ error: "Séparation des tâches : le valideur doit être différent de l'initiateur" }, { status: 403 });
  }

  // ── Rejet ──────────────────────────────────────────────────────────────────
  if (action === "REJETER") {
    const motif = typeof body?.motif === "string" && body.motif.trim() ? body.motif.trim() : null;
    if (!motif) return NextResponse.json({ error: "Motif de rejet obligatoire" }, { status: 400 });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.mouvementCompteCourant.update({
          where: { id: retraitId },
          data: {
            statut: "ANNULE",
            observation: [retrait.observation, `Rejeté : ${motif}`].filter(Boolean).join(" · "),
          },
        });
        await auditLog(tx, userId, "REJET_RETRAIT_CC", "CompteCourant", compteId, { retraitId, motif });
        await notifyAdmins(tx, {
          titre: "Retrait rejeté",
          message: `Retrait de ${montant.toLocaleString("fr-FR")} FCFA sur le compte ${compte.numeroCompte} (${clientNom}) rejeté. Motif : ${motif}.`,
          priorite: PrioriteNotification.NORMAL,
          actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
        });
      });
      return NextResponse.json({ data: { statut: "ANNULE" } });
    } catch (e) {
      console.error("PATCH retrait REJETER", e);
      return NextResponse.json({ error: "Erreur lors du rejet" }, { status: 500 });
    }
  }

  // ── Validation : ré-authentification du valideur ────────────────────────────
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 });

  const valideur = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!valideur?.passwordHash || !(await bcrypt.compare(password, valideur.passwordHash))) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  // Le compte doit toujours être ACTIF au moment de la validation (CDC §10).
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : validation impossible` }, { status: 422 });
  }

  const param = await chargerParametrageCC();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-vérifie le solde en temps réel (il a pu changer depuis l'initiation).
      const courant = await tx.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
      const avant = Number(courant?.solde ?? 0);
      const apres = avant - montant;
      if (!param.autoriserSoldeNegatif && apres < Number(param.soldeMinObligatoire)) {
        throw new Error("SOLDE_INSUFFISANT");
      }

      // Écriture comptable : Débit Compte courant client / Crédit Caisse.
      const ecritureId = await creerEcritureCC(tx, {
        journal: "CAISSE",
        date: new Date(),
        libelle: `Retrait compte courant ${compte.numeroCompte} — ${clientNom}`,
        userId,
        lignes: [
          { numero: param.compteCourantClientNumero, debit:  montant, libelle: `Retrait ${compte.numeroCompte}` },
          { numero: param.compteCaisseNumero,        credit: montant, libelle: "Décaissement retrait CC" },
        ],
      });

      const mouvement = await tx.mouvementCompteCourant.update({
        where: { id: retraitId },
        data: {
          statut: "VALIDE", soldeAvant: avant, soldeApres: apres, ecritureId,
          observation: [retrait.observation, `Validé par ${session.user.name ?? "responsable"}`].filter(Boolean).join(" · "),
        },
        select: { id: true, reference: true },
      });

      await tx.compteCourant.update({
        where: { id: compteId },
        data: {
          solde: apres,
          totalRetire: { increment: montant },
          nbMouvements: { increment: 1 },
          derniereOperationAt: new Date(),
        },
      });

      await auditLog(tx, userId, "VALIDATION_RETRAIT_CC", "CompteCourant", compteId, { retraitId, montant, ip });
      await notifyAdmins(tx, {
        titre: "Retrait validé",
        message: `Retrait de ${montant.toLocaleString("fr-FR")} FCFA validé sur le compte ${compte.numeroCompte} (${clientNom}). Nouveau solde : ${apres.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return { mouvement, montant, soldeApres: apres, ecritureGeneree: ecritureId != null };
    });

    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof Error && e.message === "SOLDE_INSUFFISANT") {
      return NextResponse.json({ error: "Solde du compte insuffisant au moment de la validation" }, { status: 422 });
    }
    console.error("PATCH retrait VALIDER", e);
    return NextResponse.json({ error: "Erreur lors de la validation du retrait" }, { status: 500 });
  }
}
