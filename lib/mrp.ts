/**
 * lib/mrp.ts — Planification des besoins (MRP), CDC Approvisionnement §6.
 *
 * Formule CDC :
 *   Besoin = Prévision ventes + Stock sécurité − Stock disponible − Commandes en cours
 *
 * Adaptation pour AfriGes (fonction pure, aucune dépendance Prisma) :
 *   - Stock disponible est augmenté du stock en transit (déjà en approche,
 *     réduit d'autant le besoin réel) — le stock réservé n'est PAS à soustraire
 *     séparément car StockSite.quantite exclut déjà le réservé par construction.
 *   - Prévision ventes = moyenne mensuelle historique des sorties clients
 *     (VENTE_DIRECTE/LIVRAISON_PACK/LIVRAISON_CLIENT) × horizon en mois,
 *     PLUS la demande ferme non couverte (pas une estimation) : souscriptions
 *     déjà confirmées + lignes de crédits clients déjà validés (VALIDE/ACTIF/
 *     EN_RETARD) mais pas encore livrées — un crédit accordé est lui aussi une
 *     précommande de produits, au même titre qu'une souscription confirmée.
 *   - Saisonnalité, promotions prévues, tendances marché (CDC) ne sont PAS
 *     modélisées ici faute de données suffisantes/fiables pour les quantifier
 *     automatiquement sans deviner — seul un signal informatif "promotion
 *     active" est remonté par l'appelant s'il existe, à charge du responsable
 *     d'ajuster manuellement la proposition (le CDC prévoit explicitement
 *     cette latitude : "le responsable peut accepter ou modifier").
 */

export interface EntreeBesoinMRP {
  moyenneMensuelleVentes: number;   // moyenne des sorties clients / mois (historique)
  horizonMois: number;              // horizon de couverture souhaité
  demandeFermeNonCouverte: number; // demande ferme connue : souscriptions confirmées + crédits validés non livrés
  stockSecurite: number;            // stockMin / seuilCritique
  stockDisponible: number;
  stockEnTransit: number;
  commandesEnCours: number;         // PO non complétés/annulés : quantité restant à recevoir
}

export interface ResultatBesoinMRP extends EntreeBesoinMRP {
  previsionVentes: number;
  besoinNet: number; // > 0 = à commander
}

export function calculerBesoinMRP(entree: EntreeBesoinMRP): ResultatBesoinMRP {
  const previsionVentes = Math.round(
    entree.moyenneMensuelleVentes * entree.horizonMois + entree.demandeFermeNonCouverte
  );
  const disponibleEffectif = entree.stockDisponible + entree.stockEnTransit;
  const besoinNet = Math.max(
    0,
    Math.round(previsionVentes + entree.stockSecurite - disponibleEffectif - entree.commandesEnCours)
  );

  return { ...entree, previsionVentes, besoinNet };
}
