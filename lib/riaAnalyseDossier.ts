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
