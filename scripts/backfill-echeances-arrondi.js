/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Backfill : arrondi des montants d'échéances de crédit au multiple de 25 FCFA.
 *
 * Recalcule, pour les crédits EXISTANTS non soldés (EN_ATTENTE_VALIDATION, ACTIF,
 * EN_RETARD), le `montantJournalier` arrondi au multiple de 25 (…00, 25, 50, 75)
 * et régénère leur échéancier. Reproduit fidèlement la logique de
 * lib/dureeCredit.ts (appliquerNouvelleDureeCredit) :
 *   - montantJournalier = arrondiCFA(montantTotal / dureeJours)
 *   - échéances journalières = montantJournalier, la DERNIÈRE absorbe le résidu
 *     → la somme reste EXACTEMENT égale au montantTotal (aucun franc créé/perdu)
 *   - le déjà-remboursé est ré-imputé depuis la 1re échéance ; statut recalculé
 *     (SOLDE / EN_RETARD / ACTIF). Le montantTotal et le montantRembourse ne
 *     changent JAMAIS.
 *
 * ⚠ Comme la modification de durée dans l'app, la régénération remet les pénalités
 * d'échéance à 0 (elles sont recalculées à l'encaissement) et ré-impute le
 * déjà-payé depuis la 1re échéance. Les crédits SOLDE/ANNULE/REJETE ne sont pas
 * touchés. Idempotent : un crédit déjà conforme (journalier + échéancier au pas de
 * 25) est ignoré → relançable sans risque.
 *
 * Lancement :
 *   node scripts/backfill-echeances-arrondi.js --dry-run   → simulation (aucune écriture)
 *   npm run backfill:echeances                             → base de dev (.env / .env.local)
 *   npm run backfill:echeances:prod                        → base de PRODUCTION (.env.production)
 *   node scripts/backfill-echeances-arrondi.js --env-file=chemin/vers/.env
 */

const fs = require("fs");
const path = require("path");

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    prod:    args.includes("--prod") || args.includes("--production"),
    dryRun:  args.includes("--dry-run") || args.includes("--dry"),
    envFile: (args.find((a) => a.startsWith("--env-file=")) || "").split("=")[1] || null,
  };
}

// Charge DATABASE_URL depuis les fichiers .env appropriés (identique aux autres scripts).
function chargerEnv({ prod, envFile }) {
  const fichiers = envFile
    ? [envFile]
    : prod
      ? [".env.production.local", ".env.production"]
      : [".env", ".env.local"];
  const override = Boolean(envFile || prod);
  for (const nom of fichiers) {
    const p = path.isAbsolute(nom) ? nom : path.resolve(__dirname, "..", nom);
    if (!fs.existsSync(p)) continue;
    for (const ligne of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = ligne.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (override || process.env[m[1]] === undefined) process.env[m[1]] = val;
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Logique métier (miroir de lib/echeancierCredit.ts + lib/dureeCredit.ts) ──
const arrondiCFA = (v) => Math.round(v / 25) * 25;
const round2 = (v) => Number(Number(v).toFixed(2));

// Montant journalier arrondi au pas de 25, avec garde-fou anti-dernière-échéance-négative.
function journalierArrondi(total, duree) {
  if (duree < 1) return arrondiCFA(total);
  const proche = arrondiCFA(total / duree);
  if (proche * (duree - 1) >= total) return Math.floor(total / duree / 25) * 25;
  return proche;
}

/**
 * Calcule le nouvel échéancier cible d'un crédit (sans écrire).
 * Renvoie null si aucun changement n'est nécessaire (déjà conforme).
 */
function calculerCible(credit) {
  const duree = credit.dureeJours;
  if (!duree || duree < 1) return null;

  const total           = Number(credit.montantTotal);
  const dejaRembourse   = Number(credit.montantRembourse);
  const montantJournalier = journalierArrondi(total, duree);
  const residuel        = round2(total - montantJournalier * duree);
  const soldeRestant    = Math.max(0, round2(total - dejaRembourse));

  const dateEcheanceFin = new Date(credit.dateDebut);
  dateEcheanceFin.setDate(dateEcheanceFin.getDate() + duree);

  const enRemboursement = credit.statut === "ACTIF" || credit.statut === "EN_RETARD";

  // Crédit non encore validé : pas d'échéances, on ne touche que le journalier.
  if (!enRemboursement) {
    const dejaConforme = Number(credit.montantJournalier) === montantJournalier;
    if (dejaConforme) return null;
    return { montantJournalier, dateEcheanceFin, soldeRestant, echeances: null, nouveauStatut: null };
  }

  // Crédit en remboursement : régénère l'échéancier + ré-impute le déjà-payé.
  const now = new Date();
  let budget = dejaRembourse;
  let resteEnRetard = false;
  const echeances = Array.from({ length: duree }, (_, idx) => {
    const i = idx + 1;
    const d = new Date(credit.dateDebut);
    d.setDate(d.getDate() + idx);
    const montantDu = i === duree ? round2(montantJournalier + residuel) : montantJournalier;
    const paye = Math.min(budget, montantDu);
    budget = round2(budget - paye);
    const statut = paye >= montantDu ? "PAYE" : paye > 0 ? "PARTIEL" : "EN_ATTENTE";
    if (paye < montantDu && d < now) resteEnRetard = true;
    return { creditId: credit.id, numeroEcheance: i, dateEcheance: d, montantDu, montantPaye: paye, statut };
  });

  const nouveauStatut = soldeRestant <= 0 ? "SOLDE" : resteEnRetard ? "EN_RETARD" : "ACTIF";

  // Idempotence : si journalier + montantDu de chaque échéance sont déjà ceux
  // visés, il n'y a rien à réécrire.
  const existantes = new Map((credit.echeances || []).map((e) => [e.numeroEcheance, Number(e.montantDu)]));
  const dejaConforme =
    Number(credit.montantJournalier) === montantJournalier &&
    existantes.size === echeances.length &&
    echeances.every((e) => existantes.get(e.numeroEcheance) === e.montantDu);
  if (dejaConforme) return null;

  return { montantJournalier, dateEcheanceFin, soldeRestant, echeances, nouveauStatut };
}

async function main() {
  console.log(`Base cible : ${hostDe(process.env.DATABASE_URL)}${options.prod ? "  ⚠ PRODUCTION" : ""}`);
  if (options.dryRun) console.log("Mode SIMULATION (--dry-run) : aucune écriture.\n");

  const credits = await prisma.creditClient.findMany({
    where: { statut: { in: ["EN_ATTENTE_VALIDATION", "ACTIF", "EN_RETARD"] } },
    orderBy: { id: "asc" },
    select: {
      id: true, reference: true, statut: true,
      montantTotal: true, montantRembourse: true, montantJournalier: true,
      dureeJours: true, dateDebut: true,
      echeances: { select: { numeroEcheance: true, montantDu: true } },
    },
  });

  console.log(`${credits.length} crédit(s) non soldé(s) à examiner.\n`);

  let modifies = 0, ignores = 0, erreurs = 0;
  for (const credit of credits) {
    const cible = calculerCible(credit);
    if (!cible) { ignores += 1; continue; }

    const avant = Number(credit.montantJournalier);
    const apres = cible.montantJournalier;
    console.log(`  ${credit.reference} [${credit.statut}] journalier ${avant} → ${apres}${cible.nouveauStatut && cible.nouveauStatut !== credit.statut ? ` · statut → ${cible.nouveauStatut}` : ""}`);

    if (options.dryRun) { modifies += 1; continue; }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.creditClient.update({
          where: { id: credit.id },
          data: {
            montantJournalier: cible.montantJournalier,
            dateEcheanceFin:   cible.dateEcheanceFin,
            soldeRestant:      cible.soldeRestant,
            ...(cible.nouveauStatut ? { statut: cible.nouveauStatut } : {}),
          },
        });
        if (cible.echeances) {
          await tx.echeanceCredit.deleteMany({ where: { creditId: credit.id } });
          await tx.echeanceCredit.createMany({ data: cible.echeances });
        }
      });
      modifies += 1;
    } catch (e) {
      erreurs += 1;
      console.error(`  ✖ ${credit.reference} : ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(
    `\n${options.dryRun ? "Simulation terminée" : "✔ Terminé"} : ` +
    `${modifies} crédit(s) ${options.dryRun ? "à corriger" : "corrigé(s)"}, ${ignores} déjà conforme(s)` +
    `${erreurs ? `, ${erreurs} erreur(s)` : ""}.`
  );
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
