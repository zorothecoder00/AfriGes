import { NextResponse } from "next/server";
import { MemberStatus, NiveauRisque, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRVCSession } from "@/lib/authRVC";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/rvc/clients/[id]/eligibilite-credit
 * Vérifie si un client est éligible à un nouveau crédit (version RVC, scoped au PDV).
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getRVCSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

    // Résolution du PDV du RVC
    let rvcPdvId: number | null = null;
    if (!isAdmin) {
      const aff = await prisma.gestionnaireAffectation.findFirst({
        where: { userId: parseInt(session.user.id), actif: true },
        select: { pointDeVenteId: true },
      });
      if (!aff) return NextResponse.json({ error: "Aucun point de vente associé" }, { status: 400 });
      rvcPdvId = aff.pointDeVenteId;
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, nom: true, prenom: true, codeClient: true, telephone: true,
        etat: true, niveauRisque: true, limiteCredit: true, soldeActuel: true,
        pointDeVenteId: true,
      },
    });
    if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

    // Vérification scope PDV
    if (rvcPdvId !== null && client.pointDeVenteId !== rvcPdvId) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre point de vente" }, { status: 403 });
    }

    const raisons: string[] = [];
    const alertes: string[] = [];

    // Règle 1 : client doit être ACTIF
    if (client.etat !== MemberStatus.ACTIF) {
      raisons.push(`Ce client est ${client.etat.toLowerCase()} — seuls les clients actifs peuvent recevoir un crédit.`);
    }

    // Règle 2 : solde < limite
    let tauxUtilisation: number | null = null;
    if (client.limiteCredit !== null && client.soldeActuel !== null) {
      tauxUtilisation = Number(client.limiteCredit) > 0
        ? Math.round((Number(client.soldeActuel) / Number(client.limiteCredit)) * 100)
        : 100;
      if (Number(client.soldeActuel) >= Number(client.limiteCredit)) {
        raisons.push(
          `La limite de crédit (${Number(client.limiteCredit).toLocaleString("fr-FR")} FCFA) est atteinte — solde actuel : ${Number(client.soldeActuel).toLocaleString("fr-FR")} FCFA.`
        );
      }
    } else if (client.limiteCredit === null) {
      alertes.push("Aucune limite de crédit configurée — le crédit sera accordé sans plafond.");
    }

    // Règle 3 : CRITIQUE + EN_RETARD
    if (client.niveauRisque === NiveauRisque.CRITIQUE) {
      const enRetard = await prisma.creditClient.findFirst({
        where: { clientId, statut: StatutCredit.EN_RETARD },
        select: { id: true, reference: true, soldeRestant: true },
      });
      if (enRetard) {
        raisons.push(
          `Client en risque CRITIQUE avec un crédit en retard (${enRetard.reference}) — solde : ${Number(enRetard.soldeRestant).toLocaleString("fr-FR")} FCFA.`
        );
      }
    }

    const creditsActifs = await prisma.creditClient.findMany({
      where: { clientId, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD, StatutCredit.EN_ATTENTE_VALIDATION] } },
      select: { id: true, reference: true, statut: true, montantTotal: true, soldeRestant: true },
    });

    return NextResponse.json({
      eligible: raisons.length === 0,
      raisons,
      alertes,
      tauxUtilisation,
      creditsActifs,
      client: {
        limiteCredit: client.limiteCredit,
        soldeActuel:  client.soldeActuel,
      },
    });
  } catch (error) {
    console.error("GET /api/rvc/clients/[id]/eligibilite-credit", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
