/**
 * Prévisions & alertes anticipées (CDC Approvisionnement §16 — "BI/IA prédictive").
 *
 * Pas de modèle de machine learning : le CDC vise ici de la prévision de
 * rupture, pas nécessairement un moteur ML entraîné. On applique une méthode
 * statistique simple et explicable — moyenne mobile de la consommation
 * (déjà utilisée pour le MRP, lib/mrp.ts) projetée sur le stock actuel pour
 * estimer une couverture en jours, et une comparaison de deux fenêtres
 * glissantes pour détecter une tendance fournisseur (amélioration/dégradation).
 * Un vrai modèle prédictif (saisonnalité, ML) nécessiterait un historique et
 * une infrastructure de data science hors de portée du monolithe actuel.
 */

export type NiveauUrgencePrevision = "CRITIQUE" | "VIGILANCE" | "OK";

export interface CouvertureStock {
  consommationJournaliere: number;
  joursCouverture: number | null; // null = pas de consommation mesurable (pas de projection fiable)
  niveau: NiveauUrgencePrevision;
}

const SEUIL_JOURS_CRITIQUE = 7;
const SEUIL_JOURS_VIGILANCE = 21;

/**
 * Estime la couverture de stock (en jours) à partir de la consommation
 * moyenne mensuelle réelle (sorties clients, cf. lib/mrp.ts) et du stock
 * disponible actuel — indépendamment des seuils stockMin/critique déjà en
 * place (qui réagissent à l'état présent, pas à la tendance).
 */
export function calculerCouvertureStock(quantiteDisponible: number, moyenneMensuelleVentes: number): CouvertureStock {
  const consommationJournaliere = moyenneMensuelleVentes / 30;
  if (consommationJournaliere <= 0) {
    return { consommationJournaliere: 0, joursCouverture: null, niveau: "OK" };
  }
  const joursCouverture = Math.round(quantiteDisponible / consommationJournaliere);
  const niveau: NiveauUrgencePrevision =
    joursCouverture <= SEUIL_JOURS_CRITIQUE ? "CRITIQUE" :
    joursCouverture <= SEUIL_JOURS_VIGILANCE ? "VIGILANCE" : "OK";
  return { consommationJournaliere, joursCouverture, niveau };
}

export type TendanceFournisseur = "AMELIORATION" | "STABLE" | "DEGRADATION" | "INSUFFISANT";

/**
 * Compare le taux de respect des délais entre deux fenêtres consécutives pour
 * dégager une tendance simple (pas de régression, juste un delta de points).
 */
export function tendanceFournisseur(
  tauxRecent: number | null,
  tauxPrecedent: number | null,
  echantillonMin = 2,
  echantillonRecent = 0,
  echantillonPrecedent = 0,
): { tendance: TendanceFournisseur; deltaPoints: number | null } {
  if (tauxRecent == null || tauxPrecedent == null || echantillonRecent < echantillonMin || echantillonPrecedent < echantillonMin) {
    return { tendance: "INSUFFISANT", deltaPoints: null };
  }
  const delta = tauxRecent - tauxPrecedent;
  if (delta >= 10) return { tendance: "AMELIORATION", deltaPoints: delta };
  if (delta <= -10) return { tendance: "DEGRADATION", deltaPoints: delta };
  return { tendance: "STABLE", deltaPoints: delta };
}
