// tests/setup/globalSetup.ts
//
// CDC Comptabilité §78 — prépare la base de test isolée "afriges_test" une
// seule fois avant l'exécution de toute la suite : créée si absente, migrée,
// puis semée avec les données de référence minimales (plan comptable,
// exercice ouvert, taxe TVA) — jamais recréée à chaque run pour rester
// rapide, mais toujours idempotente (upsert/skipDuplicates) pour rester sûre
// même après un run précédent.
import { config } from "dotenv";
import path from "node:path";
import { execSync } from "node:child_process";
import { Pool } from "pg";

config({ path: path.resolve(__dirname, "../../.env.test") });

function nomBaseDepuisUrl(url: string): string {
  return new URL(url).pathname.replace(/^\//, "");
}

function urlMaintenance(url: string): string {
  const u = new URL(url);
  u.pathname = "/postgres";
  return u.toString();
}

export default async function globalSetup(): Promise<void> {
  const testUrl = process.env.DATABASE_URL;
  if (!testUrl) throw new Error("DATABASE_URL manquant — vérifier .env.test");
  if (!testUrl.includes("afriges_test")) {
    // Garde-fou : ne jamais migrer/semer une base qui ne serait pas la base de test dédiée.
    throw new Error(`DATABASE_URL ne pointe pas vers afriges_test (${testUrl}) — abandon par sécurité.`);
  }
  const dbName = nomBaseDepuisUrl(testUrl);

  const adminPool = new Pool({ connectionString: urlMaintenance(testUrl) });
  try {
    const exists = await adminPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[tests] Base "${dbName}" créée.`);
    }
  } finally {
    await adminPool.end();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testUrl },
    cwd: path.resolve(__dirname, "../.."),
  });

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PLAN_SYSCOHADA_BASE } = await import("../../app/api/comptable/plan-comptable/route");

  const seedPool = new Pool({ connectionString: testUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(seedPool) });
  try {
    // Plan comptable minimal (idempotent — skipDuplicates).
    await prisma.compteComptable.createMany({
      data: PLAN_SYSCOHADA_BASE.map((c) => ({
        ...c,
        type: c.type as never,
        nature: c.nature as never,
        sens: c.sens as never,
      })),
      skipDuplicates: true,
    });

    // Exercice ouvert fixe (2025, pour les tests qui datent explicitement leurs
    // écritures) + exercice de l'année courante (pour les fonctions du moteur
    // appelées sans `date` explicite, qui défaultent à `new Date()` — sans cet
    // exercice, dateHorsExercice() rejetterait ces écritures).
    const anneeCourante = new Date().getFullYear();
    await Promise.all(
      [...new Set([2025, anneeCourante])].map((annee) =>
        prisma.exerciceComptable.upsert({
          where: { annee },
          create: { annee, dateDebut: new Date(annee, 0, 1), dateFin: new Date(annee, 11, 31, 23, 59, 59), statut: "OUVERT" },
          update: {},
        }),
      ),
    );

    // Taxe TVA 18% active (achats + ventes).
    await prisma.taxeConfig.upsert({
      where: { code: "TVA_TEST" },
      create: {
        code: "TVA_TEST", nom: "TVA test", taux: 18, nature: "TVA",
        compteCollecteNumero: "4431", compteDeductibleNumero: "4432",
        applicableAchat: true, applicableVente: true, actif: true,
      },
      update: {},
    });

    console.log("[tests] Données de référence semées (plan comptable, exercice 2025, TVA 18%).");
  } finally {
    await prisma.$disconnect();
    await seedPool.end();
  }
}
