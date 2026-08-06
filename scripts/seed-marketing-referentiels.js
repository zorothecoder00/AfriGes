/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed des référentiels Marketing paramétrables (CDC §7 types de campagne,
 * §21/§59 canaux). Idempotent (upsert par `code`) — relançable sans risque.
 *
 * Lancement :
 *   node scripts/seed-marketing-referentiels.js
 */

const fs = require("fs");
const path = require("path");

for (const nom of [".env", ".env.local"]) {
  const p = path.resolve(__dirname, "..", nom);
  if (!fs.existsSync(p)) continue;
  for (const ligne of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const TYPES_CAMPAGNE = [
  "ACQUISITION", "LANCEMENT_PRODUIT", "PROMOTION", "FIDELISATION", "REACTIVATION",
  "NOTORIETE", "EVENEMENT", "SAISONNIERE", "B2B", "AGENCE", "OUVERTURE_AGENCE",
  "ANNIVERSAIRE", "FETE", "RENTREE", "RAMADAN", "NOEL", "FIN_ANNEE",
  "CAMPAGNE_SOCIALE", "CAMPAGNE_INSTITUTIONNELLE", "CAMPAGNE_DIGITALE",
  "CAMPAGNE_TERRAIN", "CAMPAGNE_INFLUENCEUR", "CAMPAGNE_PARRAINAGE",
].map((code, i) => ({
  code,
  libelle: code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  ordre: i,
}));

const CANAUX = [
  "WHATSAPP", "SMS", "EMAIL", "NOTIFICATION", "FACEBOOK", "INSTAGRAM",
  "TERRAIN", "RADIO", "AFFICHAGE",
].map((code, i) => ({
  code,
  libelle: code.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
  ordre: i,
}));

async function main() {
  for (const t of TYPES_CAMPAGNE) {
    await prisma.typeCampagne.upsert({
      where: { code: t.code },
      create: t,
      update: { libelle: t.libelle, ordre: t.ordre },
    });
  }
  for (const c of CANAUX) {
    await prisma.canalMarketing.upsert({
      where: { code: c.code },
      create: c,
      update: { libelle: c.libelle, ordre: c.ordre },
    });
  }
  console.log(`Seed OK : ${TYPES_CAMPAGNE.length} types de campagne, ${CANAUX.length} canaux.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
