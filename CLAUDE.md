# AfriGes — Contexte projet pour Claude Code

Plateforme de gestion intégrée pour AfriSime (supermarché hybride + activité communautaire de
financement solidaire par packs/souscriptions). Ce fichier consolide l'état du projet pour éviter
de reconstruire le contexte à chaque session. Voir aussi `README.md` (stack/API par rôle) et
`docs/architecture-base-de-donnees.md` (schéma DB).

## Stack & conventions de base

- Next.js 15+ App Router, TypeScript, Prisma ORM, PostgreSQL (Neon)
- Tailwind CSS, police DM Sans, toasts Sonner
- NextAuth (credentials + Google) — session avec `nom`, `prenom`, `name`, `id`, `role`
- Hooks `useApi<T>()` (GET) et `useMutation<TData, TBody>()` (POST/PUT/PATCH/DELETE) dans `hooks/useApi.ts`
- Auth helpers par rôle gestionnaire : `lib/authCaissier.ts`, `lib/authRPV.ts`, `lib/authComptable.ts`,
  `lib/authMagasinier.ts`, `lib/authLogistique.ts`, `lib/authAgentTerrain.ts` (pattern `get<Role>Session()`)
- Notifications centralisées (`lib/notifications.ts`), à utiliser **dans les transactions** :
  `notifyRoles(tx, [...], {titre, message, priorite, actionUrl})`, `notifyAdmins(tx, payload)`,
  `notifyGestionnaires(tx, roles, payload)`, `auditLog(tx, userId, action, entite, entiteId?)`
- Identité société centralisée : `lib/societe.ts` (RCCM/NIF/baseline/coordonnées) — ne jamais réécrire en dur
- Routes dynamiques Next 15 : les `params` sont une Promise, toujours `await` :
  ```typescript
  type Ctx = { params: Promise<{ id: string }> };
  export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params;
  }
  ```

### Rôles système
- `Role` (User) : `SUPER_ADMIN`, `ADMIN`, `USER`
- `RoleGestionnaire` : `RESPONSABLE_POINT_DE_VENTE`, `CHEF_AGENCE`, `CAISSIER`, `COMPTABLE`,
  `MAGAZINIER`, `AGENT_LOGISTIQUE_APPROVISIONNEMENT`, `AGENT_TERRAIN`, `COMMERCIAL`,
  `CONTROLEUR_TERRAIN`, `RESPONSABLE_VENTE_CREDIT`, `RESPONSABLE_COMMUNAUTE`,
  `RESPONSABLE_ECONOMIQUE`, `RESPONSABLE_MARKETING`, `ACTIONNAIRE`, `REVENDEUR`, `AUDITEUR_INTERNE`, etc.

### Matrice de notification (extrait)
| Action | Admin | RPV | Caissier | Magasinier | Logistique | Comptable |
|---|---|---|---|---|---|---|
| Vente caissier | ✓ | ✓ | - | ✓ | - | ✓ |
| Clôture caisse | ✓ | ✓(H) | - | - | - | ✓ |
| Mouvement stock RPV | ✓ | - | - | ✓ | ✓ | - |
| Produit créé/modifié | ✓ | - | - | ✓ | ✓ | - |
| Produit supprimé | ✓(H) | - | - | ✓(H) | ✓(H) | - |
| Livraison planifiée/validée | ✓ | - | - | ✓ | ✓ | (validée: ✓) |
| Livraison annulée | ✓(H) | - | - | ✓(H) | ✓(H) | - |
| Réception logistique | ✓ | ✓ | - | ✓ | - | - |
| Affectation stock | ✓ | ✓ | - | ✓ | - | - |
| Ajustement magasinier | ✓ | ✓ | - | - | ✓ | - |
| Vente admin | ✓ | ✓ | ✓ | ✓ | - | ✓ |

(H = priorité HAUTE)

## Règles de code impératives

- **Apostrophes JSX** : toujours échapper `'` → `&apos;` dans le texte JSX (sinon erreur ESLint
  `react/no-unescaped-entities`).
- **Frontière client/serveur Prisma** : une lib importée côté client ne doit jamais importer `prisma`
  ni faire d'import valeur de `@prisma/client` → pattern lib pure + fichier `*Server.ts` séparé.
- **Vérification qualité** : `npm run build` (Next build complet) est **abandonné sur ce poste**
  (trop de plantages Turbopack/RAM). Le contrôle qualité standard est `tsc --noEmit` + `eslint` en
  arrière-plan, sans polling serré — vigilance manuelle requise sur la frontière client/serveur
  Prisma que le build attrapait auparavant.
- **Espacer les vérifications** : ne pas lancer de build/vérif lourde après chaque petite modif ;
  batcher plusieurs fichiers/pages avant de vérifier (surtout pendant une refonte UI module par module).
- **Migrations Neon** : `migrate deploy` doit viser le host Neon direct **sans** `-pooler`
  (l'advisory lock échoue sur le pooler → erreur P1002). Libérer un lock zombie via
  `pg_terminate_backend` si besoin.
- **Migrations Prisma en général** : l'utilisateur les gère lui-même — ne jamais avertir/bloquer dessus.

## Préférences de collaboration

- Pas de warnings sur les migrations (l'utilisateur gère ça lui-même).
- OK pour ajouter des fonctionnalités utiles non demandées explicitement, si elles servent le CDC.
- Ne pas lancer plusieurs tâches lourdes en parallèle sans raison (le poste peut être limité).
- Pendant la refonte UI (design system), avancer page par page / module par module, pas en un seul gros lot.

## Architecture — décisions majeures

- **Points de vente** : `PointDeVente` (type `POINT_DE_VENTE` ou `DEPOT_CENTRAL`), avec RPV
  (`rpvId`) et chef d'agence (`chefAgenceId`). Les autres gestionnaires sont liés via
  `GestionnaireAffectation`. `Client.pointDeVenteId` optionnel.
- **Stock localisé** : pas de champ `stock` global sur `Produit` → `StockSite` (produitId,
  pointDeVenteId) → quantite. Tous les `StockSite` additionnés = stock global entreprise.
  `MouvementStock` référence toujours un `pointDeVenteId` + `typeEntree`/`typeSortie`.
- **Hiérarchie des caisses** : `SessionCaisse` = grande caisse du caissier (liée au PDV) ;
  `CaissePDV` = petite caisse du RPV (liée à une `SessionCaisse`) ; `VenteDirecte` référence l'une
  OU l'autre.
- **Contrôle d'accès `proxy.ts`** : le middleware confine chaque gestionnaire mappé à son propre
  dashboard ; les portails partagés (ex. RIA) doivent être déclarés explicitement en `commonPaths`.
- **RBAC granulaire** : 6 actions (Lecture/Création/Modification/Validation/Export/Suppression
  logique) par rôle + override par utilisateur. Cœur + UI livrés ; **enforcement encore à brancher
  route par route** après migration.

## État des modules

### Livrés / complets
- **Module Paie (13)** — FichePaie à 5 statuts, bulletin en 3 blocs (Salaire fixe/variable/
  Déductions), prime d'ancienneté auto (barème OHADA éditable), CNSS 21,50% + IRPP progressif Togo +
  quotient familial injectés auto, retenues prêts/avances auto à la création de fiche, tableau de
  bord masse salariale (mensuel/trimestriel/annuel, coût RH par département/équipe/collaborateur).
  Commissions PALIER encore manuelles.
- **Module RIA** (investissement/financement communautaire) — 12 modèles/6 enums, flux capital
  dépôt/retrait/financement/distribution ; éligibilité clients (Étape 3, `lib/riaEligibilite.ts`) ;
  défaillance/recouvrement avec escalade auto N1→N5 (DG) et cron Vercel (`lib/riaRecouvrement.ts`),
  sans API payante.
- **Module Compte Courant client** — portefeuille interne/épargne par client. Lots 1→5 complets
  (socle, dépôts, paiement crédit, retrait sécurisé, dashboard/états/documents). Admin peut initier
  ET valider seul un retrait (dérogation séparation des tâches, voulue). Édition admin (compte +
  mouvement) livrée ; modification du montant d'un paiement crédit encore refusée (à câbler via
  `modifierRemboursementCredit`).
- **Module Catalogue Produits & Prix** — gros module PIM, **12/12 phases complètes** : socle,
  tarification + moteur de prix (option B, prix flexibles), disponibilité/stock agence, historique
  prix + validation, promotions, fiche/tableau prix/recherche, documents, dashboard + catalogue
  intelligent, import/export, lots FEFO, substitution produits, vues personnalisées. Surface
  publique vitrine/borne livrée (`/catalogue` + `/api/catalogue/public` via `projeterCatalogue`).
  Reste : appli mobile + e-commerce (auth client).
- **Module Marketing** — CDC 89 sections/7 phases, **complet** (19 pages admin, ~35 routes API) :
  campagnes, audiences+RFM, communication, bibliothèque, social media, promotions/coupons,
  fidélisation/challenges/badges, parrainage, animation agences, B2B, événementiel, terrain,
  acquisition digitale, automatisation, analytics + A/B testing, budget 2 paliers, partenaires.
- **Documents RH** — chantier ~150 documents RH, 14/14 manques confirmés livrés (2026-07-24) ;
  socle `lib/rhDocTemplates/` (registre de templates), 5 natures (générés/imprimables/registres/
  uploads/société).
- **Parité d'accès Responsable RH** — SST/Évaluations/Formations/Docs stratégiques/Organigramme/
  Disciplinaire répliqués côté ResponsableRH (scopés PDV via `profilRHIdsPerimetre`) ; hub RH et
  self-service collaborateur complétés.
- **Branchement flux de vente ↔ catalogue** — Ventes/Caisse/Crédit consomment `resoudrePrix` +
  `prixPromotionnel` + prix CRÉDIT (`lib/venteTarification.ts`, serveur autoritaire) + FEFO
  best-effort + substituts en rupture + prix résolus affichés (`lib/tarificationBatch.ts`).
- Auth Google = login seul (comptes pré-créés par l'admin, pas d'auto-inscription).
- Pointage RH en soft delete (champ `annule`, toujours filtrer `annule:false`).
- PDF serveur mutualisé (`lib/pdf.ts`, Chromium headless, runtime nodejs obligatoire).
- Email transactionnel via Resend (`lib/email.ts`), branché sur création de membre.
- Historique prix produits (`HistoriquePrixProduit` + `lib/prixProduit.ts`).
- Bordereau remboursement crédit (A→J, `BordereauRemboursement.tsx`) — plusieurs champs CDC sans
  donnée en base (voir mémoire détaillée si besoin).
- Facture avec en-tête/pied société (AFRISIME letterhead) — `FactureModal` InvoiceLayout et
  `printInvoice` doivent rester synchronisés.
- Congés + avances/prêts self-service collaborateur (workflows Manager→RH→Direction/final).
- Modification remboursement crédit (montant+date) avec recalcul financier complet incl. RIA.
- Déclencheurs manuels des 5 alertes notifications RH (admin+RH).
- Scan agent QR sans login (`/scan/[token]`, jeton opaque `User.scanTokenTournee`).
- Paramètres compte self-service (photo, email compat Google, coordonnées, mot de passe).
- Admin PDV & souscriptions (pages/API PDV, stock grand/par PDV, gestionnaires/clients par PDV).

### En cours / partiels
- **Approvisionnement & Supply Chain** — CDC 19 sections. Livré : fournisseurs enrichis, RFQ +
  comparatif, PO séparé de la réception, MRP réel (+ demandes fermes crédit/souscription),
  Importations, dashboard, flux ascendant `CommandeInterne` (RPV/Chef Agence → appro central).
  §19 (archi microservices) volontairement ignorée.
- **POPC** (planification objectifs & pilotage collectes) — Phase 1 socle livré (paramétrage §3 +
  synthèse §4 + prévision 16/31 §6). Formule crédit Quinzaine/Trentaine obligatoire (3 flux),
  16ème/31ème = dernière échéance. `Collecte` abandonnée (lit `RemboursementCredit` directement).
  Reste : §7-§13.
- **RBAC granulaire** — cœur + UI prêts, enforcement à brancher route par route.
- **Refonte UI (design system)** — Milestone 1 posé (tokens bleus, primitives Button/Card/Badge/
  Input/KpiCard/Modal/Pagination, AdminSidebar/AdminTopbar). Module RH en cours, page par page.

## Simplifications assumées (documentées, ne pas "corriger" sans discussion)
- CNSS/IRPP Togo avec quotient familial : taux/barème simplifiés et documentés dans le code.
- Bordereau remboursement crédit : certains champs du CDC n'ont pas de donnée source en base.
- Édition CC : montant d'un mouvement de paiement crédit refusé en édition directe (doit passer par
  `modifierRemboursementCredit`, lien `remboursementId` pas encore câblé).

## Roadmap / backlog connu
- Module Compte Courant : évolutions CDC §19 A–F, SMS/WhatsApp, OTP retrait.
- Catalogue : appli mobile + e-commerce (auth client) sur `projeterProduit`.
- POPC : sections §7 à §13.
- Approvisionnement : rien de prévu sur l'archi microservices (§19), volontairement hors scope.

---
*Ce fichier est maintenu manuellement/par Claude au fil des sessions. Pour l'historique détaillé
des décisions et le "pourquoi", voir la mémoire de session Claude (hors repo) ou demander un
résumé au CDC correspondant.*
