import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession, getComptablePdvId } from "@/lib/authComptable";
import { resolveViewAs } from "@/lib/viewAs";
import { creerEcriture } from "@/lib/comptabilite/moteur";

/**
 * POST /api/comptable/sync-journals
 *
 * Génère automatiquement des EcritureComptable en double entrée SYSCOHADA
 * depuis les modules opérationnels existants :
 *   - OperationCaisse  → Journal CAISSE
 *   - VersementPack    → Journal VENTES
 *   - MouvementStock   → Journal ACHATS
 *
 * Les entrées déjà importées (même référence) sont ignorées silencieusement.
 * Statut initial : BROUILLON (le comptable valide après vérification).
 *
 * Body: { action: "caisse"|"ventes"|"achats"|"all", dateMin?: string, dateMax?: string }
 */

// Numéros de comptes SYSCOHADA utilisés pour la génération automatique
const N = {
  CAISSE:       "571",   // Caisse siège
  BANQUE:       "521",   // Banques comptes courants
  CLIENTS:      "411",   // Clients
  FOURNISSEURS: "401",   // Fournisseurs
  VENTES:       "701",   // Ventes de marchandises
  MARCHANDISES: "311",   // Marchandises (stock)
  SALAIRES:     "661",   // Rémunérations directes
  AVANCES:      "471",   // Débiteurs divers
  ACHATS_AUTRES:"605",   // Autres achats
};

type ComptesMap = Record<string, number>; // numéro → id

async function chargerComptes(): Promise<{ map: ComptesMap; manquants: string[] }> {
  const nums = Object.values(N);
  const comptes = await prisma.compteComptable.findMany({
    where: { numero: { in: nums }, actif: true },
    select: { id: true, numero: true },
  });
  const map: ComptesMap = {};
  for (const c of comptes) map[c.numero] = c.id;

  const manquants = nums.filter((n) => !map[n]);
  return { map, manquants };
}

/** Vérifie si une écriture avec cette référence existe déjà */
async function referenceExiste(reference: string): Promise<boolean> {
  const e = await prisma.ecritureComptable.findUnique({ where: { reference }, select: { id: true } });
  return !!e;
}

// ─────────────────────────────────────────────────────────────────────────────
// Générateurs par source
// ─────────────────────────────────────────────────────────────────────────────

async function syncCaisse(
  userId: number,
  dateMin: Date,
  dateMax: Date,
  pdvId: number | null
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const pdvFilter = pdvId !== null ? { session: { pointDeVenteId: pdvId } } : {};

  const ops = await prisma.operationCaisse.findMany({
    where: { createdAt: { gte: dateMin, lte: dateMax }, ...pdvFilter },
    orderBy: { createdAt: "asc" },
  });

  for (const op of ops) {
    const ref = `SYNC-OPC-${op.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant = Number(op.montant);

    if (op.type === "ENCAISSEMENT") {
      // Débit 571 Caisse / Crédit 411 Clients
      const id = await creerEcriture(prisma, {
        journal: "CAISSE", date: op.createdAt, libelle: `Encaissement caisse — ${op.motif}`,
        userId, reference: ref,
        lignes: [
          { numero: N.CAISSE, debit: montant, libelle: op.motif },
          { numero: N.CLIENTS, credit: montant, libelle: op.motif },
        ],
      });
      id ? created++ : skipped++;
    } else {
      // DECAISSEMENT : compte de charge selon catégorie
      const compteChargeNum =
        op.categorie === "SALAIRE"     ? N.SALAIRES    :
        op.categorie === "AVANCE"      ? N.AVANCES     :
        op.categorie === "FOURNISSEUR" ? N.FOURNISSEURS :
        N.ACHATS_AUTRES;

      const libelleCat =
        op.categorie === "SALAIRE"     ? "Salaires" :
        op.categorie === "AVANCE"      ? "Avance au personnel" :
        op.categorie === "FOURNISSEUR" ? "Paiement fournisseur" :
        "Décaissement caisse";

      const id = await creerEcriture(prisma, {
        journal: "CAISSE", date: op.createdAt, libelle: `${libelleCat} — ${op.motif}`,
        userId, reference: ref,
        lignes: [
          { numero: compteChargeNum, debit: montant, libelle: op.motif },
          { numero: N.CAISSE, credit: montant, libelle: op.motif },
        ],
      });
      id ? created++ : skipped++;
    }
  }

  return { created, skipped };
}

async function syncVentes(
  userId: number,
  dateMin: Date,
  dateMax: Date,
  pdvId: number | null
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const pdvFilter = pdvId !== null
    ? { souscription: { client: { pointDeVenteId: pdvId } } }
    : {};

  const versements = await prisma.versementPack.findMany({
    where: {
      datePaiement: { gte: dateMin, lte: dateMax },
      statut:       "PAYE",
      ...pdvFilter,
    },
    include: {
      souscription: {
        include: {
          pack:   { select: { nom: true, type: true } },
          client: { select: { nom: true, prenom: true } },
          user:   { select: { nom: true, prenom: true } },
        },
      },
    },
    orderBy: { datePaiement: "asc" },
  });

  for (const v of versements) {
    const ref = `SYNC-VRS-${v.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant = Number(v.montant);
    const person  = v.souscription.client ?? v.souscription.user;
    const nomClient = person ? `${person.prenom} ${person.nom}` : "Client";
    const packLabel = `${v.souscription.pack.nom}`;

    let id: number | null;
    if (v.type === "REMBOURSEMENT") {
      // Remboursement : Débit 411 Clients / Crédit 571 Caisse
      id = await creerEcriture(prisma, {
        journal: "VENTES", date: v.datePaiement, libelle: `Remboursement ${packLabel} — ${nomClient}`,
        userId, reference: ref,
        lignes: [
          { numero: N.CLIENTS, debit: montant, libelle: `Remboursement ${nomClient}` },
          { numero: N.CAISSE, credit: montant, libelle: `Remboursement ${nomClient}` },
        ],
      });
    } else {
      // Vente (cotisation, versement périodique) : Débit 571 Caisse / Crédit 701 Ventes
      const typeLabel =
        v.type === "COTISATION_INITIALE"  ? "Acompte initial" :
        v.type === "VERSEMENT_PERIODIQUE" ? "Versement périodique" :
        v.type === "BONUS"                ? "Bonus" : "Versement";

      id = await creerEcriture(prisma, {
        journal: "VENTES", date: v.datePaiement, libelle: `${typeLabel} — ${packLabel} — ${nomClient}`,
        userId, reference: ref,
        lignes: [
          { numero: N.CAISSE, debit: montant, libelle: `${typeLabel} ${nomClient}` },
          { numero: N.VENTES, credit: montant, libelle: `${typeLabel} ${nomClient}` },
        ],
      });
    }
    id ? created++ : skipped++;
  }

  return { created, skipped };
}

async function syncVentesDirectes(
  userId: number,
  dateMin: Date,
  dateMax: Date,
  pdvId: number | null
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const pdvFilter = pdvId !== null ? { pointDeVenteId: pdvId } : {};

  // Les VenteDirecte avec modePaiement=CREDIT sont des créances (aucun cash reçu) —
  // elles sont traitées via le module CreditClient/RemboursementCredit, pas ici.
  // Les ventes comptant récentes ont déjà leur écriture générée à la création
  // (lib/ecritureVenteServer.ts) ; cette synchronisation ne fait plus que du
  // rattrapage sur d'éventuelles ventes antérieures — idempotente par référence.
  const ventes = await prisma.venteDirecte.findMany({
    where: {
      statut:       { notIn: ["BROUILLON", "ANNULEE"] },
      modePaiement: { not: "CREDIT" },
      createdAt:    { gte: dateMin, lte: dateMax },
      ...pdvFilter,
    },
    select: { id: true, reference: true, createdAt: true, montantPaye: true, clientNom: true, modePaiement: true },
    orderBy: { createdAt: "asc" },
  });

  for (const v of ventes) {
    const ref = `SYNC-VD-${v.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant = Number(v.montantPaye);
    const client  = v.clientNom ?? "Client comptoir";

    const id = await creerEcriture(prisma, {
      journal: "VENTES", date: v.createdAt, libelle: `Vente directe — ${v.reference} — ${client}`,
      userId, reference: ref,
      lignes: [
        { numero: N.CAISSE, debit: montant, libelle: `VD ${v.reference}` },
        { numero: N.VENTES, credit: montant, libelle: `VD ${v.reference}` },
      ],
    });
    id ? created++ : skipped++;
  }

  return { created, skipped };
}

async function syncAchats(
  userId: number,
  dateMin: Date,
  dateMax: Date,
  pdvId: number | null
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const pdvFilter = pdvId !== null ? { pointDeVenteId: pdvId } : {};

  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      type:          "ENTREE",
      dateMouvement: { gte: dateMin, lte: dateMax },
      NOT: { reference: { startsWith: "INIT-" } },
      ...pdvFilter,
    },
    include: { produit: { select: { nom: true, prixUnitaire: true } } },
    orderBy: { dateMouvement: "asc" },
  });

  for (const m of mouvements) {
    const ref = `SYNC-MST-${m.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant = m.quantite * Number(m.produit.prixUnitaire);

    const id = await creerEcriture(prisma, {
      journal: "ACHATS", date: m.dateMouvement,
      libelle: `Approvisionnement ${m.produit.nom} ×${m.quantite}${m.motif ? ` — ${m.motif}` : ""}`,
      userId, reference: ref,
      lignes: [
        { numero: N.MARCHANDISES, debit: montant, libelle: m.produit.nom },
        { numero: N.FOURNISSEURS, credit: montant, libelle: m.produit.nom },
      ],
    });
    id ? created++ : skipped++;
  }

  return { created, skipped };
}

// ── RIA : remboursements de financement ───────────────────────────────────────
// SYNC-RIA-REMB-{id} : OD — Débit 471 (obligation investisseur allégée) / Crédit 411 (créance client allégée)
async function syncRIARemboursements(
  userId: number,
  dateMin: Date,
  dateMax: Date
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const remboursements = await prisma.remboursementRIA.findMany({
    where: { createdAt: { gte: dateMin, lte: dateMax } },
    include: {
      financement: {
        select: {
          reference: true,
          client: { select: { nom: true, prenom: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const r of remboursements) {
    const ref = `SYNC-RIA-REMB-${r.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant  = Number(r.montant);
    const clientNom = r.financement?.client
      ? `${r.financement.client.prenom} ${r.financement.client.nom}`
      : "Client RIA";
    const finRef   = r.financement?.reference ?? `FIN-${r.financementId}`;

    const id = await creerEcriture(prisma, {
      journal: "OD", date: r.createdAt, libelle: `Remboursement RIA — ${finRef} — ${clientNom}`,
      userId, reference: ref,
      lignes: [
        { numero: N.AVANCES, debit: montant, libelle: `Rbt RIA ${finRef}` },
        { numero: N.CLIENTS, credit: montant, libelle: `Rbt RIA ${finRef}` },
      ],
    });
    id ? created++ : skipped++;
  }

  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;

    const body = await req.json();
    const { action = "all", dateMin, dateMax } = body as { action?: string; dateMin?: string; dateMax?: string };

    const userId = Number(session.user.id);
    const pdvId  = await getComptablePdvId(session, viewAs?.userId);

    // Fenêtre temporelle (défaut : tout depuis 1 an)
    const fin   = dateMax ? new Date(dateMax + "T23:59:59") : new Date();
    const debut = dateMin ? new Date(dateMin) : new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());

    // Vérification préalable (UX) : le moteur central résout chaque compte par
    // lui-même, mais ce contrôle amont donne un message clair avant de lancer
    // le traitement plutôt que des lignes silencieusement ignorées une à une.
    const { manquants } = await chargerComptes();

    if (manquants.length > 0) {
      return NextResponse.json({
        error: `Plan comptable incomplet. Comptes manquants : ${manquants.join(", ")}. Importez d'abord le plan SYSCOHADA (onglet "Plan Comptable").`,
        manquants,
      }, { status: 422 });
    }

    const resultats: Record<string, { created: number; skipped: number }> = {};

    if (action === "caisse" || action === "all") {
      resultats.caisse = await syncCaisse(userId, debut, fin, pdvId);
    }
    if (action === "ventes" || action === "all") {
      resultats.ventes          = await syncVentes(userId, debut, fin, pdvId);
      resultats.ventes_directes = await syncVentesDirectes(userId, debut, fin, pdvId);
    }
    if (action === "achats" || action === "all") {
      resultats.achats = await syncAchats(userId, debut, fin, pdvId);
    }
    if (action === "ria" || action === "all") {
      resultats.ria_remboursements = await syncRIARemboursements(userId, debut, fin);
    }

    const totalCreated = Object.values(resultats).reduce((s, r) => s + r.created, 0);
    const totalSkipped = Object.values(resultats).reduce((s, r) => s + r.skipped, 0);

    return NextResponse.json({
      success: true,
      message: `${totalCreated} écriture(s) générée(s) · ${totalSkipped} déjà importée(s) ignorée(s)`,
      resultats,
      totaux: { created: totalCreated, skipped: totalSkipped },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** GET : aperçu — combien d'opérations non encore importées */
export async function GET(req: NextRequest) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
    const viewAs  = isAdmin ? resolveViewAs(req) : null;

    const { searchParams } = new URL(req.url);
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");

    const fin   = dateMax ? new Date(dateMax + "T23:59:59") : new Date();
    const debut = dateMin ? new Date(dateMin) : new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());

    const pdvId = await getComptablePdvId(session, viewAs?.userId);
    const pdvCaisseFilter    = pdvId !== null ? { session: { pointDeVenteId: pdvId } } : {};
    const pdvMouvFilter      = pdvId !== null ? { pointDeVenteId: pdvId } : {};
    const pdvVersFilter      = pdvId !== null ? { souscription: { client: { pointDeVenteId: pdvId } } } : {};
    const pdvVenteDirFilter  = pdvId !== null ? { pointDeVenteId: pdvId } : {};

    // Récupérer les références déjà synchonisées
    const dejaImportees = await prisma.ecritureComptable.findMany({
      where: { reference: { startsWith: "SYNC-" } },
      select: { reference: true },
    });
    const syncRefs = new Set(dejaImportees.map((e) => e.reference));

    const [nbCaisse, nbVentes, nbVentesDir, nbAchats, nbRIARemb] = await Promise.all([
      prisma.operationCaisse.count({ where: { createdAt: { gte: debut, lte: fin }, ...pdvCaisseFilter } }),
      prisma.versementPack.count({ where: { datePaiement: { gte: debut, lte: fin }, statut: "PAYE", ...pdvVersFilter } }),
      prisma.venteDirecte.count({ where: { statut: { notIn: ["BROUILLON", "ANNULEE"] }, modePaiement: { not: "CREDIT" }, createdAt: { gte: debut, lte: fin }, ...pdvVenteDirFilter } }),
      prisma.mouvementStock.count({
        where: { type: "ENTREE", dateMouvement: { gte: debut, lte: fin }, NOT: { reference: { startsWith: "INIT-" } }, ...pdvMouvFilter },
      }),
      prisma.remboursementRIA.count({ where: { createdAt: { gte: debut, lte: fin } } }),
    ]);

    // Calculer les non encore importés
    const caisseSyncees    = [...syncRefs].filter((r) => r.startsWith("SYNC-OPC-")).length;
    const ventesSyncees    = [...syncRefs].filter((r) => r.startsWith("SYNC-VRS-")).length;
    const ventesDirSyncees = [...syncRefs].filter((r) => r.startsWith("SYNC-VD-")).length;
    const achatsSyncees    = [...syncRefs].filter((r) => r.startsWith("SYNC-MST-")).length;
    const riaRembSyncees   = [...syncRefs].filter((r) => r.startsWith("SYNC-RIA-REMB-")).length;

    return NextResponse.json({
      apercu: {
        caisse:             { total: nbCaisse,    dejaSyncees: caisseSyncees,    aSyncer: Math.max(0, nbCaisse    - caisseSyncees) },
        ventes:             { total: nbVentes,    dejaSyncees: ventesSyncees,    aSyncer: Math.max(0, nbVentes    - ventesSyncees) },
        ventes_directes:    { total: nbVentesDir, dejaSyncees: ventesDirSyncees, aSyncer: Math.max(0, nbVentesDir - ventesDirSyncees) },
        achats:             { total: nbAchats,    dejaSyncees: achatsSyncees,    aSyncer: Math.max(0, nbAchats    - achatsSyncees) },
        ria_remboursements: { total: nbRIARemb,   dejaSyncees: riaRembSyncees,   aSyncer: Math.max(0, nbRIARemb  - riaRembSyncees) },
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
