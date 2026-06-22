import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import { dansFenetreAffectation } from "@/lib/riaAffectation";

const MOIS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export async function POST(req: Request) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const portefeuilleId = parseInt(body.portefeuilleId);
    const mois           = parseInt(body.mois);   // 1-12
    const annee          = parseInt(body.annee);

    if (!portefeuilleId || !mois || !annee || mois < 1 || mois > 12) {
      return NextResponse.json({ error: "portefeuilleId, mois (1-12) et annee sont requis" }, { status: 400 });
    }

    const debutMois = new Date(annee, mois - 1, 1);
    const finMois   = new Date(annee, mois, 0, 23, 59, 59, 999);

    // ── Charger toutes les données du portefeuille ─────────────────────────────
    const pf = await prisma.portefeuilleRIA.findUnique({
      where: { id: portefeuilleId },
      include: {
        profilRIA: {
          include: {
            gestionnaire: { include: { member: { select: { nom: true, prenom: true, email: true } } } },
          },
        },
        financements: {
          where: { affectationId: { not: null } },
          select: {
            id: true, reference: true, statut: true,
            montantFinance: true, montantRembourse: true, encours: true,
            dateFinancement: true, dateEcheance: true, clientId: true,
            client: { select: { nom: true, prenom: true } },
            affectation:   { select: { dateDebut: true, dateFin: true } },
            remboursements: { select: { montant: true, createdAt: true } },
          },
        },
        depots: {
          where: { statut: "VALIDE", updatedAt: { gte: debutMois, lte: finMois } },
          select: { montant: true, updatedAt: true, notes: true },
        },
        retraits: {
          where: { statut: "PAYE", updatedAt: { gte: debutMois, lte: finMois } },
          select: { montant: true, updatedAt: true, motif: true },
        },
        distributions: {
          where: { mois, annee },
          select: { montantGenere: true, montantDistribue: true, montantReinvesti: true, montantFondSecurite: true },
        },
      },
    });

    if (!pf) return NextResponse.json({ error: "Portefeuille introuvable" }, { status: 404 });

    const investisseur = pf.profilRIA?.gestionnaire?.member
      ? `${pf.profilRIA.gestionnaire.member.prenom} ${pf.profilRIA.gestionnaire.member.nom}`
      : "—";

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

    // ── Métriques capital ──────────────────────────────────────────────────────
    const capitalInvesti   = toN(pf.capitalInvesti);
    const capitalEngage    = toN(pf.capitalEngage);
    const capitalRecupere  = toN(pf.capitalRecouvre);
    const capitalDisponible = toN(pf.capitalDisponible);

    // ── Gains et rendement ─────────────────────────────────────────────────────
    const gainsRealises  = pf.distributions.reduce((s, d) => s + toN(d.montantDistribue), 0);
    const gainsTotal     = toN(pf.beneficesGeneres);
    const rendementMois  = capitalInvesti > 0 ? (gainsRealises / capitalInvesti) * 100 : 0;

    // ── Clients financés ───────────────────────────────────────────────────────
    const clientsIds = new Set(fins.filter((f) => f.statut !== "ANNULE").map((f) => f.clientId));
    const clientsFinances = clientsIds.size;

    // ── Encours & Recouvrement ─────────────────────────────────────────────────
    const encours             = fins.reduce((s, f) => s + toN(f.encours), 0);
    const montantFinanceTotal  = fins.reduce((s, f) => s + toN(f.montantFinance), 0);
    const montantRecouvreTotal = fins.reduce((s, f) => s + toN(f.montantRembourse), 0);
    const tauxRecouvrement     = montantFinanceTotal > 0 ? (montantRecouvreTotal / montantFinanceTotal) * 100 : 0;

    // ── Retards ────────────────────────────────────────────────────────────────
    const fins_EN_RETARD = fins.filter((f) => f.statut === "EN_RETARD");
    const retardsNb      = fins_EN_RETARD.length;
    const retardsMontant = fins_EN_RETARD.reduce((s, f) => s + toN(f.encours), 0);

    // ── Créances douteuses : EN_RETARD > 30 jours ─────────────────────────────
    const now = new Date();
    const douteusesList = fins_EN_RETARD.filter((f) => {
      if (!f.dateEcheance) return false;
      return Math.floor((now.getTime() - new Date(f.dateEcheance).getTime()) / 86400000) > 30;
    });
    const creancesDouteuseNb       = douteusesList.length;
    const creancesDouteusesMontant = douteusesList.reduce((s, f) => s + toN(f.encours), 0);

    // ── Créances perdues : DEFAUT ──────────────────────────────────────────────
    const fins_DEFAUT              = fins.filter((f) => f.statut === "DEFAUT");
    const creancesPerduseNb        = fins_DEFAUT.length;
    const creancesPerdusesMontant  = fins_DEFAUT.reduce((s, f) => s + toN(f.encours), 0);

    // ── Détail financements (actifs + en retard + défaut, max 50) ─────────────
    const financementsDetail = fins
      .filter((f) => ["ACTIF", "EN_RETARD", "DEFAUT"].includes(f.statut))
      .slice(0, 50)
      .map((f) => ({
        reference: f.reference,
        client:    `${f.client.prenom} ${f.client.nom}`,
        statut:    f.statut,
        montant:   toN(f.montantFinance),
        rembourse: toN(f.montantRembourse),
        encours:   toN(f.encours),
        dateEcheance: f.dateEcheance ? f.dateEcheance.toISOString() : null,
      }));

    // ── Assembler les données ──────────────────────────────────────────────────
    const donnees = {
      periode:           { mois, annee, label: `${MOIS_FR[mois - 1]} ${annee}` },
      portefeuille:      { reference: pf.reference, nom: pf.nom, investisseur, numero: pf.profilRIA?.numero ?? null },
      capitalInvesti,
      capitalEngage,
      capitalRecupere,
      capitalDisponible,
      rendementMois:     parseFloat(rendementMois.toFixed(4)),
      gainsRealises,
      gainsTotal,
      clientsFinances,
      encours,
      montantFinanceTotal,
      montantRecouvreTotal,
      tauxRecouvrement:  parseFloat(tauxRecouvrement.toFixed(2)),
      retardsNb,
      retardsMontant,
      creancesDouteuseNb,
      creancesDouteusesMontant,
      creancesPerduseNb,
      creancesPerdusesMontant,
      depots:      pf.depots.map((d) => ({ date: d.updatedAt, montant: toN(d.montant), motif: d.notes })),
      retraits:    pf.retraits.map((r) => ({ date: r.updatedAt, montant: toN(r.montant), motif: r.motif })),
      distributions: pf.distributions.map((d) => ({
        montantGenere:       toN(d.montantGenere),
        montantDistribue:    toN(d.montantDistribue),
        montantReinvesti:    toN(d.montantReinvesti),
        montantFondSecurite: toN(d.montantFondSecurite),
      })),
      financementsDetail,
      genereA: new Date().toISOString(),
    };

    // ── Upsert ─────────────────────────────────────────────────────────────────
    const rapport = await prisma.rapportMensuelRIA.upsert({
      where:  { portefeuilleId_mois_annee: { portefeuilleId, mois, annee } },
      create: { portefeuilleId, mois, annee, donnees, genereParId: parseInt(session.user.id!) },
      update: { donnees, genereParId: parseInt(session.user.id!) },
    });

    return NextResponse.json({ data: { id: rapport.id, portefeuilleId, mois, annee, donnees } }, { status: 200 });
  } catch (error) {
    console.error("POST /api/admin/ria/rapports/generer", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
