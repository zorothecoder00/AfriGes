# Documentation Architecture Base de Données — AfriGes

> **Technologie :** PostgreSQL · Prisma ORM · Next.js 15 App Router
> **Date :** 28 mai 2026

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Utilisateurs & Authentification](#2-utilisateurs--authentification)
3. [Points de Vente & Dépôts](#3-points-de-vente--dépôts)
4. [Clients](#4-clients)
5. [Crédits Clients](#5-crédits-clients)
6. [Produits & Stock](#6-produits--stock)
7. [Caisse & Ventes](#7-caisse--ventes)
8. [Packs & Collectes Terrain](#8-packs--collectes-terrain)
9. [Programme de Fidélité](#9-programme-de-fidélité)
10. [Finance & Comptabilité](#10-finance--comptabilité)
11. [Contrôle Terrain](#11-contrôle-terrain)
12. [Actionnaires & Gouvernance](#12-actionnaires--gouvernance)
13. [Système & Transversal](#13-système--transversal)
14. [Schéma des flux principaux](#14-schéma-des-flux-principaux)
15. [Résumé chiffré](#15-résumé-chiffré)

---

## 1. Vue d'ensemble

AfriGes est une plateforme de gestion commerciale multi-sites (points de vente, dépôts) qui couvre l'ensemble du cycle de vie d'une entreprise de distribution :

```
Utilisateurs & Rôles
        ↓
Clients → Stock → Ventes → Caisse
        ↓
Crédits & Packs épargne
        ↓
Comptabilité → Gouvernance actionnariale
```

La base repose sur **PostgreSQL** avec **Prisma ORM**. Elle est organisée en **12 domaines métier** distincts mais interconnectés, pour un total d'environ **73 modèles**.

---

## 2. Utilisateurs & Authentification

### `User`

Le modèle central de toute la plateforme. Chaque personne (admin, gestionnaire, client enregistré) est un `User`.

| Champ | Type | Rôle |
|---|---|---|
| `uuid` | String (unique) | Identifiant public exposable (vs `id` interne) |
| `role` | Role | Niveau d'accès système : `SUPER_ADMIN`, `ADMIN`, `USER` |
| `etat` | MemberStatus | Cycle de vie : ACTIF, INACTIF, SUSPENDU, BLOQUÉ, EN_ATTENTE_VALIDATION, REJETÉ |
| `tokenVersion` | Int | Sécurité : incrémenté à chaque déconnexion forcée pour invalider les JWT |
| `mustChangePassword` | Boolean | Force le changement de mot de passe à la prochaine connexion |

**Liens sortants importants :** Un `User` peut être lié à un `Gestionnaire` (son profil opérationnel), un `Wallet` (sa bourse électronique), des `Notification[]`, des `AuditLog[]`.

---

### `Gestionnaire`

Profil opérationnel associé à un `User`. Relation 1-1 (`@unique` sur `memberId`).

| Champ | Type | Rôle |
|---|---|---|
| `role` | RoleGestionnaire | Rôle métier parmi 18 valeurs possibles |
| `zone` | String? | Zone géographique de couverture |
| `actionnaireProfile` | relation | Profil actions si le gestionnaire est actionnaire |

**Les 18 rôles gestionnaire disponibles :**

| Rôle | Description |
|---|---|
| `RESPONSABLE_POINT_DE_VENTE` (RPV) | Responsable d'un PDV |
| `CHEF_AGENCE` | Supervise plusieurs PDVs |
| `RESPONSABLE_COMMUNAUTE` | Chef agence communautaire |
| `CAISSIER` | Gestion de la grande caisse |
| `MAGAZINIER` | Gestion du stock physique |
| `AGENT_LOGISTIQUE_APPROVISIONNEMENT` | Réceptions & transferts stock |
| `COMPTABLE` | Saisie & validation comptable |
| `AGENT_TERRAIN` | Ventes et collectes terrain |
| `COMMERCIAL` | Développement commercial |
| `CONTROLEUR_TERRAIN` | Missions de contrôle PDV |
| `RESPONSABLE_VENTE_CREDIT` (RVC) | Validation des crédits clients |
| `AUDITEUR_INTERNE` | Audit interne |
| `RESPONSABLE_ECONOMIQUE` | Analyse économique |
| `RESPONSABLE_MARKETING` | Marketing |
| `ACTIONNAIRE` | Associé / actionnaire |
| `REVENDEUR` | Revendeur partenaire |
| `ADMIN` | Administration plateforme |
| `SUPER_ADMIN` | Accès total |

---

### `GestionnaireAffectation`

Table de jonction qui **affecte un User à un Point de Vente** pour une période donnée.

```
User ──────────────── GestionnaireAffectation ──────── PointDeVente
(caissier, magasinier,    [dateDebut, dateFin, actif]   (PDV ou dépôt)
 agent, etc.)
```

> Un user peut être ré-affecté au même PDV après une période d'absence. L'unicité de l'affectation active est gérée applicativement (`actif = true`).

---

## 3. Points de Vente & Dépôts

### `PointDeVente`

Représente un **point de vente classique** ou un **dépôt central**. C'est le pivot géographique de toutes les opérations.

| Champ | Type | Rôle |
|---|---|---|
| `type` | TypePointDeVente | `POINT_DE_VENTE` ou `DEPOT_CENTRAL` |
| `code` | String (unique) | Identifiant court (ex: "PDV-001") |
| `rpvId` | Int? (unique) | Responsable du PDV — relation 1-1 exclusive |
| `chefAgenceId` | Int? | Chef d'agence superviseur (1 chef → N PDVs) |
| `actif` | Boolean | Permet de désactiver sans supprimer |

**Relations opérationnelles agrégées sur chaque PDV :**

- `stocks[]` — stock de chaque produit sur ce site
- `sessionsCaisse[]` — sessions caisse du caissier
- `caissesPDV[]` — petites caisses RPV
- `ventesDirectes[]` — toutes les ventes
- `mouvementsStock[]` — journal des mouvements
- `inventaires[]` — inventaires physiques
- `receptionsAppro[]` — réceptions fournisseurs / internes
- `collectes[]` — collectes terrain
- `transfertsOrigine[]` / `transfertsDestination[]` — transferts inter-sites

---

## 4. Clients

### `Client`

Modèle riche couvrant le cycle complet : prospection terrain → validation → suivi commercial → crédit.

| Champ | Type | Rôle |
|---|---|---|
| `codeClient` | String? (unique) | Code auto-généré (ex: CLI-00042) |
| `typeClient` | TypeClient? | `COMPTANT` ou `CREDIT` |
| `etat` | MemberStatus | Cycle de vie du client |
| `limiteCredit` | Decimal? | Plafond de crédit accordé |
| `soldeActuel` | Decimal? | Encours crédit en temps réel |
| `niveauRisque` | NiveauRisque? | FAIBLE / MOYEN / ELEVE / CRITIQUE |
| `scoreSolvabilite` | Float? | Score 0–100 calculé automatiquement |
| `latitude` / `longitude` | Float? | Géolocalisation du commerce |
| `pointDeVenteId` | Int? | PDV de rattachement principal |
| `agentTerrainId` | Int? | Agent terrain actuellement responsable |
| `validationParId` | Int? | RVC qui a statué (validé ou rejeté) |
| `motifRejet` | String? | Raison du rejet par le RVC |

**Cycle de validation d'un nouveau client :**

```
Agent terrain crée le client (etat = EN_ATTENTE_VALIDATION)
        ↓
RVC examine le dossier
        ↓
        ├── Accepte → etat = ACTIF (dateValidation enregistrée)
        └── Rejette → etat = REJETE (motifRejet renseigné)
```

---

### `ClientAgentAffectation`

Historique des affectations client ↔ agent terrain. Permet de calculer le chiffre d'affaires par agent sur la **période exacte** où il était responsable, sans double-comptage lors des réaffectations.

---

### `ClientPointDeVente`

Table de jonction N-M : un client peut être rattaché à **plusieurs PDVs** (multicanalité).

---

### `VisiteClient`

Enregistrement d'une visite d'un agent terrain chez un client : date, coordonnées GPS, statut, notes.

---

### `ClientDocument`

Stockage des pièces justificatives du client.

| Champ | Rôle |
|---|---|
| `type` | CNI, PASSEPORT, CONTRAT, PHOTO_IDENTITE, ATTESTATION, RECU, AUTRE |
| `url` | URL de stockage du fichier |
| `expireAt` | Date d'expiration (ex: validité CNI) |
| `uploadePar` | Traçabilité : qui a uploadé le document |

---

### `ClientTransaction`

**Historique financier unifié** du client. Agrège toutes ses transactions (versements pack, remboursements crédit, ventes, collectes). Utilise un lien polymorphique (`sourceType` + `sourceId`) pour pointer vers la source sans contrainte de clé étrangère stricte.

---

### `ClientScoreHistorique`

Chaque recalcul du score de solvabilité crée une nouvelle entrée → permet de visualiser l'évolution du risque dans le temps et d'en comprendre les causes (`raison` : REMBOURSEMENT, RETARD, RECALCUL_AUTO, MANUEL, CREATION).

---

## 5. Crédits Clients

### `CreditClient`

Crédit accordé à un client pour l'achat de produits.

| Champ | Type | Rôle |
|---|---|---|
| `reference` | String (unique) | Référence unique (ex: CRD-20260521-001) |
| `statut` | StatutCredit | Workflow complet (voir ci-dessous) |
| `montantTotal` | Decimal | Montant total du crédit |
| `montantRembourse` | Decimal | Cumul des remboursements reçus |
| `soldeRestant` | Decimal | Solde encore dû |
| `dureeJours` | Int | Durée de remboursement en jours |
| `montantJournalier` | Decimal | Montant dû chaque jour (calculé à la validation) |
| `tauxPenalite` | Decimal | % de pénalité par jour de retard |
| `creeParId` | Int | Agent qui a créé le crédit |
| `valideParId` | Int? | RVC qui a validé ou rejeté |

**Workflow d'un crédit :**

```
EN_ATTENTE_VALIDATION → VALIDE → ACTIF → EN_RETARD (si impayé)
                                        → SOLDE (si tout remboursé)
                      → REJETE (refusé par RVC)
                      → ANNULE (avant démarrage)
```

---

### `LigneCreditClient`

Détail des produits inclus dans le crédit. Conserve un **snapshot** des prix au moment de la vente (même si le produit est modifié ensuite en catalogue).

---

### `EcheanceCredit`

Échéancier journalier automatiquement généré : une ligne par jour de remboursement.

| Champ | Rôle |
|---|---|
| `numeroEcheance` | Numéro du jour (1, 2, 3… dureeJours) |
| `dateEcheance` | Date prévue du paiement |
| `montantDu` | Montant attendu ce jour |
| `montantPaye` | Montant effectivement reçu |
| `penalite` | Pénalité accumulée si retard |
| `statut` | EN_ATTENTE / PAYE / PARTIEL / EN_RETARD |

---

### `RemboursementCredit`

Chaque paiement effectué par le client, avec le mode de paiement et l'agent encaisseur.

**Flux global du module crédit :**

```
CreditClient (1) ──→ LigneCreditClient[]  (produits achetés)
             (1) ──→ EcheanceCredit[]     (calendrier de remboursement)
             (1) ──→ RemboursementCredit[] (paiements reçus)
```

---

## 6. Produits & Stock

### `Produit`

Catalogue produits : référence, catégorie, unité de mesure, prix de vente, prix d'achat, seuil d'alerte global.

---

### `StockSite`

**Stock localisé** : quantité d'un produit sur un site précis. Clé composite unique `(produitId, pointDeVenteId)`.

```
Produit (N) ──── StockSite ──── (N) PointDeVente
```

> Il n'existe pas de stock "global" — chaque quantité est attachée à un site.

---

### `MouvementStock`

Journal de tout mouvement de stock (entrée, sortie, ajustement). Chaque ligne est tracée avec :

- `typeEntree` : RECEPTION_FOURNISSEUR, RECEPTION_INTERNE, TRANSFERT_ENTRANT, AJUSTEMENT_POSITIF, RETOUR_CLIENT
- `typeSortie` : VENTE_DIRECTE, LIVRAISON_PACK, LIVRAISON_CLIENT, RETOUR_FOURNISSEUR, CONSOMMATION_INTERNE, TRANSFERT_SORTANT, AJUSTEMENT_NEGATIF, PERTE, CASSE, DON
- Références aux documents sources : `receptionApproId`, `transfertStockId`, `venteDirecteId`, `souscriptionId`, `bonSortieId`

---

### `Fournisseur`

Référentiel des fournisseurs externes (nom, contact, téléphone, email, adresse).

---

### `ReceptionApprovisionnement` + `LigneReceptionAppro`

Document de réception de marchandises.

| Type | Description |
|---|---|
| `FOURNISSEUR` | Marchandises reçues d'un fournisseur externe |
| `INTERNE` | Transfert depuis un autre dépôt ou le siège |

**Workflow :** BROUILLON → EN_COURS → RECU → VALIDE (contrôle qualité obligatoire avant mise en stock)

---

### `TransfertStock` + `LigneTransfertStock`

Mouvement de stock entre deux PDVs ou dépôts. Nécessite une validation.

**Workflow :** EN_COURS → EXPEDIE → RECU

---

### `InventaireSite` + `LigneInventaireSite`

Comptage physique périodique. Chaque ligne compare :

| Champ | Description |
|---|---|
| `quantiteSysteme` | Quantité selon la base de données |
| `quantiteConstatee` | Quantité réellement comptée |
| `ecart` | `constatée - système` (positif = surplus, négatif = manquant) |

---

### `CommandeInterne` + `LigneCommandeInterne`

Demande de réapprovisionnement émise par un PDV vers le dépôt central.

**Workflow :** BROUILLON → SOUMISE → EN_COURS → COMPLETE

---

### `BonSortie` + `LigneBonSortie`

Document formel et auditable pour les sorties exceptionnelles : pertes, casses, dons, consommation interne. Document imprimable.

---

### `AnomalieStock`

Signalement d'un écart constaté par un magasinier.

| Type | Description |
|---|---|
| `MANQUANT` | Stock inférieur à ce qu'il devrait être |
| `SURPLUS` | Stock supérieur à ce qu'il devrait être |
| `DEFECTUEUX` | Produits endommagés |

**Workflow :** EN_ATTENTE → EN_COURS → TRAITEE / TRANSMISE

---

## 7. Caisse & Ventes

### `SessionCaisse` — Grande caisse (Caissier)

Session de travail quotidienne d'un caissier sur un PDV. Ouverte le matin, clôturée le soir.

**Contient :**
- `OperationCaisse[]` — encaissements et décaissements
- `TransfertCaisse[]` — mouvements inter-caisses
- `ClotureCaisse[]` — récapitulatif de fin de session
- `CaissePDV[]` — petites caisses RPV associées
- `VenteDirecte[]` — ventes passées dans cette session

---

### `CaissePDV` — Petite caisse (RPV)

Caisse opérationnelle du Responsable Point de Vente. Liée automatiquement à la grande caisse du caissier via `sessionCaisseId`.

```
SessionCaisse (grande caisse — Caissier)
      │
      └──── CaissePDV (petite caisse — RPV)
```

---

### `OperationCaisse` / `OperationCaissePDV`

Chaque encaissement ou décaissement dans la caisse correspondante.

| Champ | Rôle |
|---|---|
| `type` | ENCAISSEMENT ou DECAISSEMENT |
| `mode` | ESPECES, VIREMENT, CHEQUE, MOBILE_MONEY |
| `categorie` | SALAIRE, AVANCE, FOURNISSEUR, AUTRE (pour décaissements) |
| `reference` | Unique — pour audit |

---

### `TransfertCaisse`

Mouvement d'argent entre caisses (ex: le RPV verse le cash à la grande caisse en fin de journée).

---

### `ClotureCaisse`

Récapitulatif de fin de session : total ventes, montant, panier moyen, nb clients, solde théorique vs réel, écart. **Unique par session + PDV.**

---

### `VenteDirecte` + `LigneVenteDirecte`

Vente comptant ou à crédit, depuis n'importe quel rôle (RPV, agent terrain, admin).

| Champ | Rôle |
|---|---|
| `clientId` | Client enregistré (optionnel) |
| `clientNom` / `clientTelephone` | Client "walk-in" non enregistré |
| `modePaiement` | ESPECES, VIREMENT, CHEQUE, MOBILE_MONEY, WALLET, CREDIT |
| `caissePDVId` | Petite caisse RPV associée |
| `sessionCaisseId` | Grande caisse caissier associée |

**Statuts :**

```
BROUILLON → CONFIRMEE → PAID (comptant validé)
                      → CREDIT_REQUEST → CREDIT_APPROUVE (crédit accordé)
                                       → CREDIT_REFUSE (crédit refusé)
          → ANNULEE
```

---

## 8. Packs & Collectes Terrain

### `Pack`

Produit d'épargne proposé aux clients.

| Type | Description |
|---|---|
| `ALIMENTAIRE` | Épargne pour panier alimentaire |
| `REVENDEUR` | Pack pour revendeurs partenaires (Formule 1 ou 2) |
| `FAMILIAL` | Pack familial |
| `URGENCE` | Fond d'urgence |
| `EPARGNE_PRODUIT` | Épargne orientée vers l'achat d'un produit cible |
| `FIDELITE` | Pack fidélité avec points bonus |

---

### `SouscriptionPack`

Engagement d'un client (ou user) à un pack. Suit l'avancement financier en temps réel : `montantVerse`, `montantRestant`, `numeroCycle`, `bonusObtenu`.

---

### `VersementPack`

Chaque paiement effectué sur une souscription (cotisation initiale, versement périodique, remboursement, bonus, ajustement).

---

### `EcheancePack`

Calendrier prévisionnel des versements à effectuer, avec statut de chaque échéance.

---

### `ReceptionProduitPack` + `LigneReceptionPack`

Livraison physique des produits au client lorsque sa souscription est complète. Déclenche une sortie de stock au PDV concerné.

**Statuts :** PLANIFIEE → EN_ROUTE → LIVREE

---

### `CollecteJournaliere` + `LigneCollecte`

Session de tournée terrain d'un agent : il visite plusieurs clients et encaisse leurs versements.

| Champ | Rôle |
|---|---|
| `reference` | Unique (ex: COL-20260521-001) |
| `montantPrevu` | Somme théorique attendue |
| `montantCollecte` | Somme réellement encaissée |
| `statut` | EN_COURS → VALIDEE / ANNULEE |

**Anti-fraude sur `LigneCollecte` :** coordonnées GPS + mode de paiement enregistrés au moment de la collecte.

**Workflow :**

```
Agent ouvre CollecteJournaliere (EN_COURS)
    ↓ visite clients → crée LigneCollecte[] (avec GPS)
Admin valide (VALIDEE)
    ↓
Génération automatique des VersementPack correspondants
```

---

## 9. Programme de Fidélité

### `PointsFidelite`

Solde de points d'un client ou d'un user (unique par personne, `@unique` sur `userId` et `clientId`).

| Champ | Rôle |
|---|---|
| `solde` | Points disponibles actuellement |
| `totalGagne` | Cumul historique de points gagnés |
| `totalUtilise` | Cumul historique de points consommés |

---

### `MouvementPoints`

Historique de chaque variation de points : GAIN, UTILISATION, EXPIRATION, AJUSTEMENT.

---

### `RecompenseFidelite`

Catalogue des récompenses disponibles.

| Type | Description |
|---|---|
| `REDUCTION` | Réduction en valeur sur un achat |
| `PRODUIT_GRATUIT` | Produit offert (lié au catalogue `Produit`) |
| `CASHBACK` | Remboursement en argent |

---

### `UtilisationRecompense`

Enregistrement d'une récompense utilisée par un client : points consommés, date, statut (DISPONIBLE / UTILISEE / EXPIREE).

---

## 10. Finance & Comptabilité

### `Wallet`

Bourse électronique multi-compartiments d'un User.

| Compartiment | Rôle |
|---|---|
| `soldeGeneral` | Solde courant général |
| `soldeTontine` | Épargne tontine |
| `soldeCredit` | Provision pour remboursement crédit |

---

### `WalletTransaction`

Historique de chaque mouvement sur un wallet, avec type parmi : DEPOT, RETRAIT, COTISATION, TONTINE, REMBOURSEMENT_CREDIT, CREDIT, ACHAT, ANNULATION, VENTE.

---

### `Facture` + `Paiement`

Facturation interne. Une facture peut être payée en plusieurs fois. Types de factures : COTISATION, TONTINE, CREDIT, CREDIT_ALIMENTAIRE, ACHAT, VENTE_DIRECTE.

---

### Comptabilité SYSCOHADA

| Modèle | Rôle |
|---|---|
| `CompteComptable` | Plan comptable hiérarchique (auto-référentiel via `compteParentId`) |
| `EcritureComptable` | En-tête d'une écriture : journal, date, libellé, statut |
| `LigneEcriture` | Lignes débit/crédit de l'écriture (avec gestion TVA) |
| `JournalValidation` | Validation d'une écriture par un comptable autorisé |
| `RapprochementBancaire` | Comparaison mensuelle solde bancaire réel vs solde comptable |
| `DeclarationTVA` | Déclaration mensuelle : TVA collectée − TVA déductible = TVA due |
| `ClotureComptable` | Fermeture comptable mensuelle (unique par année + mois) |

**Journaux comptables disponibles :** CAISSE, BANQUE, VENTES, ACHATS, OD (Opérations Diverses), PAIE

**Plan comptable :** structure hiérarchique avec `compteParentId` permettant des regroupements et sous-comptes illimités.

---

## 11. Contrôle Terrain

### `VisiteControle`

Mission de contrôle planifiée par un `CONTROLEUR_TERRAIN` sur un PDV ou en multi-sites.

**Workflow :** PLANIFIEE → EN_COURS → TERMINEE / ANNULEE

---

### `RapportControle`

Rapport rédigé à l'issue de la visite : titre, contenu, recommandations, liste de destinataires (ex: `"ADMIN,CHEF_AGENCE"`).

---

### `AlerteRapport`

Alertes attachées à un rapport, permettant l'escalade automatique des anomalies graves.

| Niveau | Description |
|---|---|
| `INFO` | Information simple |
| `ATTENTION` | Anomalie à surveiller |
| `CRITIQUE` | Anomalie grave nécessitant action immédiate |

---

## 12. Actionnaires & Gouvernance

### `ActionnaireProfile`

Profil d'actionnaire d'un gestionnaire : nombre d'actions, type d'action, prix unitaire, date d'entrée au capital.

| Type d'action | Description |
|---|---|
| `ORDINAIRE` | Action standard |
| `PRIVILEGIEE` | Droits renforcés |
| `FONDATEUR` | Action des fondateurs |
| `PREFERENTIELLE` | Dividende préférentiel |

---

### `MouvementAction`

Historique des transactions sur les actions : ACHAT, CESSION, TRANSFERT_ENTRANT, TRANSFERT_SORTANT, AJUSTEMENT.

---

### `Dividende`

Déclaration de dividendes périodiques : montant total, montant par part, date de versement.

**Workflow :** PLANIFIE → EN_COURS → VERSE / ANNULE

---

### `Assemblee`

Assemblée générale avec ordre du jour et lieu.

| Type | Description |
|---|---|
| `AGO` | Assemblée Générale Ordinaire |
| `AGE` | Assemblée Générale Extraordinaire |
| `CS` | Conseil de Surveillance |
| `CA` | Conseil d'Administration |

---

### `AssembleeParticipant`

Participation d'un gestionnaire à une assemblée.

**Statuts :** INVITE → CONFIRME → PRESENT / ABSENT

---

### `ResolutionAssemblee` + `VoteAssemblee`

Chaque résolution soumise au vote est enregistrée. Chaque vote est individuel et tracé.

| Décision | Description |
|---|---|
| `POUR` | Vote favorable |
| `CONTRE` | Vote défavorable |
| `ABSTENTION` | Ni pour ni contre |

---

### `ProcurationAssemblee`

Un actionnaire absent mandate un autre pour voter en son nom.

**Statuts :** EN_ATTENTE → ACCEPTEE / REFUSEE / REVOQUEE

---

## 13. Système & Transversal

| Modèle | Rôle |
|---|---|
| `Notification` | Notifications push internes (priorité URGENT/HAUTE/NORMAL/BASSE, lien `actionUrl`) |
| `AuditLog` | Journal complet de toutes les actions : qui, quoi, quand, depuis quelle IP, depuis quel appareil |
| `Message` | Messagerie interne utilisateur à utilisateur, avec support de fils de discussion (`parentId` auto-référentiel) |
| `PieceJustificative` | Stockage centralisé de documents via lien polymorphique (`sourceType` + `sourceId`) |
| `UserPermission` | Permissions granulaires par utilisateur et par module (surcharge les droits du rôle) |
| `RolePageAccess` | Configuration de l'accès aux pages par rôle gestionnaire (administrable par Super Admin) |
| `SystemModule` | Activation / désactivation de modules entiers de la plateforme |
| `SystemSetting` | Paramètres globaux clé-valeur de la plateforme |
| `SecurityLog` | Journal de sécurité : connexions réussies, échecs, déconnexions forcées |
| `DocumentBibliotheque` | Bibliothèque documentaire publique : bilans, PV d'AG, statuts, rapports annuels |
| `Parametre` | Paramètres simples clé-valeur (usage ciblé) |

---

## 14. Schéma des flux principaux

```
AGENT TERRAIN
    ├── crée Client (EN_ATTENTE_VALIDATION)
    │         └──→ RVC valide ──→ Client (ACTIF)
    │
    ├── ouvre CollecteJournaliere (EN_COURS)
    │         └── LigneCollecte[] (GPS + mode paiement)
    │                  └──→ Admin valide ──→ VersementPack généré
    │
    ├── enregistre VisiteClient (coordonnées GPS, notes)
    │
    └── crée VenteDirecte (CREDIT_REQUEST)
              └──→ RVC approuve ──→ CreditClient (ACTIF)
                       ├── LigneCreditClient[] (produits)
                       ├── EcheanceCredit[] (calendrier)
                       └── RemboursementCredit[] (paiements)

CAISSIER
    ├── ouvre SessionCaisse
    │         ├── OperationCaisse[] (encaissements / décaissements)
    │         ├── TransfertCaisse[] (mouvements inter-caisses)
    │         └──→ ClotureCaisse (solde théorique vs réel)

RPV
    ├── ouvre CaissePDV
    │         └── OperationCaissePDV[]
    └── fait VenteDirecte (PAID)
              ├── LigneVenteDirecte[]
              └──→ MouvementStock (SORTIE → met à jour StockSite)

MAGASINIER
    ├── réceptionne ReceptionApprovisionnement (VALIDE)
    │         └──→ MouvementStock (ENTREE → met à jour StockSite)
    ├── fait InventaireSite
    │         └── LigneInventaireSite (écart système vs réel)
    └── signale AnomalieStock (MANQUANT / SURPLUS / DEFECTUEUX)

AGENT LOGISTIQUE
    └── crée TransfertStock (PDV A → PDV B)
              └──→ MouvementStock SORTIE (PDV A) + ENTREE (PDV B)

COMPTABLE
    ├── saisit EcritureComptable ──→ LigneEcriture[] (débit / crédit)
    ├── fait RapprochementBancaire (mensuel)
    ├── soumet DeclarationTVA (mensuelle)
    └── clôture ClotureComptable (fin de période)

CONTROLEUR TERRAIN
    ├── planifie VisiteControle sur un PDV
    └── rédige RapportControle + AlerteRapport[]

ACTIONNAIRE / GESTIONNAIRE
    ├── participe Assemblee ──→ VoteAssemblee (POUR / CONTRE / ABSTENTION)
    ├── donne ProcurationAssemblee si absent
    └── reçoit Dividende (versé périodiquement)
```

---

## 15. Résumé chiffré

| Domaine | Modèles principaux | Total modèles |
|---|---|---|
| Auth & Utilisateurs | User, Gestionnaire, GestionnaireAffectation | 3 |
| Points de vente | PointDeVente | 1 |
| Clients | Client, VisiteClient, ClientAgentAffectation, ClientPointDeVente, ClientDocument, ClientTransaction, ClientScoreHistorique | 7 |
| Crédits | CreditClient, LigneCreditClient, EcheanceCredit, RemboursementCredit | 4 |
| Produits & Stock | Produit, StockSite, MouvementStock, Fournisseur, ReceptionApprovisionnement, TransfertStock, InventaireSite, CommandeInterne, BonSortie, AnomalieStock + lignes | 11 |
| Caisse & Ventes | SessionCaisse, CaissePDV, OperationCaisse, OperationCaissePDV, TransfertCaisse, ClotureCaisse, VenteDirecte + ligne | 8 |
| Packs & Collectes | Pack, SouscriptionPack, VersementPack, EcheancePack, ReceptionProduitPack, CollecteJournaliere + lignes | 8 |
| Fidélité | PointsFidelite, MouvementPoints, RecompenseFidelite, UtilisationRecompense | 4 |
| Finance & Comptabilité | Wallet, WalletTransaction, Facture, Paiement, CompteComptable, EcritureComptable, LigneEcriture, JournalValidation, RapprochementBancaire, DeclarationTVA, ClotureComptable | 11 |
| Contrôle Terrain | VisiteControle, RapportControle, AlerteRapport | 3 |
| Actionnaires & Gouvernance | ActionnaireProfile, MouvementAction, Dividende, Assemblee, AssembleeParticipant, ResolutionAssemblee, VoteAssemblee, ProcurationAssemblee | 8 |
| Système & Transversal | Notification, AuditLog, Message, PieceJustificative, UserPermission, RolePageAccess, SystemModule, SystemSetting, SecurityLog, DocumentBibliotheque, Parametre | 11 |
| **TOTAL** | | **~79 modèles** |

---

*Documentation générée à partir du schema Prisma — AfriGes v1.0*
