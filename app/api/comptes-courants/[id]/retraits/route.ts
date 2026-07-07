import { NextResponse } from "next/server";
import { PrioriteNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompteCourantSession } from "@/lib/authCompteCourant";
import { chargerParametrageCC, genererReferenceMouvementCC, extraireMetaRequete } from "@/lib/compteCourant";
import { notifyRoles, auditLog } from "@/lib/notifications";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET  /api/comptes-courants/[id]/retraits
 * Liste les retraits en attente de validation du compte — capacité READ.
 *
 * POST /api/comptes-courants/[id]/retraits
 * Initie une demande de retrait (CDC §9, Lot 4) : le caissier crée un mouvement
 * RETRAIT au statut EN_ATTENTE. Le débit et l'écriture comptable ne sont produits
 * qu'après validation du Chef d'agence (PATCH …/retraits/[rid]). Capacité DEPOSIT.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("READ");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const retraits = await prisma.mouvementCompteCourant.findMany({
    where: { compteId, nature: "RETRAIT", statut: "EN_ATTENTE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, reference: true, montant: true, soldeAvant: true, soldeApres: true,
      modePaiement: true, observation: true, createdAt: true,
      user: { select: { id: true, nom: true, prenom: true } },
    },
  });
  return NextResponse.json({ data: retraits });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getCompteCourantSession("DEPOSIT");
  if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const compteId = Number(id);
  if (!compteId) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const montant = Number(body?.montant);
  const modePaiement = typeof body?.modePaiement === "string" && body.modePaiement.trim() ? body.modePaiement.trim() : null;
  const motif = typeof body?.motif === "string" && body.motif.trim() ? body.motif.trim() : null;

  if (!montant || isNaN(montant) || montant <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  const compte = await prisma.compteCourant.findUnique({
    where: { id: compteId },
    select: {
      id: true, numeroCompte: true, statut: true, solde: true, codeAgence: true,
      client: { select: { prenom: true, nom: true } },
    },
  });
  if (!compte) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  // Blocage automatique (CDC §10) : compte non ACTIF → aucune opération.
  if (compte.statut !== "ACTIF") {
    return NextResponse.json({ error: `Compte ${compte.statut.toLowerCase()} : retrait impossible` }, { status: 422 });
  }

  // Un seul retrait en attente à la fois (évite la sur-mobilisation du solde).
  const enAttente = await prisma.mouvementCompteCourant.findFirst({
    where: { compteId, nature: "RETRAIT", statut: "EN_ATTENTE" },
    select: { id: true },
  });
  if (enAttente) {
    return NextResponse.json({ error: "Un retrait est déjà en attente de validation sur ce compte" }, { status: 409 });
  }

  const param = await chargerParametrageCC();
  if (param.retraitMin != null && montant < Number(param.retraitMin)) {
    return NextResponse.json({ error: `Retrait minimum : ${Number(param.retraitMin).toLocaleString("fr-FR")} FCFA` }, { status: 422 });
  }
  if (param.retraitMax != null && montant > Number(param.retraitMax)) {
    return NextResponse.json({ error: `Retrait maximum : ${Number(param.retraitMax).toLocaleString("fr-FR")} FCFA` }, { status: 422 });
  }

  const soldeAvant = Number(compte.solde);
  const soldeApres = soldeAvant - montant;
  if (!param.autoriserSoldeNegatif) {
    const soldeMin = Number(param.soldeMinObligatoire);
    if (soldeApres < soldeMin) {
      return NextResponse.json(
        { error: soldeMin > 0
            ? `Solde insuffisant : le solde minimum obligatoire (${soldeMin.toLocaleString("fr-FR")} FCFA) doit être conservé`
            : "Solde insuffisant" },
        { status: 422 },
      );
    }
  }

  // Plafond mensuel du nombre de retraits (retraits validés du mois en cours).
  if (param.nbRetraitsMaxParMois != null) {
    const debutMois = new Date();
    debutMois.setDate(1); debutMois.setHours(0, 0, 0, 0);
    const dejaCeMois = await prisma.mouvementCompteCourant.count({
      where: { compteId, nature: "RETRAIT", statut: "VALIDE", createdAt: { gte: debutMois } },
    });
    if (dejaCeMois >= param.nbRetraitsMaxParMois) {
      return NextResponse.json({ error: `Plafond mensuel atteint : ${param.nbRetraitsMaxParMois} retrait(s) par mois` }, { status: 422 });
    }
  }

  const { ip, userAgent } = extraireMetaRequete(req);
  const clientNom = `${compte.client.prenom} ${compte.client.nom}`;
  const userId = Number(session.user.id);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reference = await genererReferenceMouvementCC(tx, "RET");
      const mouvement = await tx.mouvementCompteCourant.create({
        data: {
          reference, compteId, nature: "RETRAIT",
          montant: -montant, soldeAvant, soldeApres,
          modePaiement, observation: motif,
          statut: "EN_ATTENTE", userId, agence: compte.codeAgence, ip, userAgent,
        },
        select: { id: true, reference: true, createdAt: true },
      });

      await auditLog(tx, userId, "INITIATION_RETRAIT_CC", "CompteCourant", compteId,
        { montant, soldeAvant, soldeApres }, { ip, userAgent });
      await notifyRoles(tx, ["CHEF_AGENCE", "RESPONSABLE_ECONOMIQUE"], {
        titre: "Retrait à valider",
        message: `Demande de retrait de ${montant.toLocaleString("fr-FR")} FCFA sur le compte ${compte.numeroCompte} (${clientNom}) — validation requise.`,
        priorite: PrioriteNotification.HAUTE,
        actionUrl: `/dashboard/admin/comptes-courants/${compteId}`,
      });

      return { mouvement, montant, soldeApres };
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (e) {
    console.error("POST /api/comptes-courants/[id]/retraits", e);
    return NextResponse.json({ error: "Erreur lors de l'initiation du retrait" }, { status: 500 });
  }
}
