# AfriGes – Mémoire persistante

## Stack & Architecture
- Next.js 14+ App Router, Prisma ORM (PostgreSQL), NextAuth
- Hooks custom: `useApi` (GET), `useMutation` (POST/PUT/PATCH/DELETE) dans `hooks/useApi.ts`
- `useMutation` : `url` est une dép de `useCallback` → URL correcte avant le clic
- Toasts via `sonner`
- Formatage: `formatCurrency`, `formatDate`, `formatDateTime` depuis `lib/format`

## Auth par rôle (pattern établi)
- `lib/auth.ts` → `getAuthSession()` : session universelle
- `lib/authMagasinier.ts` → `getMagasinierSession()` : vérifie `gestionnaireRole === "MAGAZINIER"`
- `lib/authAgentTerrain.ts` → `getAgentTerrainSession()` : vérifie `gestionnaireRole === "AGENT_TERRAIN"`
- `lib/authLogistique.ts` → `getLogistiqueSession()` : vérifie `gestionnaireRole === "AGENT_LOGISTIQUE_APPROVISIONNEMENT"`
- Admins : `session.user.role` dans `["ADMIN", "SUPER_ADMIN"]`
- Le champ session est `session.user.gestionnaireRole` (string | undefined)

## Modèles Prisma clés
- `Produit` : nom, prixUnitaire, stock, alerteStock → MouvementStock[], VenteCreditAlimentaire[]
- `MouvementStock` : type (ENTREE/SORTIE/AJUSTEMENT), quantite, motif, reference (UNIQUE), dateMouvement
  - Prefixes références : `MAG-REC-*`, `MAG-ADJ-*`, `LOG-REC-*`, `LOG-AFF-*`, `VENTE-*`
- `TontineMembre` : ordreTirage (nullable), dateSortie (null = membre actif)
- `TontineCycle` : numeroCycle, beneficiaireId, montantPot, statut (EN_COURS/COMPLETE/ANNULE)
- `TontineContribution` : cycleId, membreId, montant, statut (EN_ATTENTE/PAYEE)
- `CreditAlimentaire` : source (COTISATION/TONTINE), sourceId, statut (ACTIF/EPUISE/EXPIRE)
- `Gestionnaire` : role (RoleGestionnaire enum), actif, lié à User via memberId
- `AuditLog` : userId, action (string libre), entite, entiteId
- `Notification` : userId, titre, message, priorite, lue, actionUrl

## Conventions de code
- Vérification auth TOUJOURS en premier dans chaque handler API
- Transactions Prisma `$transaction` pour toute opération qui modifie + notifie + audit
- Notifier admins (Role.ADMIN + Role.SUPER_ADMIN) + role concerné (ex: MAGAZINIER) via `notification.createMany`
- `AuditLog` créé dans chaque mutation significative
- Avant d'écrire un fichier → lire au moins quelques lignes (sinon erreur Write)

## Routes API par domaine
- `/api/admin/*` : ADMIN/SUPER_ADMIN uniquement
- `/api/user/*` : users authentifiés (Role.USER)
- `/api/magasinier/*` : gestionnaireRole MAGAZINIER
- `/api/agentTerrain/*` : gestionnaireRole AGENT_TERRAIN
- `/api/logistique/*` : gestionnaireRole AGENT_LOGISTIQUE_APPROVISIONNEMENT
- `/api/notifications/*` : tout utilisateur connecté

## Pattern 2-step modal (ventes, creditsAlimentaires)
- Step 1 : recherche live client (≥2 chars), clic pour sélectionner
- Step 2 : formulaire filtré sur le client sélectionné
- Bouton "Changer" pour revenir au step 1
- closeModal() remet tout à zéro

## Règles métier tontines (bugs corrigés)
- `dateSortie: null` obligatoire pour filtrer les membres ACTIFS dans les cycles
- ordreTirage doit être séquentiel 1..N et unique avant de démarrer un cycle
- Terminaison = `nextNumeroCycle > activeMembers.length` (pas `!beneficiaire`)
- PUT membres interdit si `cyclesCount > 0`
- PUT montantCycle interdit si cycle EN_COURS
- DELETE interdit si `cyclesCount > 0`
- TontineEdit : `hasCycles` verrouille la gestion membres, `hasCycleEnCours` verrouille montantCycle

## Règles métier crédits alimentaires (bugs corrigés)
- COTISATION source : cotisation doit exister, appartenir au client, être PAYEE
- TONTINE source : tontine doit être ACTIVE, client doit être membre actif (dateSortie: null)
- Doublon actif : vérification sur (clientId, source, sourceId, statut=ACTIF)
- [id]/route.ts PATCH : auth check manquait → ajouté
- Voir `app/api/admin/creditsAlimentaires/route.ts` pour la logique complète

## Fichiers importants
- `prisma/schema.prisma` : schéma complet
- `lib/authOptions.ts` : config NextAuth, inclut gestionnaireRole dans session
- `hooks/useApi.ts` : useApi + useMutation
- `lib/creditAlimentaireAuto.ts` : génération auto crédit depuis cotisation/tontine
- `app/api/cron/expirations/route.ts` : expiration auto des crédits
