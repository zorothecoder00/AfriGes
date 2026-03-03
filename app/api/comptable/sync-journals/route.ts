import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getComptableSession } from "@/lib/authComptable";

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
  map: ComptesMap,
  userId: number,
  dateMin: Date,
  dateMax: Date
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const ops = await prisma.operationCaisse.findMany({
    where: { createdAt: { gte: dateMin, lte: dateMax } },
    orderBy: { createdAt: "asc" },
  });

  for (const op of ops) {
    const ref = `SYNC-OPC-${op.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    const montant = Number(op.montant);

    if (op.type === "ENCAISSEMENT") {
      // Débit 571 Caisse / Crédit 411 Clients
      if (!map[N.CAISSE] || !map[N.CLIENTS]) { skipped++; continue; }
      await prisma.ecritureComptable.create({
        data: {
          reference: ref,
          date:      op.createdAt,
          libelle:   `Encaissement caisse — ${op.motif}`,
          journal:   "CAISSE",
          statut:    "BROUILLON",
          userId,
          lignes: {
            create: [
              { compteId: map[N.CAISSE],   libelle: op.motif, debit: montant, credit: 0 },
              { compteId: map[N.CLIENTS],  libelle: op.motif, debit: 0, credit: montant },
            ],
          },
        },
      });
      created++;
    } else {
      // DECAISSEMENT : compte de charge selon catégorie
      const compteChargeNum =
        op.categorie === "SALAIRE"     ? N.SALAIRES    :
        op.categorie === "AVANCE"      ? N.AVANCES     :
        op.categorie === "FOURNISSEUR" ? N.FOURNISSEURS :
        N.ACHATS_AUTRES;

      if (!map[compteChargeNum] || !map[N.CAISSE]) { skipped++; continue; }

      const libelleCat =
        op.categorie === "SALAIRE"     ? "Salaires" :
        op.categorie === "AVANCE"      ? "Avance au personnel" :
        op.categorie === "FOURNISSEUR" ? "Paiement fournisseur" :
        "Décaissement caisse";

      await prisma.ecritureComptable.create({
        data: {
          reference: ref,
          date:      op.createdAt,
          libelle:   `${libelleCat} — ${op.motif}`,
          journal:   "CAISSE",
          statut:    "BROUILLON",
          userId,
          lignes: {
            create: [
              { compteId: map[compteChargeNum], libelle: op.motif, debit: montant, credit: 0 },
              { compteId: map[N.CAISSE],         libelle: op.motif, debit: 0, credit: montant },
            ],
          },
        },
      });
      created++;
    }
  }

  return { created, skipped };
}

async function syncVentes(
  map: ComptesMap,
  userId: number,
  dateMin: Date,
  dateMax: Date
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const versements = await prisma.versementPack.findMany({
    where: {
      datePaiement: { gte: dateMin, lte: dateMax },
      statut:       "PAYE",
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

    if (v.type === "REMBOURSEMENT") {
      // Remboursement : Débit 411 Clients / Crédit 571 Caisse
      if (!map[N.CLIENTS] || !map[N.CAISSE]) { skipped++; continue; }
      await prisma.ecritureComptable.create({
        data: {
          reference: ref,
          date:      v.datePaiement,
          libelle:   `Remboursement ${packLabel} — ${nomClient}`,
          journal:   "VENTES",
          statut:    "BROUILLON",
          userId,
          lignes: {
            create: [
              { compteId: map[N.CLIENTS], libelle: `Remboursement ${nomClient}`, debit: montant, credit: 0 },
              { compteId: map[N.CAISSE],  libelle: `Remboursement ${nomClient}`, debit: 0, credit: montant },
            ],
          },
        },
      });
    } else {
      // Vente (cotisation, versement périodique) : Débit 571 Caisse / Crédit 701 Ventes
      if (!map[N.CAISSE] || !map[N.VENTES]) { skipped++; continue; }

      const typeLabel =
        v.type === "COTISATION_INITIALE"  ? "Acompte initial" :
        v.type === "VERSEMENT_PERIODIQUE" ? "Versement périodique" :
        v.type === "BONUS"                ? "Bonus" : "Versement";

      await prisma.ecritureComptable.create({
        data: {
          reference: ref,
          date:      v.datePaiement,
          libelle:   `${typeLabel} — ${packLabel} — ${nomClient}`,
          journal:   "VENTES",
          statut:    "BROUILLON",
          userId,
          lignes: {
            create: [
              { compteId: map[N.CAISSE],  libelle: `${typeLabel} ${nomClient}`, debit: montant, credit: 0 },
              { compteId: map[N.VENTES],  libelle: `${typeLabel} ${nomClient}`, debit: 0, credit: montant },
            ],
          },
        },
      });
    }
    created++;
  }

  return { created, skipped };
}

async function syncAchats(
  map: ComptesMap,
  userId: number,
  dateMin: Date,
  dateMax: Date
): Promise<{ created: number; skipped: number }> {
  let created = 0; let skipped = 0;

  const mouvements = await prisma.mouvementStock.findMany({
    where: {
      type:          "ENTREE",
      dateMouvement: { gte: dateMin, lte: dateMax },
      // Exclure les entrées de stock initial
      NOT: { reference: { startsWith: "INIT-" } },
    },
    include: { produit: { select: { nom: true, prixUnitaire: true } } },
    orderBy: { dateMouvement: "asc" },
  });

  for (const m of mouvements) {
    const ref = `SYNC-MST-${m.id}`;
    if (await referenceExiste(ref)) { skipped++; continue; }

    if (!map[N.MARCHANDISES] || !map[N.FOURNISSEURS]) { skipped++; continue; }

    const montant = m.quantite * Number(m.produit.prixUnitaire);

    await prisma.ecritureComptable.create({
      data: {
        reference: ref,
        date:      m.dateMouvement,
        libelle:   `Approvisionnement ${m.produit.nom} ×${m.quantite}${m.motif ? ` — ${m.motif}` : ""}`,
        journal:   "ACHATS",
        statut:    "BROUILLON",
        userId,
        lignes: {
          create: [
            { compteId: map[N.MARCHANDISES], libelle: m.produit.nom, debit: montant, credit: 0 },
            { compteId: map[N.FOURNISSEURS], libelle: m.produit.nom, debit: 0, credit: montant },
          ],
        },
      },
    });
    created++;
  }

  return { created, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { action = "all", dateMin, dateMax } = body;

    const userId = Number(session.user.id);

    // Fenêtre temporelle (défaut : tout depuis 1 an)
    const fin   = dateMax ? new Date(dateMax + "T23:59:59") : new Date();
    const debut = dateMin ? new Date(dateMin) : new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());

    // Charger les comptes nécessaires
    const { map, manquants } = await chargerComptes();

    if (manquants.length > 0) {
      return NextResponse.json({
        error: `Plan comptable incomplet. Comptes manquants : ${manquants.join(", ")}. Importez d'abord le plan SYSCOHADA (onglet "Plan Comptable").`,
        manquants,
      }, { status: 422 });
    }

    const resultats: Record<string, { created: number; skipped: number }> = {};

    if (action === "caisse" || action === "all") {
      resultats.caisse = await syncCaisse(map, userId, debut, fin);
    }
    if (action === "ventes" || action === "all") {
      resultats.ventes = await syncVentes(map, userId, debut, fin);
    }
    if (action === "achats" || action === "all") {
      resultats.achats = await syncAchats(map, userId, debut, fin);
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
export async function GET(req: Request) {
  try {
    const session = await getComptableSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const dateMin = searchParams.get("dateMin");
    const dateMax = searchParams.get("dateMax");

    const fin   = dateMax ? new Date(dateMax + "T23:59:59") : new Date();
    const debut = dateMin ? new Date(dateMin) : new Date(fin.getFullYear() - 1, fin.getMonth(), fin.getDate());

    // Récupérer les références déjà synchonisées
    const dejaImportees = await prisma.ecritureComptable.findMany({
      where: { reference: { startsWith: "SYNC-" } },
      select: { reference: true },
    });
    const syncRefs = new Set(dejaImportees.map((e) => e.reference));

    const [nbCaisse, nbVentes, nbAchats] = await Promise.all([
      prisma.operationCaisse.count({ where: { createdAt: { gte: debut, lte: fin } } }),
      prisma.versementPack.count({ where: { datePaiement: { gte: debut, lte: fin }, statut: "PAYE" } }),
      prisma.mouvementStock.count({
        where: { type: "ENTREE", dateMouvement: { gte: debut, lte: fin }, NOT: { reference: { startsWith: "INIT-" } } },
      }),
    ]);

    // Calculer les non encore importés
    const caisseSyncees = [...syncRefs].filter((r) => r.startsWith("SYNC-OPC-")).length;
    const ventesSyncees  = [...syncRefs].filter((r) => r.startsWith("SYNC-VRS-")).length;
    const achatsSyncees  = [...syncRefs].filter((r) => r.startsWith("SYNC-MST-")).length;

    return NextResponse.json({
      apercu: {
        caisse: { total: nbCaisse, dejaSyncees: caisseSyncees, aSyncer: Math.max(0, nbCaisse - caisseSyncees) },
        ventes: { total: nbVentes, dejaSyncees: ventesSyncees, aSyncer: Math.max(0, nbVentes - ventesSyncees) },
        achats: { total: nbAchats, dejaSyncees: achatsSyncees, aSyncer: Math.max(0, nbAchats - achatsSyncees) },
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
