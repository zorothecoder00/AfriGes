/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Applique les migrations Prisma en PRODUCTION via l'endpoint DIRECT de Neon.
 *
 * Pourquoi ce script : `DATABASE_URL` (.env.production) vise l'endpoint *pooler*
 * de Neon (`ep-...-pooler.c-2...`), en mode transaction. Les advisory locks de
 * session de Prisma n'y survivent pas → `prisma migrate deploy` échoue avec
 *   P1002 ... Timed out trying to acquire a postgres advisory lock (pg_advisory_lock(72707369)).
 * On force donc l'endpoint DIRECT = même host SANS `-pooler`, uniquement pour la
 * durée du deploy. Le pooler reste utilisé par le runtime de l'app (serverless).
 *
 * Lancement :
 *   npm run migrate:deploy:prod       → base de PRODUCTION (.env.production)
 *   node scripts/migrate-deploy-prod.js --env-file=chemin/vers/.env
 *
 * Idempotent : `migrate deploy` n'applique que les migrations non encore appliquées.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  const envFileArg = args.find((a) => a.startsWith("--env-file="));
  return { envFile: envFileArg ? envFileArg.split("=")[1] : null };
}

// Charge DATABASE_URL depuis .env.production (ou --env-file). Choix explicite → écrase l'existant.
function chargerEnv({ envFile }) {
  const fichiers = envFile ? [envFile] : [".env.production.local", ".env.production"];
  for (const nom of fichiers) {
    const p = path.isAbsolute(nom) ? nom : path.resolve(__dirname, "..", nom);
    if (!fs.existsSync(p)) continue;
    for (const ligne of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const cle = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      process.env[cle] = val; // override volontaire : on cible la prod
    }
  }
}

// Retire `-pooler` du hostname → endpoint direct de Neon (advisory lock OK).
function versEndpointDirect(url) {
  const u = new URL(url);
  u.hostname = u.hostname.replace("-pooler", "");
  return u.toString();
}

const options = parseArgs();
chargerEnv(options);

if (!process.env.DATABASE_URL) {
  console.error("✖ DATABASE_URL introuvable. Vérifiez votre .env.production (ou --env-file=…).");
  process.exit(1);
}

const directUrl = versEndpointDirect(process.env.DATABASE_URL);
const host = new URL(directUrl).hostname;

if (!process.env.DATABASE_URL.includes("-pooler")) {
  console.warn("⚠ DATABASE_URL ne contient pas `-pooler` : déjà un endpoint direct ? On continue tel quel.");
}

console.log(`Migration PRODUCTION → endpoint DIRECT : ${host}`);

const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  shell: true, // requis pour résoudre `npx` sous Windows
  env: { ...process.env, DATABASE_URL: directUrl },
});

process.exit(res.status ?? 1);
