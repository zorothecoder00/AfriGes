/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Script de backfill des codes clients.
 *
 * Attribue un code `CLI-00042` à tous les clients qui n'en ont pas encore
 * (clients créés en prospection agent terrain / RPV avant la génération
 * systématique du code). Idempotent : ne touche que les `codeClient` nuls,
 * donc relançable sans risque.
 *
 * Lancement :
 *   npm run backfill:codes         → base de dev (.env / .env.local)
 *   npm run backfill:codes:prod    → base de PRODUCTION (.env.production)
 *   node scripts/backfill-code-client.js --env-file=chemin/vers/.env  → fichier explicite
 *
 * Un DATABASE_URL déjà présent dans l'environnement (CI, shell prod) est utilisé tel quel
 * en mode dev ; les modes --prod / --env-file écrasent volontairement la valeur.
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  const prod = args.includes("--prod") || args.includes("--production");
  const envFileArg = args.find((a) => a.startsWith("--env-file="));
  return { prod, envFile: envFileArg ? envFileArg.split("=")[1] : null };
}

// Charge DATABASE_URL depuis les fichiers .env appropriés.
function chargerEnv({ prod, envFile }) {
  const fichiers = envFile
    ? [envFile]
    : prod
      ? [".env.production.local", ".env.production"]
      : [".env", ".env.local"];
  const override = Boolean(envFile || prod); // choix explicite → écrase l'existant
  for (const nom of fichiers) {
    const p = path.isAbsolute(nom) ? nom : path.resolve(__dirname, "..", nom);
    if (!fs.existsSync(p)) continue;
    for (const ligne of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const cle = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (override || process.env[cle] === undefined) process.env[cle] = val;
    }
  }
}

const options = parseArgs();
chargerEnv(options);

if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL introuvable. Vérifiez votre .env (ou .env.production avec --prod).");
  process.exit(1);
}

function hostDe(url) { try { return new URL(url).hostname; } catch { return "?"; } }

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

// Prisma 7 : instanciation via l'adapter driver (identique à lib/prisma.ts).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log(`Base cible : ${hostDe(process.env.DATABASE_URL)}${options.prod ? "  ⚠ PRODUCTION" : ""}`);

  // Point de départ = plus grand suffixe numérique déjà attribué.
  const dernier = await prisma.client.findFirst({
    where:   { codeClient: { startsWith: "CLI-" } },
    orderBy: { codeClient: "desc" },
    select:  { codeClient: true },
  });
  let n = dernier && dernier.codeClient
    ? parseInt(dernier.codeClient.replace(/^CLI-/, ""), 10) || 0
    : 0;

  const sansCode = await prisma.client.findMany({
    where:   { codeClient: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select:  { id: true },
  });

  if (sansCode.length === 0) {
    console.log("✔ Tous les clients ont déjà un code. Rien à faire.");
    return;
  }

  console.log(
    `${sansCode.length} client(s) sans code. Attribution à partir de CLI-${String(n + 1).padStart(5, "0")}…`,
  );

  let done = 0;
  for (const c of sansCode) {
    n += 1;
    await prisma.client.update({
      where: { id: c.id },
      data:  { codeClient: `CLI-${String(n).padStart(5, "0")}` },
    });
    done += 1;
    if (done % 50 === 0) console.log(`  … ${done}/${sansCode.length}`);
  }

  console.log(`✔ Terminé : ${done} code(s) client attribué(s).`);
}

main()
  .catch((e) => {
    console.error("✖ Échec du backfill :", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
