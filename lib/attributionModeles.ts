import { prisma } from "@/lib/prisma";

/**
 * Modèles d'attribution marketing (CDC §57) — paramétrable : first touch,
 * last touch, linear, campaign-based. Les points de contact traçables par
 * client sont ceux qui portent un `campagneId` + un `clientId` connu :
 * EnvoiMessage (Phase 2), SoumissionFormulaire (Phase 6), ParticipantEvenement
 * (Phase 6, via son événement). Les scans QR / clics affiliés (Phase 6) ne
 * sont PAS inclus : ils ne sont comptés qu'en agrégat, sans clientId associé
 * au moment du clic — limite documentée, pas un oubli.
 */

export type ModeleAttribution = "CAMPAIGN_BASED" | "FIRST_TOUCH" | "LAST_TOUCH" | "LINEAR";
export const MODELES_ATTRIBUTION: ModeleAttribution[] = ["CAMPAIGN_BASED", "FIRST_TOUCH", "LAST_TOUCH", "LINEAR"];

export interface Touchpoint {
  campagneId: number;
  date: Date;
}

const FENETRE_JOURS_DEFAUT = 90;
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Points de contact connus d'un client (campagnes) avant une date donnée. */
async function resoudreTouchpoints(clientId: number, avant: Date, fenetreJours = FENETRE_JOURS_DEFAUT): Promise<Touchpoint[]> {
  const depuis = new Date(avant.getTime() - fenetreJours * JOUR_MS);

  const [envois, soumissions, participations] = await Promise.all([
    prisma.envoiMessage.findMany({
      where: { clientId, campagneId: { not: null }, dateEnvoi: { gte: depuis, lt: avant }, statut: { not: "EN_ATTENTE" } },
      select: { campagneId: true, dateEnvoi: true },
    }),
    prisma.soumissionFormulaire.findMany({
      where: { clientIdCree: clientId, campagneId: { not: null }, createdAt: { gte: depuis, lt: avant } },
      select: { campagneId: true, createdAt: true },
    }),
    prisma.participantEvenement.findMany({
      where: { clientId, createdAt: { gte: depuis, lt: avant }, evenement: { campagneId: { not: null } } },
      select: { createdAt: true, evenement: { select: { campagneId: true } } },
    }),
  ]);

  const points: Touchpoint[] = [
    ...envois.map((e) => ({ campagneId: e.campagneId as number, date: e.dateEnvoi })),
    ...soumissions.map((s) => ({ campagneId: s.campagneId as number, date: s.createdAt })),
    ...participations.map((p) => ({ campagneId: p.evenement!.campagneId as number, date: p.createdAt })),
  ];
  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface AttributionPonderee {
  campagneId: number;
  poids: number; // fraction du CA attribuée à cette campagne (somme = 1 par vente)
}

/**
 * Répartit le CA d'une vente entre campagnes selon le modèle choisi.
 * CAMPAIGN_BASED = comportement historique (100% à VenteDirecte.campagneId,
 * pas de reconstruction de parcours). Les autres modèles retombent sur
 * CAMPAIGN_BASED si aucun point de contact n'est trouvé dans la fenêtre.
 */
export async function calculerAttributionVente(
  vente: { campagneId: number | null; clientId: number | null; createdAt: Date },
  modele: ModeleAttribution,
): Promise<AttributionPonderee[]> {
  if (!vente.campagneId) return [];
  if (modele === "CAMPAIGN_BASED" || !vente.clientId) {
    return [{ campagneId: vente.campagneId, poids: 1 }];
  }

  const touchpoints = await resoudreTouchpoints(vente.clientId, vente.createdAt);
  if (!touchpoints.length) return [{ campagneId: vente.campagneId, poids: 1 }];

  if (modele === "FIRST_TOUCH") return [{ campagneId: touchpoints[0].campagneId, poids: 1 }];
  if (modele === "LAST_TOUCH") return [{ campagneId: touchpoints[touchpoints.length - 1].campagneId, poids: 1 }];

  // LINEAR : crédit réparti également entre les campagnes distinctes touchées.
  const campagnesUniques = [...new Set(touchpoints.map((t) => t.campagneId))];
  const poids = 1 / campagnesUniques.length;
  return campagnesUniques.map((campagneId) => ({ campagneId, poids }));
}
