import { NextResponse } from "next/server";
import { MemberStatus, NiveauRisque, StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";

type Ctx = { params: Promise<{ id: string }> };

/**
 * ==========================
 * GET /api/admin/clients/[id]/eligibilite-credit
 * ==========================
 * Vérifie si un client est éligible à un nouveau crédit.
 *
 * Règles de blocage :
 *  1. client.etat !== ACTIF
 *  2. client.soldeActuel >= client.limiteCredit (si limiteCredit définie)
 *  3. client.niveauRisque === CRITIQUE && au moins 1 crédit EN_RETARD
 *
 * Retourne :
 *  { eligible: boolean, raisons: string[], client: {...}, creditEnCours?: {...} }
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const clientId = Number(id);
    if (isNaN(clientId)) return NextResponse.json({ message: "ID invalide" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true, nom: true, prenom: true, codeClient: true, telephone: true,
        etat: true, niveauRisque: true, limiteCredit: true, soldeActuel: true,
        typeClient: true,
      },
    });
    if (!client) return NextResponse.json({ message: "Client introuvable" }, { status: 404 });

    const raisons: string[] = [];   // bloquants
    const alertes: string[] = [];   // informatifs, non bloquants

    // ── Règle 1 : client doit être ACTIF ─────────────────────────────────
    if (client.etat !== MemberStatus.ACTIF) {
      raisons.push(`Ce client est ${client.etat.toLowerCase()} — seuls les clients actifs peuvent recevoir un crédit.`);
    }

    // ── Règle 2 : soldeActuel < limiteCredit ─────────────────────────────
    let tauxUtilisation: number | null = null;
    if (client.limiteCredit !== null && client.soldeActuel !== null) {
      tauxUtilisation = Number(client.limiteCredit) > 0
        ? Math.round((Number(client.soldeActuel) / Number(client.limiteCredit)) * 100)
        : 100;

      if (Number(client.soldeActuel) >= Number(client.limiteCredit)) {
        raisons.push(
          `La limite de crédit (${client.limiteCredit} FCFA) est atteinte — solde actuel : ${client.soldeActuel} FCFA.`
        );
      }
    } else if (client.limiteCredit === null) {
      // Pas de plafond configuré : informatif uniquement, pas bloquant
      // (l'API de création accepte les clients sans limite — aucun plafond = aucune contrainte)
      alertes.push("Aucune limite de crédit n'est configurée sur ce client — le crédit sera accordé sans plafond.");
    }

    // ── Règle 3 : CRITIQUE + crédit EN_RETARD ────────────────────────────
    let creditEnRetard = null;
    if (client.niveauRisque === NiveauRisque.CRITIQUE) {
      creditEnRetard = await prisma.creditClient.findFirst({
        where: { clientId, statut: StatutCredit.EN_RETARD },
        select: { id: true, reference: true, soldeRestant: true, dateEcheanceFin: true },
      });
      if (creditEnRetard) {
        raisons.push(
          `Client en risque CRITIQUE avec un crédit en retard (${creditEnRetard.reference}) — solde restant : ${creditEnRetard.soldeRestant} FCFA.`
        );
      }
    }

    // ── Statistiques des crédits actifs ──────────────────────────────────
    const creditsActifs = await prisma.creditClient.findMany({
      where: { clientId, statut: { in: [StatutCredit.ACTIF, StatutCredit.EN_RETARD, StatutCredit.EN_ATTENTE_VALIDATION] } },
      select: {
        id: true, reference: true, statut: true,
        montantTotal: true, soldeRestant: true, dateEcheanceFin: true,
      },
    });

    return NextResponse.json({
      eligible: raisons.length === 0,
      raisons,
      alertes,
      client,
      tauxUtilisation,
      creditsActifs,
      creditEnRetard,
    });
  } catch (error) {
    console.error("GET /api/admin/clients/[id]/eligibilite-credit", error);
    return NextResponse.json({ message: "Erreur lors de la vérification de l'éligibilité" }, { status: 500 });
  }
}
