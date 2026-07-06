import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, genererReferenceMouvementCC, creerEcritureCC } from "@/lib/compteCourant";
import { notifyAdmins, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/comptes-courants/[id]/depots
 * Enregistre un dépôt (CDC §5) : maj du solde + écriture comptable automatique
 * (Débit Caisse / Crédit Compte courant client) + notification + audit.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("DEPOSIT");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const montant = Number(body?.montant);
  const modePaiement = typeof body?.modePaiement === "string" && body.modePaiement.trim() ? body.modePaiement.trim() : null;
  const observation  = typeof body?.observation === "string" && body.observation.trim() ? body.observation.trim() : null;
  const refExterne   = typeof body?.reference === "string" && body.reference.trim() ? body.reference.trim() : null;

  if (!montant || isNaN(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  // Observation finale = observation libre + éventuelle référence externe.
  const observationFinale =
    [observation, refExterne ? `Réf: ${refExterne}` : null].filter(Boolean).join(" · ") || null;

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  // Blocage automatique (CDC §10) : seul un compte ACTIF peut recevoir un dépôt.
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : dépôt impossible` }, { status: 422 });
  }

  const param = await chargerParametrageCC();
  if (montant < Number(param.depotMin)) {
    return NextResponse.json({ error: `Dépôt minimum : ${Number(param.depotMin)} FCFA` }, { status: 422 });
  }
  if (param.depotMax != null && montant > Number(param.depotMax)) {
    return NextResponse.json({ error: `Dépôt maximum : ${Number(param.depotMax)} FCFA` }, { status: 422 });
  }
  const soldeAvant = Number(compte.solde);
  if (param.soldeMaxAutorise != null && soldeAvant + montant > Number(param.soldeMaxAutorise)) {
    return NextResponse.json({ error: `Solde maximum autorisé dépassé (${Number(param.soldeMaxAutorise)} FCFA)` }, { status: 422 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const userId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Relecture du solde dans la transaction (cohérence).
      const courant = await tx.compteCourant.findUnique({ where: { id: compteId }, select: { solde: true } });
      const avant = Number(courant?.solde ?? 0);
      const apres = avant + montant;

      // Écriture comptable : Débit Caisse / Crédit Compte courant client.
      const ecritureId = await creerEcritureCC(tx, {
        journal: "CAISSE",
        date: new Date(),
        libelle: `Dépôt compte courant ${compte.numeroCompte} — ${clientNom}`,
        userId,
        lignes: [
          { numero: param.compteCaisseNumero,        debit:  montant, libelle: "Encaissement dépôt CC" },
          { numero: param.compteCourantClientNumero, credit: montant, libelle: `Dépôt ${compte.numeroCompte}` },
        ],
      });

      const reference = await genererReferenceMouvementCC(tx, "DEP");
      const mouvement = await tx.mouvementCompteCourant.create({
        data: {
          reference, compteId, nature: "DEPOT",
          montant, soldeAvant: avant, soldeApres: apres,
          modePaiement, observation: observationFinale,
          statut: "VALIDE", userId, agence: compte.codeAgence, ecritureId, ip,
        },
        select: { id: true, reference: true, createdAt: true },
      });

      await tx.compteCourant.update({
        where: { id: compteId },
        data: {
          solde: apres,
          totalDepose: { increment: montant },
          nbMouvements: { increment: 1 },
          derniereOperationAt: new Date(),
        },
      });

      await auditLog(tx, userId, "DEPOT_COMPTE_COURANT", "CompteCourant", compteId);
      await notifyAdmins(tx, {
        titre: "Dépôt compte courant",
        message: `Dépôt de ${montant.toLocaleString("fr-FR")} FCFA sur le compte ${compte.numeroCompte} (${clientNom}). Nouveau solde : ${apres.toLocaleString("fr-FR")} FCFA.`,
        priorite: PrioriteNotification.NORMAL,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return { mouvement, soldeApres: apres, ecritureGeneree: ecritureId != null };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptes-courants/[id]/depots", e);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement du dépôt" }, { status: 500 });
  }
}
