import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAgentTerrainSession } from "@/lib/authAgentTerrain";

/**
 * GET /api/agentTerrain/credits
 *
 * ?mode=full  → tous les crédits des clients de l'agent + lignes (pour la page dédiée)
 * ?statut=X   → filtre additionnel (avec mode=full)
 * (défaut)    → ACTIF + EN_RETARD seulement, avec échéances + remboursements (dashboard principal)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId = parseInt(session.user.id);
    const { searchParams } = new URL(req.url);
    const mode   = searchParams.get("mode");
    const statut = searchParams.get("statut");

    // ── Mode full : page dédiée crédits ──────────────────────────────────────
    if (mode === "full") {
      const where: Record<string, unknown> = {
        client: { agentTerrainId: agentId },
      };
      if (statut && statut !== "all") where.statut = statut;

      const credits = await prisma.creditClient.findMany({
        where,
        select: {
          id: true,
          reference: true,
          statut: true,
          montantTotal: true,
          montantRembourse: true,
          soldeRestant: true,
          montantJournalier: true,
          dateEcheanceFin: true,
          createdAt: true,
          client: { select: { id: true, nom: true, prenom: true, telephone: true } },
          lignes: {
            select: {
              id: true,
              produitNom: true,
              produitNomSaisi: true,
              quantite: true,
              prixUnitaire: true,
              statut: true,
              estNouveauProduit: true,
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
      });

      const stats = {
        total:    credits.length,
        enAttente: credits.filter((c) => c.statut === "EN_ATTENTE_VALIDATION").length,
        actifs:   credits.filter((c) => c.statut === "ACTIF").length,
        enRetard: credits.filter((c) => c.statut === "EN_RETARD").length,
        clos:     credits.filter((c) => c.statut === "SOLDE").length,
      };

      return NextResponse.json({ credits, stats });
    }

    // ── Mode défaut : dashboard principal ────────────────────────────────────
    const credits = await prisma.creditClient.findMany({
      where: {
        statut:      { in: ["ACTIF", "EN_RETARD"] },
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
        dureeJours: true,
        dateDebut: true,
        dateEcheanceFin: true,
        client: { select: { id: true, nom: true, prenom: true, telephone: true } },
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
      total:      credits.length,
      totalSolde: credits.reduce((s, c) => s + Number(c.soldeRestant), 0),
      enRetard:   credits.filter((c) => c.statut === "EN_RETARD").length,
    };

    return NextResponse.json({ credits, stats });
  } catch (error) {
    console.error("GET /api/agentTerrain/credits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/agentTerrain/credits
 *
 * Soumet une demande de crédit client (statut EN_ATTENTE_VALIDATION).
 * Le RVC doit ensuite éditer les lignes si nécessaire et valider.
 *
 * Body: {
 *   clientId: number;
 *   dureeJours: number;
 *   dateDebut: string;
 *   garantie?: string;
 *   observations?: string;
 *   lignes: {
 *     produitId?: number;       // produit catalogue
 *     produitNomSaisi: string;  // nom saisi (toujours requis, sert de libellé)
 *     quantite: number;
 *     prixUnitaire: number;
 *     remise?: number;
 *   }[];
 * }
 */
export async function POST(req: Request) {
  try {
    const session = await getAgentTerrainSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const agentId  = parseInt(session.user.id);
    const agentNom = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();

    const body = await req.json();
    const { clientId, dureeJours, dateDebut, garantie, observations, lignes } = body;

    if (!clientId || !Array.isArray(lignes) || lignes.length === 0 || !dureeJours || !dateDebut) {
      return NextResponse.json(
        { error: "Champs obligatoires : clientId, lignes (≥ 1), dureeJours, dateDebut" },
        { status: 400 }
      );
    }
    if (Number(dureeJours) < 1) {
      return NextResponse.json({ error: "dureeJours doit être ≥ 1" }, { status: 400 });
    }

    type LigneInput = {
      produitId?:      number;
      produitNomSaisi: string;
      quantite:        number;
      prixUnitaire:    number;
      remise?:         number;
    };
    const lignesInput = lignes as LigneInput[];

    const result = await prisma.$transaction(async (tx) => {
      // ── Vérifier le client ────────────────────────────────────────────────
      const client = await tx.client.findUnique({
        where: { id: Number(clientId) },
        select: {
          id: true, nom: true, prenom: true,
          agentTerrainId: true, etat: true,
          pointDeVenteId: true,
        },
      });
      if (!client)                               throw new Error("CLIENT_INTROUVABLE");
      if (client.agentTerrainId !== agentId)     throw new Error("CLIENT_NON_ASSIGNE");
      if (client.etat !== "ACTIF")               throw new Error("CLIENT_INACTIF");

      // ── Calcul montant ────────────────────────────────────────────────────
      const lignesCalc = lignesInput.map((l) => {
        const qte = Number(l.quantite);
        const pu  = Number(l.prixUnitaire);
        const rem = Number(l.remise || 0);
        return { ...l, qte, pu, rem, montantLigne: Number((pu * qte - rem).toFixed(2)) };
      });
      const montantTotal = Number(lignesCalc.reduce((s, l) => s + l.montantLigne, 0).toFixed(2));
      if (montantTotal <= 0) throw new Error("MONTANT_INVALIDE");

      const duree             = Number(dureeJours);
      const debut             = new Date(dateDebut);
      const montantJournalier = Number((montantTotal / duree).toFixed(2));
      const dateEcheanceFin   = new Date(debut);
      dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

      // ── Référence ─────────────────────────────────────────────────────────
      const dateStr  = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count    = await tx.creditClient.count();
      const reference = `CRD-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // ── Création du crédit EN_ATTENTE_VALIDATION ──────────────────────────
      const credit = await tx.creditClient.create({
        data: {
          reference,
          clientId:       client.id,
          pointDeVenteId: client.pointDeVenteId ?? null,
          statut:         "EN_ATTENTE_VALIDATION",
          montantTotal,
          montantRembourse: 0,
          soldeRestant:   montantTotal,
          dureeJours:     duree,
          dateDebut:      debut,
          dateEcheanceFin,
          montantJournalier,
          tauxPenalite:   0,
          garantie:       garantie || null,
          observations:   observations || null,
          creeParId:      agentId,
          lignes: {
            create: lignesCalc.map((l) => ({
              produitId:        l.produitId ? Number(l.produitId) : null,
              produitNom:       l.produitNomSaisi,
              produitNomSaisi:  l.produitNomSaisi,
              quantite:         l.qte,
              prixUnitaire:     l.pu,
              remise:           l.rem,
              montantLigne:     l.montantLigne,
              statut:           "EN_ATTENTE" as const,
              estNouveauProduit: !l.produitId,
              pointDeVenteId:   client.pointDeVenteId ?? null,
            })),
          },
        },
      });

      // ── Audit ─────────────────────────────────────────────────────────────
      await tx.auditLog.create({
        data: {
          userId:   agentId,
          action:   "CREATION_CREDIT_TERRAIN",
          entite:   "CreditClient",
          entiteId: credit.id,
        },
      });

      const nouveauxProduits = lignesCalc.filter((l) => !l.produitId);

      // ── Notification admins ───────────────────────────────────────────────
      const admins = await tx.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        const msgAdmin = nouveauxProduits.length > 0
          ? `${agentNom} : demande crédit ${reference} (${montantTotal.toLocaleString("fr-FR")} FCFA, ${duree}j) pour ${client.prenom} ${client.nom}. ATTENTION — ${nouveauxProduits.length} produit(s) hors catalogue à créer : ${nouveauxProduits.map((l) => l.produitNomSaisi).join(", ")}.`
          : `${agentNom} : demande crédit ${reference} (${montantTotal.toLocaleString("fr-FR")} FCFA, ${duree}j) pour ${client.prenom} ${client.nom}. Validation requise.`;
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId:    a.id,
            titre:     `Demande crédit terrain — ${reference}`,
            message:   msgAdmin,
            priorite:  nouveauxProduits.length > 0 ? "HAUTE" as const : "NORMAL" as const,
            actionUrl: `/dashboard/admin/credits`,
          })),
        });
      }

      // ── Notification gestionnaires PDV (RVC…) ─────────────────────────────
      if (client.pointDeVenteId) {
        const gestionnaires = await tx.gestionnaireAffectation.findMany({
          where: { pointDeVenteId: client.pointDeVenteId, actif: true },
          select: { userId: true },
        });
        if (gestionnaires.length > 0) {
          await tx.notification.createMany({
            data: gestionnaires.map((g) => ({
              userId:    g.userId,
              titre:     `Demande crédit terrain — ${reference}`,
              message:   `${agentNom} a soumis une demande de crédit pour ${client.prenom} ${client.nom} (${montantTotal.toLocaleString("fr-FR")} FCFA — ${duree} jours). Vérification et validation requises.`,
              priorite:  "HAUTE" as const,
              actionUrl: `/dashboard/user/responsablesVenteCredit/credits`,
            })),
          });
        }

        // ── Notification logistique si nouveaux produits ─────────────────────
        if (nouveauxProduits.length > 0) {
          const logistiques = await tx.gestionnaireAffectation.findMany({
            where: {
              pointDeVenteId: client.pointDeVenteId,
              actif:          true,
              user: { gestionnaire: { role: "AGENT_LOGISTIQUE_APPROVISIONNEMENT", actif: true } },
            },
            select: { userId: true },
          });
          if (logistiques.length > 0) {
            await tx.notification.createMany({
              data: logistiques.map((l) => ({
                userId:    l.userId,
                titre:     `Nouveaux produits à créer — crédit ${reference}`,
                message:   `Demande de crédit terrain par ${agentNom} : ${nouveauxProduits.length} produit(s) hors catalogue à créer : ${nouveauxProduits.map((p) => p.produitNomSaisi).join(", ")}.`,
                priorite:  "HAUTE" as const,
                actionUrl: `/dashboard/admin/credits`,
              })),
            });
          }
        }
      }

      return credit;
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/agentTerrain/credits", error);
    if (error instanceof Error) {
      const map: Record<string, [string, number]> = {
        CLIENT_INTROUVABLE: ["Client introuvable", 404],
        CLIENT_NON_ASSIGNE: ["Ce client n'est pas dans votre portefeuille", 403],
        CLIENT_INACTIF:     ["Ce client n'est pas actif", 422],
        MONTANT_INVALIDE:   ["Le montant total des lignes doit être > 0", 400],
      };
      if (map[error.message]) {
        const [msg, status] = map[error.message];
        return NextResponse.json({ error: msg }, { status });
      }
    }
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
