// lib/comptabilite/controles.ts
//
// Contrôles de cohérence comptable (CDC §40-42) : erreurs bloquantes, anomalies,
// comptes d'attente, doublons potentiels, clients créditeurs/fournisseurs
// débiteurs inhabituels, factures échues sans paiement. Ne modifie jamais rien
// — se contente de signaler, le comptable décide de l'action (CDC : "détecter",
// pas "corriger automatiquement").
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export interface ConstatControle {
  code: string;
  gravite: "BLOQUANT" | "ANOMALIE";
  message: string;
  entiteType?: string;
  entiteId?: number;
  montant?: number;
  date?: Date;
}

const SEUIL_COMPTE_ATTENTE = 100_000; // FCFA — au-delà, signalé
const JOURS_BROUILLON_ANCIEN = 7;

/** §40 — écritures dont le total débit ≠ crédit (protection contre d'anciens imports manuels). */
async function controlerEquilibre(tx: TxClient): Promise<ConstatControle[]> {
  const ecritures = await tx.ecritureComptable.findMany({
    where: { statut: { in: ["VALIDE", "CLOTURE"] } },
    include: { lignes: { select: { debit: true, credit: true } } },
  });
  const constats: ConstatControle[] = [];
  for (const e of ecritures) {
    const totalDebit = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = e.lignes.reduce((s, l) => s + Number(l.credit), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      constats.push({
        code: "ECRITURE_DESEQUILIBREE",
        gravite: "BLOQUANT",
        message: `Écriture ${e.reference} non équilibrée : débit ${totalDebit.toFixed(2)} ≠ crédit ${totalCredit.toFixed(2)}`,
        entiteType: "EcritureComptable",
        entiteId: e.id,
      });
    }
  }
  return constats;
}

/** §12/§41 — écritures BROUILLON en attente de validation depuis plus de 7 jours. */
async function controlerBrouillonsAnciens(tx: TxClient): Promise<ConstatControle[]> {
  const seuil = new Date(Date.now() - JOURS_BROUILLON_ANCIEN * 24 * 60 * 60 * 1000);
  const anciens = await tx.ecritureComptable.findMany({
    where: { statut: "BROUILLON", createdAt: { lt: seuil } },
    select: { id: true, reference: true, createdAt: true, libelle: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  return anciens.map((e) => ({
    code: "BROUILLON_ANCIEN",
    gravite: "ANOMALIE" as const,
    message: `Écriture ${e.reference} (${e.libelle}) en brouillon depuis plus de ${JOURS_BROUILLON_ANCIEN} jours — à valider ou corriger`,
    entiteType: "EcritureComptable",
    entiteId: e.id,
    date: e.createdAt,
  }));
}

/** §41 — compte d'attente (471 Débiteurs divers) dont le solde reste élevé. */
async function controlerCompteAttente(tx: TxClient): Promise<ConstatControle[]> {
  const compte = await tx.compteComptable.findUnique({ where: { numero: "471" }, select: { id: true, sens: true } });
  if (!compte) return [];

  const agg = await tx.ligneEcriture.aggregate({
    where: { compteId: compte.id, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } } },
    _sum: { debit: true, credit: true },
  });
  const solde = compte.sens === "CREDITEUR"
    ? Number(agg._sum.credit ?? 0) - Number(agg._sum.debit ?? 0)
    : Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);

  if (Math.abs(solde) < SEUIL_COMPTE_ATTENTE) return [];
  return [{
    code: "COMPTE_ATTENTE_ELEVE",
    gravite: "ANOMALIE",
    message: `Compte d'attente 471 (Débiteurs divers) : solde de ${Math.abs(solde).toLocaleString("fr-FR")} FCFA non résolu`,
    entiteType: "CompteComptable",
    entiteId: compte.id,
    montant: solde,
  }];
}

/** §40 — soldes de trésorerie (classe 5) négatifs. */
async function controlerSoldeCaisseNegatif(tx: TxClient): Promise<ConstatControle[]> {
  const comptes = await tx.compteComptable.findMany({ where: { type: "TRESORERIE", actif: true }, select: { id: true, numero: true, libelle: true } });
  const constats: ConstatControle[] = [];
  for (const c of comptes) {
    const agg = await tx.ligneEcriture.aggregate({
      where: { compteId: c.id, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } } },
      _sum: { debit: true, credit: true },
    });
    const solde = Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
    if (solde < -0.01) {
      constats.push({
        code: "SOLDE_TRESORERIE_NEGATIF",
        gravite: "ANOMALIE",
        message: `${c.numero} ${c.libelle} : solde négatif de ${Math.abs(solde).toLocaleString("fr-FR")} FCFA`,
        entiteType: "CompteComptable",
        entiteId: c.id,
        montant: solde,
      });
    }
  }
  return constats;
}

/** §42 — doublons potentiels : plusieurs écritures VALIDE/CLOTURE de même journal/date/montant/libellé (hors contrepassations). */
async function controlerDoublons(tx: TxClient): Promise<ConstatControle[]> {
  const ecritures = await tx.ecritureComptable.findMany({
    where: { statut: { in: ["VALIDE", "CLOTURE"] }, NOT: { reference: { startsWith: "CP-" } } },
    include: { lignes: { select: { debit: true } } },
  });

  const groupes = new Map<string, { reference: string; id: number }[]>();
  for (const e of ecritures) {
    const montant = e.lignes.reduce((s, l) => s + Number(l.debit), 0);
    if (montant <= 0) continue;
    const cle = `${e.journal}|${e.date.toISOString().slice(0, 10)}|${montant.toFixed(2)}|${e.libelle.trim().toLowerCase()}`;
    const liste = groupes.get(cle) ?? [];
    liste.push({ reference: e.reference, id: e.id });
    groupes.set(cle, liste);
  }

  const constats: ConstatControle[] = [];
  for (const [, liste] of groupes) {
    if (liste.length < 2) continue;
    constats.push({
      code: "DOUBLON_POTENTIEL",
      gravite: "ANOMALIE",
      message: `${liste.length} écritures identiques (même journal/date/montant/libellé) : ${liste.map((l) => l.reference).join(", ")}`,
      entiteType: "EcritureComptable",
      entiteId: liste[0].id,
    });
  }
  return constats;
}

/** §22 — immobilisations en service sans dotation générée alors qu'elles auraient dû en recevoir une. */
async function controlerImmobilisationsSansAmortissement(tx: TxClient): Promise<ConstatControle[]> {
  const seuil = new Date();
  seuil.setMonth(seuil.getMonth() - 2);

  const immos = await tx.immobilisation.findMany({
    where: { statut: "EN_SERVICE", dateMiseEnService: { lt: seuil }, categorie: { not: "TERRAIN" } },
    select: { id: true, numeroInventaire: true, designation: true, lignesAmortissement: { select: { id: true } } },
  });

  return immos
    .filter((i) => i.lignesAmortissement.length === 0)
    .map((i) => ({
      code: "IMMOBILISATION_SANS_AMORTISSEMENT",
      gravite: "ANOMALIE" as const,
      message: `${i.numeroInventaire} (${i.designation}) : en service depuis plus de 2 mois, aucune dotation générée`,
      entiteType: "Immobilisation",
      entiteId: i.id,
    }));
}

/**
 * §42 — client dont le compte auxiliaire 411xxx est CRÉDITEUR (solde négatif en
 * sens débiteur normal) : un client ne doit normalement jamais avoir "trop payé"
 * sans qu'un avoir ou un remboursement ne l'explique. Repère au passage un
 * paiement enregistré sans facture correspondante (le compte devient créditeur).
 */
async function controlerClientCrediteurInhabituel(tx: TxClient): Promise<ConstatControle[]> {
  const comptes = await tx.compteComptable.findMany({
    where: { clientId: { not: null } },
    select: { id: true, numero: true, libelle: true, client: { select: { nom: true, prenom: true } } },
  });
  if (comptes.length === 0) return [];

  const aggs = await tx.ligneEcriture.groupBy({
    by: ["compteId"],
    where: { compteId: { in: comptes.map((c) => c.id) }, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } } },
    _sum: { debit: true, credit: true },
  });
  const soldeParCompte = new Map(aggs.map((a) => [a.compteId, Number(a._sum.debit ?? 0) - Number(a._sum.credit ?? 0)]));

  const constats: ConstatControle[] = [];
  for (const c of comptes) {
    const solde = soldeParCompte.get(c.id) ?? 0;
    if (solde < -0.01) {
      const nom = c.client ? `${c.client.prenom} ${c.client.nom}` : c.libelle;
      constats.push({
        code: "CLIENT_CREDITEUR_INHABITUEL",
        gravite: "ANOMALIE",
        message: `${nom} (${c.numero}) : compte créditeur de ${Math.abs(solde).toLocaleString("fr-FR")} FCFA (paiement sans facture correspondante ou trop-perçu ?)`,
        entiteType: "CompteComptable",
        entiteId: c.id,
        montant: solde,
      });
    }
  }
  return constats;
}

/** §42 — symétrique : fournisseur dont le compte 401xxx est DÉBITEUR (on lui devrait de l'argent). */
async function controlerFournisseurDebiteurInhabituel(tx: TxClient): Promise<ConstatControle[]> {
  const comptes = await tx.compteComptable.findMany({
    where: { fournisseurId: { not: null } },
    select: { id: true, numero: true, libelle: true, fournisseur: { select: { nom: true } } },
  });
  if (comptes.length === 0) return [];

  const aggs = await tx.ligneEcriture.groupBy({
    by: ["compteId"],
    where: { compteId: { in: comptes.map((c) => c.id) }, ecriture: { statut: { in: ["VALIDE", "CLOTURE"] } } },
    _sum: { debit: true, credit: true },
  });
  const soldeParCompte = new Map(aggs.map((a) => [a.compteId, Number(a._sum.credit ?? 0) - Number(a._sum.debit ?? 0)]));

  const constats: ConstatControle[] = [];
  for (const c of comptes) {
    const solde = soldeParCompte.get(c.id) ?? 0;
    if (solde < -0.01) {
      const nom = c.fournisseur?.nom ?? c.libelle;
      constats.push({
        code: "FOURNISSEUR_DEBITEUR_INHABITUEL",
        gravite: "ANOMALIE",
        message: `${nom} (${c.numero}) : compte débiteur de ${Math.abs(solde).toLocaleString("fr-FR")} FCFA (paiement en trop ou avoir non appliqué ?)`,
        entiteType: "CompteComptable",
        entiteId: c.id,
        montant: solde,
      });
    }
  }
  return constats;
}

/** §42 — factures de vente échues et non intégralement réglées ("facture sans paiement"). */
async function controlerFacturesSansPaiement(tx: TxClient): Promise<ConstatControle[]> {
  const factures = await tx.factureVente.findMany({
    where: {
      statut: "EMISE",
      dateEcheance: { lt: new Date() },
    },
    select: { id: true, numero: true, montantTTC: true, montantPaye: true, clientNom: true },
    take: 200,
  });

  return factures
    .filter((f) => Number(f.montantPaye) < Number(f.montantTTC) - 0.01)
    .map((f) => ({
      code: "FACTURE_SANS_PAIEMENT",
      gravite: "ANOMALIE" as const,
      message: `Facture ${f.numero} (${f.clientNom}) échue, réglée à ${Number(f.montantPaye).toLocaleString("fr-FR")} / ${Number(f.montantTTC).toLocaleString("fr-FR")} FCFA`,
      entiteType: "FactureVente",
      entiteId: f.id,
      montant: Number(f.montantTTC) - Number(f.montantPaye),
    }));
}

/** Exécute tous les contrôles et retourne la liste triée (bloquants d'abord). */
export async function executerControles(tx: TxClient): Promise<ConstatControle[]> {
  const resultats = await Promise.all([
    controlerEquilibre(tx),
    controlerBrouillonsAnciens(tx),
    controlerCompteAttente(tx),
    controlerSoldeCaisseNegatif(tx),
    controlerDoublons(tx),
    controlerImmobilisationsSansAmortissement(tx),
    controlerClientCrediteurInhabituel(tx),
    controlerFournisseurDebiteurInhabituel(tx),
    controlerFacturesSansPaiement(tx),
  ]);
  const tous = resultats.flat();
  return tous.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === "BLOQUANT" ? -1 : 1));
}
