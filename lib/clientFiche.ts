import { StatutCredit } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Logique partagée de la fiche client (détail, crédits, historique), réutilisée
 * par les portails admin / RVC / agent terrain. Le contrôle d'accès (périmètre
 * PDV ou affectation agent) est fait par chaque route AVANT d'appeler ces helpers.
 */

// ── Contrôles de périmètre ──────────────────────────────────────────────────────
/** Le client est-il rattaché au PDV donné ? (périmètre RVC / caissier) */
export async function clientDansPdv(clientId: number, pdvId: number): Promise<"ok" | "introuvable" | "hors-perimetre"> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { pointDeVenteId: true } });
  if (!client) return "introuvable";
  return client.pointDeVenteId === pdvId ? "ok" : "hors-perimetre";
}

/** Le client est-il affecté à l'agent terrain donné ? (périmètre agent) */
export async function clientAssigneAgent(clientId: number, agentId: number): Promise<"ok" | "introuvable" | "hors-perimetre"> {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { agentTerrainId: true } });
  if (!client) return "introuvable";
  return client.agentTerrainId === agentId ? "ok" : "hors-perimetre";
}

// ── Détail client (mêmes relations que la fiche admin) ──────────────────────────
export async function chargerClientDetail(clientId: number) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      tags:          { select: { tag: { select: { id: true, nom: true, couleur: true } } } },
      pointDeVente:  { select: { id: true, nom: true, code: true } },
      pointsDeVente: { select: { pointDeVente: { select: { id: true, nom: true, code: true } } } },
      agentTerrain:  { select: { id: true, nom: true, prenom: true } },
      souscriptionsPacks: {
        include: { pack: true, echeances: { orderBy: { datePrevue: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      ventesDirectes: {
        where:   { statut: { not: "ANNULEE" } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true, reference: true, statut: true,
          modePaiement: true, montantTotal: true, montantPaye: true,
          createdAt: true,
          pointDeVente: { select: { id: true, nom: true, code: true } },
          lignes: {
            select: {
              id: true, quantite: true, prixUnitaire: true, montant: true,
              produit: { select: { id: true, nom: true } },
            },
          },
        },
      },
    },
  });
}

// ── Crédits du client + statistiques agrégées ───────────────────────────────────
export async function chargerClientCredits(clientId: number) {
  const credits = await prisma.creditClient.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      creePar:   { select: { id: true, nom: true, prenom: true } },
      validePar: { select: { id: true, nom: true, prenom: true } },
      lignes: {
        select: { id: true, produitNom: true, quantite: true, prixUnitaire: true, remise: true, montantLigne: true },
      },
      echeances: {
        orderBy: { numeroEcheance: "asc" },
        select: { id: true, numeroEcheance: true, dateEcheance: true, montantDu: true, montantPaye: true, statut: true, penalite: true },
      },
      remboursements: {
        orderBy: { dateRemboursement: "desc" },
        select: {
          id: true, montant: true, dateRemboursement: true,
          modePaiement: true, notes: true, statut: true,
          numeroJour: true, montantAttendu: true,
          enregistrePar:   { select: { id: true, nom: true, prenom: true } },
          agentCollecteur: { select: { id: true, nom: true, prenom: true } },
        },
      },
    },
  });

  const now = new Date();
  const stats = {
    total:     credits.length,
    actifs:    credits.filter((c) => c.statut === StatutCredit.ACTIF).length,
    enRetard:  credits.filter((c) => c.statut === StatutCredit.EN_RETARD).length,
    soldes:    credits.filter((c) => c.statut === StatutCredit.SOLDE).length,
    enAttente: credits.filter((c) => c.statut === StatutCredit.EN_ATTENTE_VALIDATION).length,
    montantTotalEmprunte: credits
      .filter((c) => c.statut !== StatutCredit.ANNULE && c.statut !== StatutCredit.REJETE)
      .reduce((s, c) => s + Number(c.montantTotal), 0),
    montantTotalRembourse: credits.reduce((s, c) => s + Number(c.montantRembourse), 0),
    soldeRestantTotal: credits
      .filter((c) => c.statut === StatutCredit.ACTIF || c.statut === StatutCredit.EN_RETARD)
      .reduce((s, c) => s + Number(c.soldeRestant), 0),
    montantEnCours: credits
      .filter((c) => c.statut === StatutCredit.ACTIF || c.statut === StatutCredit.EN_RETARD)
      .reduce((s, c) => s + Number(c.montantTotal), 0),
    echeancesEnRetard: credits.flatMap((c) =>
      c.echeances.filter((e) => e.statut !== "PAYE" && new Date(e.dateEcheance) < now)
    ).length,
    prochaineEcheance: credits
      .filter((c) => c.statut === StatutCredit.ACTIF || c.statut === StatutCredit.EN_RETARD)
      .flatMap((c) => c.echeances.filter((e) => e.statut !== "PAYE"))
      .map((e) => e.dateEcheance)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null,
  };

  return { credits, stats };
}

// ── Historique unifié (collectes · versements · ventes · audit) ─────────────────
function auditLabel(action: string) {
  const map: Record<string, string> = {
    CREATION_CLIENT:           "Création du client",
    MODIFICATION_CLIENT:       "Modification du profil",
    SUPPRESSION_CLIENT:        "Suppression du client",
    CREATION_SOUSCRIPTION:     "Souscription créée",
    MODIFICATION_SOUSCRIPTION: "Souscription modifiée",
    VALIDATION_COLLECTE:       "Collecte validée",
    ANNULATION_COLLECTE:       "Collecte annulée",
    CREATION_VERSEMENT:        "Versement enregistré",
  };
  return map[action] ?? action.replace(/_/g, " ");
}

export async function chargerClientHistorique(clientId: number, page: number, limit: number) {
  const [lignesCollecte, versements, ventes, auditLogs] = await Promise.all([
    prisma.ligneCollecte.findMany({
      where: { clientId, type: "PACK" },
      select: {
        id: true, montantCollecte: true, statut: true, createdAt: true,
        collecte: { select: { reference: true, dateCollecte: true, statut: true, agent: { select: { nom: true, prenom: true } } } },
        souscription: { select: { pack: { select: { nom: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.versementPack.findMany({
      where: { souscription: { clientId } },
      select: {
        id: true, montant: true, type: true, statut: true,
        datePaiement: true, reference: true, encaisseParNom: true, createdAt: true,
        souscription: { select: { pack: { select: { nom: true } } } },
      },
      orderBy: { datePaiement: "desc" },
    }),
    prisma.venteDirecte.findMany({
      where: { clientId },
      select: { id: true, reference: true, statut: true, modePaiement: true, montantTotal: true, createdAt: true, pointDeVente: { select: { nom: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { entite: "Client", entiteId: clientId },
      select: { id: true, action: true, createdAt: true, user: { select: { nom: true, prenom: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  type TItem = {
    id: string;
    type: "COLLECTE" | "VERSEMENT" | "VENTE" | "AUDIT";
    date: string; titre: string; detail: string;
    montant?: number; statut?: string; reference?: string;
  };

  const items: TItem[] = [
    ...lignesCollecte.map((l) => ({
      id: `col-${l.id}`, type: "COLLECTE" as const,
      date: l.collecte.dateCollecte.toISOString(),
      titre: `Collecte – ${l.souscription!.pack.nom}`,
      detail: `Agent : ${l.collecte.agent.prenom} ${l.collecte.agent.nom} · Réf : ${l.collecte.reference}`,
      montant: Number(l.montantCollecte), statut: l.statut,
    })),
    ...versements.map((v) => ({
      id: `ver-${v.id}`, type: "VERSEMENT" as const,
      date: v.datePaiement.toISOString(),
      titre: `Versement – ${v.souscription.pack.nom}`,
      detail: v.encaisseParNom ? `Encaissé par ${v.encaisseParNom}` : v.type.replace(/_/g, " "),
      montant: Number(v.montant), statut: v.statut, reference: v.reference ?? undefined,
    })),
    ...ventes.map((v) => ({
      id: `ven-${v.id}`, type: "VENTE" as const,
      date: v.createdAt.toISOString(),
      titre: `Vente – ${v.pointDeVente.nom}`,
      detail: `${v.modePaiement.replace(/_/g, " ")} · ${v.reference}`,
      montant: Number(v.montantTotal), statut: v.statut, reference: v.reference,
    })),
    ...auditLogs.map((a) => ({
      id: `aud-${a.id}`, type: "AUDIT" as const,
      date: a.createdAt.toISOString(),
      titre: auditLabel(a.action),
      detail: a.user ? `Par ${a.user.prenom} ${a.user.nom}` : "Système",
    })),
  ];

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = items.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paged = items.slice((page - 1) * limit, page * limit);

  return { data: paged, meta: { total, page, limit, totalPages } };
}
