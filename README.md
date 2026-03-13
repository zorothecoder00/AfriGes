# AfriGes

AfriGes est une plateforme web de gestion intégrée destinée aux entreprises africaines.
Elle permet de gérer les ventes, les stocks, les finances, les clients, les assemblées d’actionnaires, ainsi que les opérations de terrain à travers plusieurs rôles métiers.

Cette application est construite avec [Next.js](https://nextjs.org) et repose sur une architecture **API modulaire par rôle utilisateur**.

---

# Technologies utilisées

## Frontend

* [Next.js](https://nextjs.org)
* [React](https://react.dev)
* [TailwindCSS](https://tailwindcss.com)
* [Lucide Icons](https://lucide.dev)

## Backend

* Next.js API Routes
* [Prisma ORM](https://www.prisma.io)
* [PostgreSQL](https://www.postgresql.org)
* [NextAuth](https://next-auth.js.org)
* [UploadThing](https://uploadthing.com)

## Outils de développement

* [TypeScript](https://www.typescriptlang.org)
* [ESLint](https://eslint.org)
* Prisma CLI

---

# Installation

## 1. Cloner le projet

```bash
git clone https://github.com/zorothecoder00/AfriGes.git
cd AfriGes
```

## 2. Installer les dépendances

```bash
npm install
```

## 3. Configurer les variables d'environnement

Créer un fichier `.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/afriges
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
UPLOADTHING_TOKEN=your_uploadthing_token
UPLOADTHING_SECRET=your_uploadthing_secret
UPLOADTHING_APP_ID=your_uploadthing_app_id
```
   
## 4. Générer Prisma  

```bash
npx prisma generate
```

---

# Getting Started

First, run the development server:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

with your browser to see the result.

You can start editing the page by modifying:

```
app/page.tsx
```

The page auto-updates as you edit the file.

---

# Scripts disponibles

```bash
npm run dev
```

Lancer le serveur de développement.

```bash
npm run build
```

Build de production + génération Prisma.

```bash
npm run start
```

Démarrer l'application en production.

```bash
npm run lint
```

Vérifier les règles ESLint.

```bash
npm run check
```

Vérification complète : lint + types + build.

---

# Authentification

L’authentification est gérée avec [NextAuth](https://next-auth.js.org).

Routes :

```
/api/auth/[...nextauth]
/api/auth/register
```

Les utilisateurs sont authentifiés par **rôle métier**.

---

# Architecture API

Les API sont organisées **par rôle utilisateur**, ce qui facilite la maintenance et la sécurité.

---

# Admin API

```
/api/admin/activity
/api/admin/approvisionnements
/api/admin/assemblees
/api/admin/assemblees/[id]
/api/admin/auditLogs
/api/admin/clients
/api/admin/clients/[id]
/api/admin/dashboard
/api/admin/dividendes
/api/admin/dividendes/[id]
/api/admin/gestionnaires
/api/admin/gestionnaires/[id]
/api/admin/membres
/api/admin/membres/[id]
/api/admin/messages
/api/admin/messages/[id]
/api/admin/packs
/api/admin/packs/[id]
/api/admin/packs/echeances
/api/admin/packs/receptions
/api/admin/packs/receptions/[id]
/api/admin/packs/souscriptions
/api/admin/packs/souscriptions/[id]
/api/admin/pdv
/api/admin/pdv/[id]
/api/admin/stock
/api/admin/stock/[id]
/api/admin/transferts
/api/admin/transferts/[id]
/api/admin/ventes
```

---

# Actionnaire API

```
/api/actionnaire/assemblees
/api/actionnaire/assemblees/[id]
/api/actionnaire/dividendes
/api/actionnaire/documents
/api/actionnaire/mouvements-action
/api/actionnaire/profil
/api/actionnaire/resolutions
/api/actionnaire/resolutions/[id]
/api/actionnaire/stats
```

---

# Agent Terrain API

```
/api/agentTerrain/clients
/api/agentTerrain/livraisons
/api/agentTerrain/livraisons/[id]/confirmer
/api/agentTerrain/packs
/api/agentTerrain/packs/[id]/collecte
/api/agentTerrain/ventes
/api/agentTerrain/ventes/[id]
```

---

# Auditeur API

```
/api/auditeur/anomalies-stock
/api/auditeur/bons-sortie
/api/auditeur/caisses
/api/auditeur/dashboard
/api/auditeur/logs-systeme
/api/auditeur/mouvements-stock
/api/auditeur/transferts
/api/auditeur/utilisateurs
/api/auditeur/ventes-stats
```

---

# Caissier API

```
/api/caissier/cloture
/api/caissier/dashboard
/api/caissier/operations
/api/caissier/packs/[id]/versement
/api/caissier/packs/fidelite
/api/caissier/recus
/api/caissier/session
/api/caissier/session/[id]
/api/caissier/transferts
/api/caissier/ventes
/api/caissier/versements
```

---

# Chef d'agence API

```
/api/chef-agence/approvisionnement
/api/chef-agence/caisse
/api/chef-agence/clients
/api/chef-agence/dashboard
/api/chef-agence/equipe
/api/chef-agence/pdv
/api/chef-agence/stock
/api/chef-agence/ventes
```

---

# Comptable API

```
/api/comptable/clotures
/api/comptable/ecritures/[id]
/api/comptable/etats-financiers
/api/comptable/journal
/api/comptable/journal/valider
/api/comptable/pieces
/api/comptable/pieces/[id]
/api/comptable/plan-comptable
/api/comptable/rapprochement
/api/comptable/sync-journals
/api/comptable/synthese
/api/comptable/tva
```

---

# Logistique API

```
/api/logistique/affectations
/api/logistique/fournisseurs
/api/logistique/livraisons-packs
/api/logistique/livraisons-packs/[id]/confirmer
/api/logistique/livraisons-rpv
/api/logistique/mouvements
/api/logistique/produits
/api/logistique/produits/[id]
/api/logistique/receptions
/api/logistique/receptions/[id]
/api/logistique/stock
/api/logistique/transferts
/api/logistique/transferts/[id]
```

---

# Magasinier API

```
/api/magasinier/anomalies
/api/magasinier/anomalies/[id]
/api/magasinier/bons-sortie
/api/magasinier/bons-sortie/[id]
/api/magasinier/commandes-internes
/api/magasinier/inventaires
/api/magasinier/inventaires/[id]
/api/magasinier/livraisons-rpv
/api/magasinier/livraisons-rpv/[id]
/api/magasinier/mouvements
/api/magasinier/stock
/api/magasinier/stock/[id]/ajustement
/api/magasinier/transferts
/api/magasinier/ventes-terrain
/api/magasinier/ventes-terrain/[id]
```

---

# RPV API

```
/api/rpv/anomalies
/api/rpv/caisse-rpv
/api/rpv/clients
/api/rpv/clients/[id]
/api/rpv/dashboard
/api/rpv/equipe
/api/rpv/livraisons
/api/rpv/livraisons/[id]
/api/rpv/mouvements
/api/rpv/packs
/api/rpv/packs/[id]/livrer
/api/rpv/produits
/api/rpv/produits/livrer
/api/rpv/receptions-packs
/api/rpv/receptions-packs/[id]
/api/rpv/souscriptions-actives
/api/rpv/stock
/api/rpv/ventes
/api/rpv/ventes/[id]
/api/rpv/ventes-terrain
/api/rpv/ventes-terrain/[id]
```

---

# Super Admin API

```
/api/superadmin/audit-logs
/api/superadmin/modules
/api/superadmin/settings
/api/superadmin/stats
/api/superadmin/users
/api/superadmin/users/[id]/action
```

---

# Notifications API

```
/api/notifications/[id]
/api/notifications/[id]/read
/api/notifications/readAll
/api/notifications/unread
```

---

# Upload de fichiers

Gestion des fichiers avec [UploadThing](https://uploadthing.com).

```
/api/uploadthing/core
/api/uploadthing/route
```

---

# Tâches planifiées (Cron)

```
/api/cron/expirations
/api/cron/fermeture-caisse
```

Ces endpoints automatisent :

* les expirations
* la fermeture des sessions de caisse

---

# Structure du projet

```
afriges
 ├ app
 │   ├ api
 │   ├ auth
 │   └ dashboard
 │
 ├ components
 ├ contexts
 ├ hooks
 ├ lib
 │
 ├ prisma
 │   ├ schema.prisma
 │   └ migrations
 │
 ├ public
 ├ services
 ├ types
 │
 ├ package.json
 ├ tsconfig.json
 ├ next.config.mjs
 └ autres fichiers de configuration à la racine
```

---

# Learn More

To learn more about Next.js, take a look at the following resources:

* [Next.js Documentation](https://nextjs.org/docs)
* [Learn Next.js](https://nextjs.org/learn)

You can check out the [Next.js GitHub repository](https://github.com/vercel/next.js).

---

# Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).

---

# Licence

Projet privé — Tous droits réservés.
