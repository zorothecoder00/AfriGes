# AfriGes — Mémoire du projet

## Stack & Architecture
- Next.js 15+ App Router, TypeScript, Prisma ORM, PostgreSQL
- Tailwind CSS, DM Sans font, Sonner toast
- NextAuth (credentials + Google) — session avec `nom`, `prenom`, `name`, `id`, `role`
- Hooks : `useApi<T>()` (GET) et `useMutation<TData, TBody>()` (POST/PUT/PATCH/DELETE) dans `hooks/useApi.ts`

## Patterns importants

### Params Next.js 15+
Les routes dynamiques doivent await les params :
```typescript
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
}
```

### Notifications centralisées
`lib/notifications.ts` — helpers à utiliser dans les transactions :
- `notifyRoles(tx, ["MAGAZINIER", "COMPTABLE"], { titre, message, priorite, actionUrl })` — notifie Admin + gestionnaires par rôle
- `notifyAdmins(tx, payload)` — notifie seulement Admin/SuperAdmin
- `notifyGestionnaires(tx, roles, payload)` — gestionnaires uniquement
- `auditLog(tx, userId, action, entite, entiteId?)` — crée un audit log

### Auth helpers par rôle
- `lib/authCaissier.ts` → `getCaissierSession()`
- `lib/authRPV.ts` → `getRPVSession()`
- `lib/authComptable.ts` → `getComptableSession()`
- `lib/authMagasinier.ts` → `getMagasinierSession()`
- `lib/authLogistique.ts` → `getLogistiqueSession()`
- `lib/authAgentTerrain.ts` → `getAgentTerrainSession()`

## Migrations Prisma
L'utilisateur gère les migrations lui-même. Ne pas avertir sur les migrations.

## Rôles système
- `Role` (User): SUPER_ADMIN, ADMIN, USER
- `RoleGestionnaire`: RESPONSABLE_POINT_DE_VENTE, CHEF_AGENCE, RESPONSABLE_COMMUNAUTE,
  CAISSIER, COMPTABLE, MAGAZINIER, AGENT_LOGISTIQUE_APPROVISIONNEMENT,
  AGENT_TERRAIN, COMMERCIAL, CONTROLEUR_TERRAIN, RESPONSABLE_VENTE_CREDIT,
  RESPONSABLE_ECONOMIQUE, RESPONSABLE_MARKETING, ACTIONNAIRE, REVENDEUR, AUDITEUR_INTERNE

## Architecture Points de Vente (refonte 2026-03)

### Concept central : PointDeVente
- Un `PointDeVente` peut être de type `POINT_DE_VENTE` ou `DEPOT_CENTRAL`
- Chaque PDV a un RPV (`rpvId` → User, unique) et un chef d'agence superviseur (`chefAgenceId`)
- Les autres gestionnaires (caissier, magasinier, etc.) sont liés via `GestionnaireAffectation`
- Les `Client` ont un `pointDeVenteId?` (rattachement optionnel)

### Stock localisé
- Plus de champ `stock` global sur `Produit` → remplacé par `StockSite`
- `StockSite` : (produitId, pointDeVenteId) → quantite (unique par couple)
- `MouvementStock` : chaque mouvement référence un `pointDeVenteId` + `typeEntree`/`typeSortie`
- Les stocks de tous les PDV forment le stock global de l'entreprise

### Hiérarchie des caisses
- `SessionCaisse` = grande caisse du caissier (liée à un PDV via `pointDeVenteId`)
- `CaissePDV` = petite caisse du RPV, liée à une `SessionCaisse` via `sessionCaisseId`
- `VenteDirecte` peut référencer `caissePDVId` (petite) OU `sessionCaisseId` (grande)

### Modèles nouveaux clés
| Modèle | Rôle |
|--------|------|
| `PointDeVente` | PDV ou dépôt central |
| `GestionnaireAffectation` | lien User ↔ PDV |
| `Fournisseur` | fournisseurs enregistrés |
| `StockSite` | stock produit par site |
| `MouvementStock` | journal de tous les mouvements |
| `ReceptionApprovisionnement` | réception fournisseur ou interne |
| `TransfertStock` | transfert entre PDV/dépôts |
| `InventaireSite` | inventaire PDV ou dépôt |
| `CommandeInterne` | demande de réappro |
| `CaissePDV` | petite caisse RPV |
| `OperationCaissePDV` | opérations petite caisse |
| `VenteDirecte` | vente hors pack |
| `LigneVenteDirecte` | lignes de vente directe |
| `VisiteControle` | visite terrain planifiée |
| `RapportControle` | rapport avec recommandations |
| `AlerteRapport` | alertes INFO / ATTENTION / CRITIQUE |

### Vendeurs (VenteDirecte.vendeurId)
Un vendeur peut être : RPV, AGENT_TERRAIN, MAGAZINIER, AGENT_LOGISTIQUE, ADMIN

### Types de sortie stock (TypeSortieStock)
VENTE_DIRECTE, LIVRAISON_PACK, LIVRAISON_CLIENT, RETOUR_FOURNISSEUR,
CONSOMMATION_INTERNE, TRANSFERT_SORTANT, AJUSTEMENT_NEGATIF, PERTE, CASSE, DON

### Types d'entrée stock (TypeEntreeStock)
RECEPTION_FOURNISSEUR, RECEPTION_INTERNE, TRANSFERT_ENTRANT, AJUSTEMENT_POSITIF, RETOUR_CLIENT

## Modèles conservés inchangés
- Packs (Pack, SouscriptionPack, VersementPack, EcheancePack, ReceptionProduitPack)
- Fidélité (PointsFidelite, MouvementPoints, RecompenseFidelite, UtilisationRecompense)
- Comptabilité SYSCOHADA (CompteComptable, EcritureComptable, LigneEcriture, JournalValidation, etc.)
- Actionnaires (ActionnaireProfile, Assemblee, Dividende, etc.)
- Message, PieceJustificative, AuditLog, Notification, Parametre
- Wallet, WalletTransaction, Facture, Paiement

## Modèles supprimés (remplacés)
- `Livraison` / `LivraisonLigne` → remplacés par `ReceptionApprovisionnement` + `TransfertStock`
- `BonSortie` / `LigneBonSortie` → remplacés par `TransfertStock` + `MouvementStock` avec typeSortie
- `Produit.stock` (champ global) → remplacé par `StockSite`

## Préférences utilisateur
- Pas de warnings sur les migrations (il gère ça lui-même)
- Ne pas modifier le bloc `generator client` ni `datasource db` du schema
- Ne pas faire les tâches en parallèle (risque crash PC)
- OK pour ajouter des fonctionnalités utiles non demandées explicitement
