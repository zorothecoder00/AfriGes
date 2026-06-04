import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";
import { notifyAdmins } from "@/lib/notifications";

/**
 * GET /api/agentTerrain/credits
 * Retourne les crédits actifs/en retard des clients de l'agent.
 */
export async function GET() {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId = parseInt(session.user.id);

    const credits = await prisma.creditClient.findMany({
      where: {
        statut: { in: ["ACTIF", "EN_RETARD"] },
        soldeRestant: { gt: 0 },
        client: { agentTerrainId: agentId },
      },
      select: {
        id: true,
        reference: true,
        statut: true,
        montantTotal: true,
        montantRembourse: true,
        soldeRestant: true,
        montantJournalier: true,
        dateEcheanceFin: true,
        client: {
          select: { id: true, nom: true, prenom: true, telephone: true },
        },
        echeances: {
          where: { statut: { in: ["EN_ATTENTE", "EN_RETARD"] } },
          select: { id: true, montantDu: true, montantPaye: true, dateEcheance: true, statut: true },
          orderBy: { dateEcheance: "asc" },
          take: 1,
        },
        remboursements: {
          select: { id: true, montant: true, dateRemboursement: true },
          orderBy: { dateRemboursement: "desc" },
          take: 3,
        },
      },
      orderBy: [{ statut: "asc" }, { dateEcheanceFin: "asc" }],
    });

    const stats = {
      total: credits.length,
      totalSolde: credits.reduce((s, c) => s + Number(c.soldeRestant), 0),
      enRetard: credits.filter((c) => c.statut === "EN_RETARD").length,
    };

    return NextResponse.json({ credits, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/credits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/credits
 * Crée une demande de crédit pour un client de l'agent (si limiteCredit fixé par l'admin).
 * Statut initial : EN_ATTENTE_VALIDATION (l'admin doit valider).
 *
 * Body: { clientId, montantTotal, dureeJours, dateDebut, garantie?, observations? }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json();
    const { clientId, montantTotal, dureeJours, dateDebut, garantie, observations } = body;

    if (!clientId || !montantTotal || !dureeJours || !dateDebut) {
      return NextResponse.json(
        { error: "Champs obligatoires : clientId, montantTotal, dureeJours, dateDebut" },
        { status: 400 }
      );
    }
    if (Number(montantTotal) <= 0) {
      return NextResponse.json({ error: "montantTotal doit être > 0" }, { status: 400 });
    }
    if (Number(dureeJours) < 1) {
      return NextResponse.json({ error: "dureeJours doit être >= 1" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // ── Vérifier que le client appartient à cet agent ──────────────────────
      const client = await tx.client.findUnique({
        where: { id: Number(clientId) },
        select: {
          id: true, nom: true, prenom: true,
          agentTerrainId: true, etat: true,
          limiteCredit: true, soldeActuel: true, niveauRisque: true,
          pointDeVenteId: true,
        },
      });
      if (!client) throw new Error("CLIENT_INTROUVABLE");
      if (client.agentTerrainId !== agentId) throw new Error("CLIENT_NON_ASSIGNE");
      if (client.etat !== "ACTIF") throw new Error("CLIENT_INACTIF");

      // ── Vérifier que l'admin a fixé un plafond ─────────────────────────────
      if (client.limiteCredit === null || Number(client.limiteCredit) <= 0) {
        throw new Error("PLAFOND_NON_FIXE");
      }

      const montant = Number(montantTotal);
      const soldeActuel = Number(client.soldeActuel ?? 0);
      const disponible = Number(client.limiteCredit) - soldeActuel;

      if (disponible <= 0) throw new Error("LIMITE_ATTEINTE");
      if (montant > disponible) throw new Error(`MONTANT_DEPASSE:${disponible}`);

      // ── Calcul ─────────────────────────────────────────────────────────────
      const duree  = Number(dureeJours);
      const debut  = new Date(dateDebut);
      const montantJournalier  = Number((montant / duree).toFixed(2));
      const dateEcheanceFin    = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── Référence ──────────────────────────────────────────────────────────
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count   = await tx.creditClient.count();
      const reference = `CRD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // ── Créer le crédit avec une ligne générique ───────────────────────────
      const credit = await tx.creditClient.create({
        data: {
          reference,
          clientId: client.id,
          pointDeVenteId: client.pointDeVenteId ?? null,
          statut: "EN_ATTENTE_VALIDATION",
          montantTotal: montant,
          montantRembourse: 0,
          soldeRestant: montant,
          dureeJours: duree,
          dateDebut: debut,
          dateEcheanceFin,
          montantJournalier,
          tauxPenalite: 0,
          garantie: garantie || null,
          observations: observations || null,
          creeParId: agentId,
          lignes: {
            create: [{
              produitNom:       `Crédit terrain — ${agentNom}`,
              produitNomSaisi:  `Crédit terrain — ${agentNom}`,
              quantite:         1,
              prixUnitaire:     montant,
              remise:           0,
              montantLigne:     montant,
              statut:           "EN_ATTENTE" as const,
              estNouveauProduit: true,
            }],
          },
        },
      });

      // ── Audit ──────────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          userId: agentId,
          action: "CREATION_CREDIT_TERRAIN",
          entite: "CreditClient",
          entiteId: credit.id,
        },
      });

      // ── Notifier les admins ────────────────────────────────────────────────
      await notifyAdmins(tx, {
        titre: "Nouvelle demande de crédit (terrain)",
        message: `${agentNom} a soumis une demande de crédit de ${montant.toLocaleString("fr-FR")} FCFA pour ${client.prenom} ${client.nom} (${reference}) — durée ${duree} jours.`,
        priorite: "HAUTE",
        actionUrl: `/dashboard/admin/credits`,
      });

      // ── Notifier les gestionnaires du PDV (RVC, RPV…) ─────────────────────
      if (client.pointDeVenteId) {
        const pdvGest = await tx.gestionnaireAffectation.findMany({
          where: { pointDeVenteId: client.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        if (pdvGest.length > 0) {
          await tx.notification.createMany({
            data: pdvGest.map((g) => ({
              userId:    g.userId,
              titre:     "Nouvelle demande de crédit (terrain) — en attente de validation",
              message:   `Demande de ${montant.toLocaleString("fr-FR")} FCFA pour ${client.prenom} ${client.nom} (${reference}) soumise par ${agentNom}.`,
              priorite:  "HAUTE" as const,
              actionUrl: `/dashboard/admin/credits`,
            })),
          });
        }
      }

      return credit;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/agentTerrain/credits", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CLIENT_INTROUVABLE:  ["Client introuvable", 404],
        CLIENT_NON_ASSIGNE:  ["Ce client n'est pas dans votre portefeuille", 403],
        CLIENT_INACTIF:      ["Ce client n'est pas actif", 422],
        PLAFOND_NON_FIXE:    ["Aucun plafond de crédit n'a été fixé pour ce client par l'admin", 422],
        LIMITE_ATTEINTE:     ["La limite de crédit de ce client est atteinte", 422],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
      // Montant dépassé avec détail
      if (error.message.startsWith("MONTANT_DEPASSE:")) {
        const dispo = Number(error.message.split(":")[1]);
        return NextResponse.json(
          { error: `Montant trop élevé. Disponible : ${dispo.toLocaleString("fr-FR")} FCFA` },
          { status: 422 }
        );
      }
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
