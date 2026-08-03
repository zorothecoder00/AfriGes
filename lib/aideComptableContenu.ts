// lib/aideComptableContenu.ts
//
// Contenu de l'aide contextuelle « ? Aide comptable » (CDC §59) : pour chaque
// onglet du module Comptabilité, rappelle le compte à utiliser / sa nature /
// sa fonction / la règle de comptabilisation / le référentiel / un exemple.
// Registre statique volontairement — pas de connexion base, c'est de la
// documentation métier, pas une donnée qui change avec l'activité.
import type { AideComptableContenu } from "@/components/AideComptable";

export const AIDE_COMPTABLE: Record<string, AideComptableContenu> = {
  synthese: {
    titre: "Synthèse comptable",
    fonction: "Vue d'ensemble des encaissements/décaissements et du solde de trésorerie sur la période choisie, agrégée depuis les journaux (caisse, ventes, achats, paie).",
    referentiel: "SYSCOHADA révisé — tableau de bord opérationnel (aperçu rapide, non un état financier officiel).",
    exemple: "Filtrer sur « 30j » pour voir les encaissements de vente du mois en cours.",
  },
  configInitiale: {
    titre: "Configuration initiale",
    fonction: "Assistant qui vérifie que les prérequis du module (plan comptable, journaux, exercice ouvert, comptes essentiels) sont bien en place avant utilisation normale.",
    regle: "Chaque étape est calculée en direct depuis les données réelles (nombre de comptes créés, exercice ouvert, etc.) — jamais une simple case à cocher manuellement.",
    referentiel: "CDC §60 — Assistant de configuration initiale.",
    exemple: "Si « Exercice ouvert » reste rouge, ouvrez l'exercice en cours depuis l'onglet Exercices avant de saisir des écritures.",
  },
  plan: {
    titre: "Plan comptable",
    compte: "Classes 1 à 8 (OHADA/SYSCOHADA) : 1 Capitaux, 2 Immobilisations, 3 Stocks, 4 Tiers, 5 Trésorerie, 6 Charges, 7 Produits.",
    nature: "ACTIF / PASSIF / TRESORERIE / CHARGES / PRODUITS — détermine le sens naturel du compte (débiteur ou créditeur) et sa place au bilan ou au compte de résultat.",
    fonction: "Référentiel de tous les comptes utilisables par le moteur comptable ; chaque écriture doit obligatoirement pointer sur un numéro de compte existant ici.",
    regle: "Un compte inactif ne peut plus recevoir de nouvelle écriture, mais son historique reste consultable.",
    referentiel: "Plan comptable SYSCOHADA révisé.",
    exemple: "Compte 701 « Ventes de marchandises » : nature PRODUITS, sens créditeur.",
  },
  saisie: {
    titre: "Écritures comptables",
    fonction: "Liste et détail de toutes les écritures (manuelles ou générées automatiquement par le moteur de règles) avec leurs lignes débit/crédit.",
    regle: "Toute écriture doit être équilibrée (total débit = total crédit) pour être créée. Statuts : BROUILLON (modifiable) → VALIDE (verrouillée, compte dans les états financiers) → CLOTURE (verrouillée définitivement par la clôture d'exercice). Une écriture VALIDE ne se corrige jamais directement : on la contrepasse.",
    referentiel: "CDC §11-13 — partie double, statuts, contrepassation.",
    exemple: "Vente comptant 10 000 F : Dr 571 Caisse 10 000 / Cr 701 Ventes 10 000.",
  },
  journal: {
    titre: "Journal",
    nature: "Journal opérationnel (mouvements de caisse/banque/ventes/achats/paie tels que vécus par les métiers), distinct des « Journaux comptables » de l'onglet Écritures/Règles.",
    fonction: "Vue chronologique des flux financiers par catégorie, pour rapprocher rapidement l'activité métier et les écritures correspondantes.",
    exemple: "Filtrer « Journal des Ventes » pour retrouver l'origine d'une écriture 701.",
  },
  tresorerie: {
    titre: "Trésorerie",
    compte: "Classe 5 (521 Banque, 571 Caisse...).",
    nature: "TRESORERIE — sens débiteur.",
    fonction: "Suivi des soldes et mouvements des comptes de caisse et de banque, dérivés des écritures validées.",
    referentiel: "CDC §38 — flux de trésorerie.",
    exemple: "Un solde 571 négatif signale une caisse en anomalie à investiguer.",
  },
  balance: {
    titre: "Balance des comptes",
    fonction: "Récapitule, pour chaque compte, le total des débits, des crédits et le solde sur la période — le contrôle de cohérence de base de toute comptabilité (total débits = total crédits).",
    regle: "Calculée uniquement à partir des lignes d'écritures VALIDE/CLOTURE, jamais des modules métier directement (CDC §75).",
    referentiel: "SYSCOHADA — balance générale.",
    exemple: "Si le total débit ≠ total crédit sur la balance générale, une écriture déséquilibrée existe (normalement impossible, le moteur le refuse à la création).",
  },
  grandlivre: {
    titre: "Grand livre",
    fonction: "Détail chronologique de toutes les lignes d'écriture d'un compte donné, avec calcul du solde progressif — permet de justifier n'importe quel solde de la balance ligne par ligne.",
    referentiel: "SYSCOHADA — grand livre.",
    exemple: "Ouvrir le grand livre du compte 411 pour retrouver toutes les factures clients non soldées.",
  },
  tva: {
    titre: "TVA",
    compte: "4431 TVA collectée (vente) / 4451 TVA déductible (achat).",
    nature: "PASSIF (collectée) / ACTIF (déductible).",
    fonction: "Décompose automatiquement le montant TTC de chaque vente en HT + TVA selon le taux actif configuré (TaxeConfig), et suit la TVA collectée à reverser.",
    regle: "Le taux appliqué est celui de la TaxeConfig active de nature TVA/applicableVente=true au moment de la vente — jamais un taux câblé en dur dans le code.",
    referentiel: "CDC §21 — taxes génériques paramétrables ; fiscalité togolaise.",
    exemple: "Vente TTC 11 800 F à 18% → HT 10 000 / TVA collectée 1 800.",
  },
  rapprochement: {
    titre: "Rapprochement bancaire",
    fonction: "Compare le solde comptable du compte 521 Banque avec le relevé bancaire réel, et propose un appariement ligne à ligne des mouvements pour identifier les écarts (chèques non débités, frais bancaires non saisis, etc.).",
    referentiel: "CDC §19 — rapprochement bancaire.",
    exemple: "Un mouvement présent sur le relevé mais absent des écritures signale des frais bancaires à régulariser par une écriture OD.",
  },
  etats: {
    titre: "États financiers",
    fonction: "Bilan, compte de résultat, tableau de flux et notes annexes calculés exclusivement depuis les soldes de comptes validés — jamais saisis manuellement ni recalculés depuis les modules opérationnels.",
    regle: "Un exercice non clôturé affiche son résultat comme « Résultat provisoire (non clôturé) » pour que le bilan reste équilibré à tout instant.",
    referentiel: "CDC §33-39 — Bilan/CPC/TFT/Notes annexes ; SYSCOHADA révisé.",
    exemple: "Le Bilan au 31/12 d'un exercice clôturé n'affiche plus de résultat provisoire : il a été absorbé dans les comptes 131/132 par l'écriture de clôture.",
  },
  pieces: {
    titre: "Pièces justificatives",
    fonction: "Rattache un document (facture, reçu, bon de livraison scanné...) à une écriture comptable pour garantir la traçabilité et l'auditabilité de chaque mouvement.",
    referentiel: "CDC — piste d'audit, conservation des pièces justificatives.",
    exemple: "Joindre le PDF de la facture fournisseur à l'écriture d'achat correspondante.",
  },
  regles: {
    titre: "Règles comptables",
    fonction: "Moteur central : associe chaque type d'événement métier (vente validée, paie versée, remboursement confirmé...) à un compte débit et un compte crédit, avec conditions optionnelles (produit, famille, mode de paiement) et priorité.",
    regle: "S'il n'existe pas de règle personnalisée active pour un événement, le moteur retombe automatiquement sur une règle par défaut (comportement historique conservé, zéro régression). Jamais de comptes câblés en dur dans le code applicatif.",
    referentiel: "CDC §7-8 — moteur de règles comptables paramétrable, intégration modules ; §75/§81 principe cardinal.",
    exemple: "Règle « VENTE_CREDIT_VALIDEE » : Dr 411 Client / Cr 701 Ventes, priorité 10.",
  },
  auxiliaire: {
    titre: "Auxiliaire & Lettrage",
    compte: "411 Clients / 401 Fournisseurs (comptes collectifs) rattachés à un tiers précis (compte auxiliaire).",
    fonction: "Suit le solde de chaque client/fournisseur individuellement, et permet le lettrage : rapprocher une facture (débit) avec son règlement (crédit) pour marquer la créance/dette comme soldée.",
    referentiel: "CDC §16-18 — comptes auxiliaires, lettrage.",
    exemple: "Lettrer la facture client #123 (Dr 411) avec le règlement reçu le mois suivant (Cr 411) : les deux lignes portent alors la même lettre et disparaissent des impayés.",
  },
  immobilisations: {
    titre: "Immobilisations",
    compte: "Classe 2 (ex. 2411 Matériel) + 28xx Amortissements cumulés + 68x Dotations aux amortissements.",
    nature: "ACTIF (immobilisation) / CHARGES (dotation).",
    fonction: "Suit chaque bien durable (acquisition, durée d'amortissement, méthode) et génère automatiquement l'écriture de dotation aux amortissements période par période.",
    regle: "Dr 68x Dotation / Cr 28x Amortissement cumulé, au prorata de la durée de vie restante.",
    referentiel: "CDC §22 — immobilisations et amortissements ; SYSCOHADA (linéaire/dégressif).",
    exemple: "Véhicule acheté 6 000 000 F, amorti sur 5 ans → dotation annuelle 1 200 000 F.",
  },
  analytique: {
    titre: "Analytique & Budget",
    fonction: "Ventile les charges/produits sur des axes analytiques (PDV, projet, département...) indépendamment du plan comptable général, et compare les réalisations au budget prévisionnel.",
    referentiel: "CDC §24-25 — comptabilité analytique 5 axes, budget.",
    exemple: "Affecter une charge de transport à la section analytique « PDV Lomé-Centre » pour mesurer sa rentabilité propre.",
  },
  etatsReels: {
    titre: "États financiers (réel)",
    fonction: "Version enrichie des états financiers avec indicateurs de gestion réels (ratios, ventilations détaillées) toujours dérivés des écritures validées.",
    referentiel: "CDC §33-39 et §71-72 — états financiers et rapports de gestion.",
  },
  controles: {
    titre: "Contrôles de cohérence",
    fonction: "Détecte automatiquement les anomalies : écritures déséquilibrées (normalement impossibles), doublons de référence, comptes d'attente non soldés, écarts de balance.",
    referentiel: "CDC §40-42 — contrôles de cohérence, comptes d'attente, détection de doublons.",
    exemple: "Un compte d'attente 47 non soldé depuis plusieurs mois doit être investigué et régularisé.",
  },
  exercices: {
    titre: "Exercices, Taxes & Récurrentes",
    fonction: "Regroupe trois briques : (1) ouverture/clôture d'exercice comptable avec report à nouveau automatique des soldes, (2) configuration des taxes génériques paramétrables (TVA, autres), (3) écritures récurrentes (ex. loyer mensuel) générées automatiquement à échéance.",
    regle: "La clôture d'un exercice génère deux écritures VALIDE : solde des comptes de charges/produits vers le résultat (131/132), puis report des soldes de bilan sur le nouvel exercice. Après clôture, plus aucune écriture ne peut être créée sur la période clôturée.",
    referentiel: "CDC §21 (taxes), §26 (récurrentes), §28-32 (exercices/report à nouveau).",
    exemple: "Clôturer 2024 : le résultat net de l'année est viré en 131/132, et les comptes de bilan (411, 401, 521...) rouvrent avec leur solde de clôture au 01/01/2025.",
  },
  importEcritures: {
    titre: "Import comptable",
    fonction: "Importe en masse des écritures depuis un fichier externe (migration, reprise d'historique, export d'un autre logiciel) avec validation ligne par ligne avant intégration définitive.",
    referentiel: "CDC §46-47 — import/export comptable.",
    exemple: "Reprendre le solde d'ouverture d'un ancien logiciel comptable via un import structuré plutôt qu'une ressaisie manuelle compte par compte.",
  },
  rapportsGestion: {
    titre: "Rapports de gestion",
    fonction: "Indicateurs de pilotage dérivés de la comptabilité et des ventes : chiffre d'affaires et marge par PDV/produit/famille, rentabilité par agence, rotation des stocks, délai de recouvrement clients (DSO).",
    regle: "La marge n'est calculée que lorsque le prix d'achat du produit est connu (`Produit.prixAchat` renseigné) — sinon signalée explicitement comme non disponible plutôt que d'être estimée à tort.",
    referentiel: "CDC §71-72 — rapports de gestion détaillés.",
    exemple: "Un DSO de 45 jours signifie qu'il faut en moyenne 45 jours pour encaisser une créance client après la vente.",
  },
};
