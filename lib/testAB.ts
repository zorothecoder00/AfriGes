import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/notifications";
import { envoyerMessageAUnClient } from "@/lib/envoiCampagne";

/**
 * A/B testing marketing (CDC §7, Phase 7) — deux variantes de message sur la
 * même campagne/audience, assignation aléatoire 50/50, comparaison des taux
 * de lecture (EnvoiMessage) et de conversion (achat post-envoi). Réutilise
 * intégralement le moteur d'envoi existant (`envoyerMessageAUnClient`, Phase 2)
 * — pas de pipeline d'envoi parallèle.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;
const VENTES_EXCLUES = ["ANNULEE", "BROUILLON"];

export interface ResultatLancementTestAB {
  total: number;
  envoyesA: number;
  envoyesB: number;
  echecs: number;
}

/**
 * Lance un test : répartit aléatoirement l'audience de la campagne en deux
 * groupes et envoie la variante correspondante à chacun.
 */
export async function lancerTestAB(opts: { testId: number; userId: number }): Promise<ResultatLancementTestAB> {
  const test = await prisma.testAB.findUnique({
    where: { id: opts.testId },
    select: { id: true, statut: true, campagneId: true, canalId: true, modeleAId: true, modeleBId: true, campagne: { select: { audienceId: true } } },
  });
  if (!test) throw new Error("TEST_INTROUVABLE");
  if (test.statut !== "BROUILLON") throw new Error("TEST_DEJA_LANCE");
  if (!test.campagne.audienceId) throw new Error("CAMPAGNE_SANS_AUDIENCE");

  const membres = await prisma.audienceMarketingMembre.findMany({
    where: { audienceId: test.campagne.audienceId },
    select: { clientId: true },
  });
  if (!membres.length) throw new Error("AUDIENCE_VIDE");

  const clientIds = membres.map((m) => m.clientId).sort(() => Math.random() - 0.5);
  const moitie = Math.ceil(clientIds.length / 2);
  const groupeA = clientIds.slice(0, moitie);
  const groupeB = clientIds.slice(moitie);

  await prisma.$transaction(async (tx) => {
    await tx.testABAssignation.createMany({
      data: [
        ...groupeA.map((clientId) => ({ testId: test.id, clientId, variante: "A" as const })),
        ...groupeB.map((clientId) => ({ testId: test.id, clientId, variante: "B" as const })),
      ],
      skipDuplicates: true,
    });
    await tx.testAB.update({ where: { id: test.id }, data: { statut: "EN_COURS", dateLancement: new Date() } });
    await auditLog(tx, opts.userId, "TEST_AB_LANCE", "TestAB", test.id);
  });

  // Envoi effectif — hors transaction (appels réseau SMS/email/WhatsApp).
  let envoyesA = 0, envoyesB = 0, echecs = 0;
  for (const clientId of groupeA) {
    const issue = await envoyerMessageAUnClient({ clientId, canalId: test.canalId, modeleMessageId: test.modeleAId, campagneId: test.campagneId, userId: opts.userId }).catch(() => null);
    if (issue?.statut === "ENVOYE") envoyesA += 1; else echecs += 1;
  }
  for (const clientId of groupeB) {
    const issue = await envoyerMessageAUnClient({ clientId, canalId: test.canalId, modeleMessageId: test.modeleBId, campagneId: test.campagneId, userId: opts.userId }).catch(() => null);
    if (issue?.statut === "ENVOYE") envoyesB += 1; else echecs += 1;
  }

  return { total: clientIds.length, envoyesA, envoyesB, echecs };
}

export interface ResultatEvaluationTestAB {
  testsEvalues: number;
  conversionsDetectees: number;
}

/**
 * Détecte les conversions (achat depuis le lancement du test) sur les tests
 * EN_COURS — appelé par le cron, même principe que Phase 4/5 (idempotent :
 * ne réévalue que les assignations pas encore converties).
 */
export async function evaluerConversionsTestAB(): Promise<ResultatEvaluationTestAB> {
  const tests = await prisma.testAB.findMany({ where: { statut: "EN_COURS" }, select: { id: true, dateLancement: true } });

  let conversionsDetectees = 0;
  for (const test of tests) {
    if (!test.dateLancement) continue;
    const nonConverties = await prisma.testABAssignation.findMany({
      where: { testId: test.id, converti: false },
      select: { id: true, clientId: true },
    });
    if (!nonConverties.length) continue;

    const achats = await prisma.venteDirecte.findMany({
      where: {
        clientId: { in: nonConverties.map((a) => a.clientId) },
        createdAt: { gte: test.dateLancement },
        statut: { notIn: VENTES_EXCLUES as never },
      },
      select: { clientId: true },
      distinct: ["clientId"],
    });
    const clientsConvertis = new Set(achats.map((a) => a.clientId));

    for (const a of nonConverties) {
      if (!clientsConvertis.has(a.clientId)) continue;
      await prisma.testABAssignation.update({ where: { id: a.id }, data: { converti: true, dateConversion: new Date() } });
      conversionsDetectees += 1;
    }
  }

  return { testsEvalues: tests.length, conversionsDetectees };
}

/** Clôture les tests EN_COURS lancés depuis plus de `dureeJours` (défaut 30j). */
export async function cloturerTestsExpires(dureeJours = 30): Promise<{ cloture: number }> {
  const seuil = new Date(Date.now() - dureeJours * JOUR_MS);
  const { count } = await prisma.testAB.updateMany({
    where: { statut: "EN_COURS", dateLancement: { lte: seuil } },
    data: { statut: "TERMINE" },
  });
  return { cloture: count };
}

export interface StatsVarianteTestAB {
  total: number;
  conversions: number;
  tauxConversion: number | null;
  envoyes: number;
  lus: number;
  tauxLecture: number | null;
}

/** Statistiques comparatives des deux variantes (lecture + conversion). */
export async function statsTestAB(testId: number): Promise<{ A: StatsVarianteTestAB; B: StatsVarianteTestAB }> {
  const test = await prisma.testAB.findUniqueOrThrow({ where: { id: testId }, select: { campagneId: true, modeleAId: true, modeleBId: true } });
  const assignations = await prisma.testABAssignation.findMany({ where: { testId }, select: { variante: true, converti: true, clientId: true } });

  const calc = async (variante: "A" | "B", modeleMessageId: number): Promise<StatsVarianteTestAB> => {
    const groupe = assignations.filter((a) => a.variante === variante);
    const conversions = groupe.filter((a) => a.converti).length;
    const envois = groupe.length
      ? await prisma.envoiMessage.findMany({
          where: { campagneId: test.campagneId, modeleMessageId, clientId: { in: groupe.map((a) => a.clientId) } },
          select: { statut: true },
        })
      : [];
    const envoyes = envois.filter((e) => e.statut !== "EN_ATTENTE" && e.statut !== "ECHEC").length;
    const lus = envois.filter((e) => e.statut === "LU" || e.statut === "REPONSE").length;
    return {
      total: groupe.length, conversions, tauxConversion: groupe.length ? (conversions / groupe.length) * 100 : null,
      envoyes, lus, tauxLecture: envoyes > 0 ? (lus / envoyes) * 100 : null,
    };
  };

  const [A, B] = await Promise.all([calc("A", test.modeleAId), calc("B", test.modeleBId)]);
  return { A, B };
}
