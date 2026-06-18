import { prisma } from "@/lib/prisma";

export interface ProduitFinancement {
  nom: string;
  quantite: number;
  coutAchat: number;
  prixRevente: number;
}

export interface ClientFinancement {
  clientId: number;
  nom?: string;
  montant: number;
  produits?: ProduitFinancement[];
}

export interface ContenuDemandeFinancement {
  region?: string;
  agence?: string;
  responsableDemandeurId?: number;
  clients?: ClientFinancement[];
  dureeCycleJours?: number;
  risqueEstime?: "FAIBLE" | "MOYEN" | "ELEVE";
  investisseursConcernes?: number[];
  piecesJointesUrls?: string[];
}

export interface AnalyseFinancement {
  montantTotal: number;
  margeTotale: number;
  roiEstime: number; // %
  tauxRisque: number; // %
  probabiliteRemboursement: number; // %
  impactTresorerie: number | null; // %
  rentabiliteAttendue: number; // FCFA
  nbClients: number;
  scoreMoyenSolvabilite: number | null;
}

type DB = Pick<typeof prisma, "client" | "portefeuilleRIA">;
type DBConsult = Pick<typeof prisma, "client" | "portefeuilleRIA" | "operationFinancementRIA">;

export interface ConsultationPortefeuille {
  id: number; reference: string; nom: string | null; investisseur: string | null;
  capitalDisponible: number; capitalEngage: number; capitalInvesti: number;
}
export interface ConsultationClient {
  clientId: number; nom: string; scoreSolvabilite: number | null;
  nbFinancements: number; montantFinanceTotal: number; encoursTotal: number;
}
export interface ConsultationFinancement {
  portefeuilles: ConsultationPortefeuille[];
  clients: ConsultationClient[];
}

// Aides à la consultation pour la commission réceptrice (CDC — Scénario 2) :
// fonds disponibles des portefeuilles investisseurs ciblés + historique de
// financement des clients de la demande. Partagé par les portails membre/admin.
export async function construireConsultation(
  db: DBConsult,
  contenu: ContenuDemandeFinancement
): Promise<ConsultationFinancement> {
  const pfIds = (contenu.investisseursConcernes ?? []).filter((n): n is number => typeof n === "number");
  const clientIds = (contenu.clients ?? [])
    .map((c) => c.clientId)
    .filter((n): n is number => typeof n === "number" && n > 0);

  const [portefeuilles, clientsInfo, financements] = await Promise.all([
    pfIds.length
      ? db.portefeuilleRIA.findMany({
          where: { id: { in: pfIds } },
          select: {
            id: true, reference: true, nom: true,
            capitalDisponible: true, capitalEngage: true, capitalInvesti: true,
            profilRIA: { select: { gestionnaire: { select: { member: { select: { nom: true, prenom: true } } } } } },
          },
        })
      : Promise.resolve([]),
    clientIds.length
      ? db.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, nom: true, prenom: true, scoreSolvabilite: true },
        })
      : Promise.resolve([]),
    clientIds.length
      ? db.operationFinancementRIA.groupBy({
          by: ["clientId"],
          where: { clientId: { in: clientIds } },
          _count: { _all: true },
          _sum: { montantFinance: true, encours: true },
        })
      : Promise.resolve([] as Array<{ clientId: number; _count: { _all: number }; _sum: { montantFinance: unknown; encours: unknown } }>),
  ]);

  const finByClient = new Map(financements.map((f) => [f.clientId, f]));
  const clients: ConsultationClient[] = clientsInfo.map((c) => {
    const f = finByClient.get(c.id);
    return {
      clientId: c.id,
      nom: `${c.prenom} ${c.nom}`,
      scoreSolvabilite: c.scoreSolvabilite,
      nbFinancements: f?._count._all ?? 0,
      montantFinanceTotal: f?._sum.montantFinance ? Number(f._sum.montantFinance) : 0,
      encoursTotal: f?._sum.encours ? Number(f._sum.encours) : 0,
    };
  });

  return {
    portefeuilles: portefeuilles.map((p) => ({
      id: p.id,
      reference: p.reference,
      nom: p.nom,
      investisseur: p.profilRIA?.gestionnaire?.member
        ? `${p.profilRIA.gestionnaire.member.prenom} ${p.profilRIA.gestionnaire.member.nom}`
        : null,
      capitalDisponible: Number(p.capitalDisponible),
      capitalEngage: Number(p.capitalEngage),
      capitalInvesti: Number(p.capitalInvesti),
    })),
    clients,
  };
}

// Calculs du Scénario 2 du CDC — basés sur les données réelles (score de
// solvabilité client, capital disponible du portefeuille), pas de simulation.
export async function calculerAnalyseFinancement(
  db: DB,
  contenu: ContenuDemandeFinancement,
  portefeuilleId?: number | null
): Promise<AnalyseFinancement> {
  const clients = contenu.clients ?? [];
  const montantTotal = clients.reduce((s, c) => s + Number(c.montant || 0), 0);

  const margeTotale = clients.reduce((s, c) => {
    const margeClient = (c.produits ?? []).reduce(
      (m, p) => m + (Number(p.prixRevente) - Number(p.coutAchat)) * Number(p.quantite),
      0
    );
    return s + margeClient;
  }, 0);

  const roiEstime = montantTotal > 0 ? (margeTotale / montantTotal) * 100 : 0;
  const rentabiliteAttendue = montantTotal * (roiEstime / 100);

  const clientIds = clients.map((c) => c.clientId).filter(Boolean);
  let scoreMoyenSolvabilite: number | null = null;
  if (clientIds.length > 0) {
    const rows = await db.client.findMany({
      where: { id: { in: clientIds } },
      select: { scoreSolvabilite: true },
    });
    const scores = rows.map((r) => r.scoreSolvabilite).filter((s): s is number => s != null);
    if (scores.length > 0) {
      scoreMoyenSolvabilite = scores.reduce((s, v) => s + v, 0) / scores.length;
    }
  }

  // Valeur neutre (50%) si aucun score de solvabilité n'est encore renseigné
  const probabiliteRemboursement = scoreMoyenSolvabilite ?? 50;
  const tauxRisque = 100 - probabiliteRemboursement;

  let impactTresorerie: number | null = null;
  if (portefeuilleId) {
    const pf = await db.portefeuilleRIA.findUnique({
      where: { id: portefeuilleId },
      select: { capitalDisponible: true },
    });
    if (pf && Number(pf.capitalDisponible) > 0) {
      impactTresorerie = (montantTotal / Number(pf.capitalDisponible)) * 100;
    }
  }

  return {
    montantTotal,
    margeTotale,
    roiEstime,
    tauxRisque,
    probabiliteRemboursement,
    impactTresorerie,
    rentabiliteAttendue,
    nbClients: clients.length,
    scoreMoyenSolvabilite,
  };
}
