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
 * groupes et envoie la variante correspondante à chacun. Si `tailleEchantillon`
 * est défini sur le test (CDC §72), seul un échantillon de cette taille par
 * variante est prélevé — le reste de l'audience n'est assigné à rien et
 * pourra recevoir la variante gagnante via `deployerVarianteGagnante`.
 */
export async function lancerTestAB(opts: { testId: number; userId: number }): Promise<ResultatLancementTestAB> {
  const test = await prisma.testAB.findUnique({
    where: { id: opts.testId },
    select: { id: true, statut: true, campagneId: true, canalId: true, modeleAId: true, modeleBId: true, tailleEchantillon: true, campagne: { select: { audienceId: true } } },
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
  let groupeA: number[], groupeB: number[];
  if (test.tailleEchantillon && test.tailleEchantillon * 2 < clientIds.length) {
    groupeA = clientIds.slice(0, test.tailleEchantillon);
    groupeB = clientIds.slice(test.tailleEchantillon, test.tailleEchantillon * 2);
  } else {
    const moitie = Math.ceil(clientIds.length / 2);
    groupeA = clientIds.slice(0, moitie);
    groupeB = clientIds.slice(moitie);
  }

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

  return { total: groupeA.length + groupeB.length, envoyesA, envoyesB, echecs };
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
  caGenere: number;
  coutEstime: number;
  roi: number | null;
}

/**
 * Statistiques comparatives des deux variantes (CDC §71 — ouverture, réponse,
 * conversion, CA, ROI) et détermination de la variante gagnante. "Clic" reste
 * hors périmètre (aucun tracking de clic dans ce système, limitation déjà
 * documentée pour les webhooks Twilio/Meta). Le gagnant est déterminé par le
 * taux de conversion (métrique principale), départagé par le CA généré.
 */
export async function statsTestAB(testId: number): Promise<{ A: StatsVarianteTestAB; B: StatsVarianteTestAB; varianteGagnante: "A" | "B" | null }> {
  const test = await prisma.testAB.findUniqueOrThrow({ where: { id: testId }, select: { campagneId: true, modeleAId: true, modeleBId: true, dateLancement: true } });
  const assignations = await prisma.testABAssignation.findMany({ where: { testId }, select: { variante: true, converti: true, clientId: true } });

  const calc = async (variante: "A" | "B", modeleMessageId: number): Promise<StatsVarianteTestAB> => {
    const groupe = assignations.filter((a) => a.variante === variante);
    const convertis = groupe.filter((a) => a.converti);
    const conversions = convertis.length;
    const envois = groupe.length
      ? await prisma.envoiMessage.findMany({
          where: { campagneId: test.campagneId, modeleMessageId, clientId: { in: groupe.map((a) => a.clientId) } },
          select: { statut: true, coutEstime: true },
        })
      : [];
    const envoyes = envois.filter((e) => e.statut !== "EN_ATTENTE" && e.statut !== "ECHEC").length;
    const lus = envois.filter((e) => e.statut === "LU" || e.statut === "REPONSE").length;
    const coutEstime = envois.reduce((s, e) => s + Number(e.coutEstime ?? 0), 0);

    let caGenere = 0;
    if (convertis.length && test.dateLancement) {
      const ventes = await prisma.venteDirecte.aggregate({
        where: { clientId: { in: convertis.map((a) => a.clientId) }, createdAt: { gte: test.dateLancement }, statut: { notIn: VENTES_EXCLUES as never } },
        _sum: { montantTotal: true },
      });
      caGenere = Number(ventes._sum.montantTotal ?? 0);
    }

    return {
      total: groupe.length, conversions, tauxConversion: groupe.length ? (conversions / groupe.length) * 100 : null,
      envoyes, lus, tauxLecture: envoyes > 0 ? (lus / envoyes) * 100 : null,
      caGenere, coutEstime, roi: coutEstime > 0 ? ((caGenere - coutEstime) / coutEstime) * 100 : null,
    };
  };

  const [A, B] = await Promise.all([calc("A", test.modeleAId), calc("B", test.modeleBId)]);

  let varianteGagnante: "A" | "B" | null = null;
  if (A.total > 0 && B.total > 0 && (A.conversions > 0 || B.conversions > 0)) {
    const tauxA = A.tauxConversion ?? 0, tauxB = B.tauxConversion ?? 0;
    if (tauxA !== tauxB) varianteGagnante = tauxA > tauxB ? "A" : "B";
    else varianteGagnante = A.caGenere === B.caGenere ? null : A.caGenere > B.caGenere ? "A" : "B";
  }

  return { A, B, varianteGagnante };
}

export interface ResultatDeploiementTestAB {
  variante: "A" | "B";
  destinataires: number;
  envoyes: number;
  echecs: number;
}

/**
 * CDC §72 — envoie la variante gagnante au reste de l'audience (les membres
 * jamais assignés à l'échantillon A/B). Nécessite un test TERMINE avec un
 * gagnant déterminé (`statsTestAB`) et un `tailleEchantillon` défini (sinon
 * il n'y a pas de "reste" : tout le monde a déjà reçu une variante).
 */
export async function deployerVarianteGagnante(opts: { testId: number; userId: number }): Promise<ResultatDeploiementTestAB> {
  const test = await prisma.testAB.findUnique({
    where: { id: opts.testId },
    select: { id: true, statut: true, campagneId: true, canalId: true, modeleAId: true, modeleBId: true, tailleEchantillon: true, campagne: { select: { audienceId: true } } },
  });
  if (!test) throw new Error("TEST_INTROUVABLE");
  if (test.statut !== "EN_COURS" && test.statut !== "TERMINE") throw new Error("TEST_NON_TERMINE");
  if (!test.tailleEchantillon) throw new Error("PAS_ECHANTILLON");
  if (!test.campagne.audienceId) throw new Error("CAMPAGNE_SANS_AUDIENCE");

  const { varianteGagnante } = await statsTestAB(test.id);
  if (!varianteGagnante) throw new Error("PAS_DE_GAGNANT");

  const [tousMembres, dejaAssignes] = await Promise.all([
    prisma.audienceMarketingMembre.findMany({ where: { audienceId: test.campagne.audienceId }, select: { clientId: true } }),
    prisma.testABAssignation.findMany({ where: { testId: test.id }, select: { clientId: true } }),
  ]);
  const assignesSet = new Set(dejaAssignes.map((a) => a.clientId));
  const reste = tousMembres.map((m) => m.clientId).filter((id) => !assignesSet.has(id));

  const modeleMessageId = varianteGagnante === "A" ? test.modeleAId : test.modeleBId;
  let envoyes = 0, echecs = 0;
  for (const clientId of reste) {
    const issue = await envoyerMessageAUnClient({ clientId, canalId: test.canalId, modeleMessageId, campagneId: test.campagneId, userId: opts.userId }).catch(() => null);
    if (issue?.statut === "ENVOYE") envoyes += 1; else echecs += 1;
  }

  await prisma.$transaction(async (tx) => {
    await tx.testAB.update({ where: { id: test.id }, data: { statut: "DEPLOYE", dateDeploiement: new Date(), varianteDeployee: varianteGagnante } });
    await auditLog(tx, opts.userId, "TEST_AB_DEPLOIE", "TestAB", test.id, { varianteGagnante, destinataires: reste.length });
  });

  return { variante: varianteGagnante, destinataires: reste.length, envoyes, echecs };
}
