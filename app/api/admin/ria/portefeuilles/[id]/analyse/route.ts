import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { dansFenetreAffectation } from "@/lib/riaAffectation";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = await params;
    const pfId = parseInt(id);

    const pf = await prisma.portefeuilleRIA.findUnique({
      where: { id: pfId },
      include: {
        financements: {
          where: { affectationId: { not: null } },
          select: {
            id: true, montantFinance: true, montantRembourse: true,
            encours: true, statut: true, dateFinancement: true, clientId: true,
            affectation:   { select: { dateDebut: true, dateFin: true } },
            remboursements: { select: { montant: true, createdAt: true } },
          },
        },
        affectations: {
          select: { id: true, actif: true, createdAt: true, clientId: true },
        },
        mouvements: {
          select: { id: true, sens: true, montant: true, type: true, createdAt: true },
        },
        distributions: {
          orderBy: [{ annee: "asc" }, { mois: "asc" }],
          select: {
            id: true, mois: true, annee: true,
            montantGenere: true, montantDistribue: true,
          },
        },
      },
    });

    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

    const toN = (v: unknown) => Number(v ?? 0);

    // Recouvré borné à la fenêtre d'affectation : montantRembourse et encours sont
    // recalculés depuis les RemboursementRIA tombant dans [dateDebut, dateFin].
    const fins = pf.financements.map((f) => {
      const rembFenetre = f.remboursements.reduce(
        (s, r) => (dansFenetreAffectation(f.affectation, r.createdAt) ? s + toN(r.montant) : s),
        0,
      );
      const montantFinance = toN(f.montantFinance);
      return { ...f, montantRembourse: rembFenetre, encours: Math.max(0, montantFinance - rembFenetre) };
    });

    // ── Durée du portefeuille ──────────────────────────────────────────────────
    const dureeMs    = Date.now() - new Date(pf.createdAt).getTime();
    const dureeMois  = Math.max(1, dureeMs / (30.44 * 24 * 60 * 60 * 1000));
    const dureeAns   = dureeMois / 12;

    // ── Performance Financière ─────────────────────────────────────────────────
    const capitalInvesti  = toN(pf.capitalInvesti);
    const capitalRecupere = toN(pf.capitalRecouvre);
    const beneficeBrut    = toN(pf.beneficesGeneres);
    // Bénéfice net = brut - fonds de sécurité réservé
    const beneficeNet     = beneficeBrut - toN(pf.fondSecurite);

    // ROI = (bénéfice brut / capital investi) × 100
    const roi = capitalInvesti > 0 ? (beneficeBrut / capitalInvesti) * 100 : 0;

    // Rendement mensuel = ROI / durée en mois
    const rendementMensuel = dureeMois > 0 ? roi / dureeMois : 0;

    // Rendement annuel = rendement mensuel × 12
    const rendementAnnuel = rendementMensuel * 12;

    // TRI simplifié : taux de rendement annualisé (CAGR)
    // TRI = (1 + ROI/100)^(1/dureeAns) - 1
    const triSimplifiee =
      capitalInvesti > 0 && dureeAns > 0
        ? (Math.pow(1 + roi / 100, 1 / dureeAns) - 1) * 100
        : 0;

    // Cash-flow net = ∑ crédits - ∑ débits (mouvements de fonds)
    const cashFlowEntrees = pf.mouvements
      .filter((m) => m.sens === "CREDIT")
      .reduce((s, m) => s + toN(m.montant), 0);
    const cashFlowSorties = pf.mouvements
      .filter((m) => m.sens === "DEBIT")
      .reduce((s, m) => s + toN(m.montant), 0);
    const cashFlowNet = cashFlowEntrees - cashFlowSorties;

    // ── Performance Commerciale ────────────────────────────────────────────────
    const clientsFinancesIds = new Set(fins.map((f) => f.clientId));
    const nbClientsFinances  = clientsFinancesIds.size;

    const il30j = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const nouveauxClients = pf.affectations.filter(
      (a) => new Date(a.createdAt) >= il30j
    ).length;

    const clientsActifs   = pf.affectations.filter((a) => a.actif).length;
    const clientsInactifs = pf.affectations.filter((a) => !a.actif).length;

    // "Perdus" = clients ayant au moins un financement en DEFAUT
    const clientsPerduIds = new Set(
      fins
        .filter((f) => f.statut === "DEFAUT")
        .map((f) => f.clientId)
    );
    const clientsPerdus = clientsPerduIds.size;

    // ── Performance de Recouvrement ───────────────────────────────────────────
    const montantAttendu   = fins.reduce((s, f) => s + toN(f.montantFinance), 0);
    const montantRecouvre  = fins.reduce((s, f) => s + toN(f.montantRembourse), 0);
    const ecart            = montantAttendu - montantRecouvre;
    const tauxRecouvrement = montantAttendu > 0 ? (montantRecouvre / montantAttendu) * 100 : 0;

    const encoursImpayes = fins
      .filter((f) => f.statut === "EN_RETARD" || f.statut === "DEFAUT")
      .reduce((s, f) => s + toN(f.encours), 0);
    const totalEncours  = fins.reduce((s, f) => s + toN(f.encours), 0);
    const tauxImpayes   = totalEncours > 0 ? (encoursImpayes / totalEncours) * 100 : 0;

    // ── Évolution mensuelle du rendement (depuis les distributions) ───────────
    const evolutionMensuelle = pf.distributions.map((d) => ({
      mois: d.mois,
      annee: d.annee,
      montantGenere:    toN(d.montantGenere),
      montantDistribue: toN(d.montantDistribue),
      rendementMois:    capitalInvesti > 0 ? (toN(d.montantGenere) / capitalInvesti) * 100 : 0,
    }));

    return NextResponse.json({
      data: {
        // Meta
        dureeMois:  Math.round(dureeMois),
        dureeAns:   parseFloat(dureeAns.toFixed(2)),

        // Performance financière
        capitalInvesti,
        capitalRecupere,
        beneficeBrut,
        beneficeNet,
        rendementMensuel: parseFloat(rendementMensuel.toFixed(4)),
        rendementAnnuel:  parseFloat(rendementAnnuel.toFixed(4)),
        roi:              parseFloat(roi.toFixed(4)),
        triSimplifiee:    parseFloat(triSimplifiee.toFixed(4)),
        cashFlowNet,
        cashFlowEntrees,
        cashFlowSorties,

        // Performance commerciale
        nbClientsFinances,
        nouveauxClients,
        clientsActifs,
        clientsInactifs,
        clientsPerdus,

        // Performance de recouvrement
        montantAttendu,
        montantRecouvre,
        ecart,
        tauxRecouvrement: parseFloat(tauxRecouvrement.toFixed(2)),
        tauxImpayes:      parseFloat(tauxImpayes.toFixed(2)),
        encoursImpayes,
        totalEncours,

        // Historique
        evolutionMensuelle,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/portefeuilles/[id]/analyse", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
