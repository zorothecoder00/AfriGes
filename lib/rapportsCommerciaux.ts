import { Prisma, StatutVenteDirecte } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Contrôle commercial & reporting (CDC digitalisation §5.9) — agrégations
 * sur le cycle commercial "moderne" (VenteDirecte/CreditClient/PointDeVente),
 * distinct des rapports historiques de app/api/admin/rapports/* qui portent
 * sur le legacy Gestionnaire/Member (packs communautaires).
 */

export type Periode = "jour" | "semaine" | "mois";

/** Statuts VenteDirecte considérés comme des ventes réalisées (CA reconnu). */
const STATUTS_VENTE_VALIDEE: StatutVenteDirecte[] = [
  "CONFIRMEE", "SORTIE_VALIDEE", "LIVREE", "PAID", "CREDIT_APPROUVE", "CREDIT_EN_LIVRAISON", "CREDIT_LIVRE",
];

export interface Plage { debut: Date; fin: Date }

/** Calcule la plage [debut, fin] couvrant la journée/semaine (lundi-dimanche)/mois de dateRef. */
export function calculerPlage(periode: Periode, dateRef: Date): Plage {
  const d = new Date(dateRef);
  if (periode === "jour") {
    const debut = new Date(d); debut.setHours(0, 0, 0, 0);
    const fin = new Date(d); fin.setHours(23, 59, 59, 999);
    return { debut, fin };
  }
  if (periode === "semaine") {
    const jourIso = d.getDay() || 7; // lundi=1 … dimanche=7
    const debut = new Date(d); debut.setDate(d.getDate() - jourIso + 1); debut.setHours(0, 0, 0, 0);
    const fin = new Date(debut); fin.setDate(debut.getDate() + 6); fin.setHours(23, 59, 59, 999);
    return { debut, fin };
  }
  const debut = new Date(d.getFullYear(), d.getMonth(), 1);
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { debut, fin };
}

interface Filtre { debut: Date; fin: Date; pointDeVenteId?: number }

function whereVente({ debut, fin, pointDeVenteId }: Filtre): Prisma.VenteDirecteWhereInput {
  return {
    createdAt: { gte: debut, lte: fin },
    statut: { in: STATUTS_VENTE_VALIDEE },
    ...(pointDeVenteId && { pointDeVenteId }),
  };
}

/** "Rapport journalier/hebdomadaire/mensuel des ventes" — total + décomposition par jour de la plage. */
export async function rapportVentes(f: Filtre) {
  const ventes = await prisma.venteDirecte.findMany({
    where: whereVente(f),
    select: { montantTotal: true, montantPaye: true, modePaiement: true, createdAt: true },
  });
  const parJour = new Map<string, { ca: number; nombre: number }>();
  let ca = 0, encaisse = 0;
  for (const v of ventes) {
    ca += Number(v.montantTotal);
    encaisse += Number(v.montantPaye);
    const jour = v.createdAt.toISOString().slice(0, 10);
    const acc = parJour.get(jour) ?? { ca: 0, nombre: 0 };
    acc.ca += Number(v.montantTotal); acc.nombre += 1;
    parJour.set(jour, acc);
  }
  return {
    nombreVentes: ventes.length,
    ca,
    encaisse,
    panierMoyen: ventes.length ? ca / ventes.length : 0,
    parJour: [...parJour.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([jour, v]) => ({ jour, ...v })),
  };
}

/** "Rapport des ventes par agent" */
export async function rapportVentesParAgent(f: Filtre) {
  const groupes = await prisma.venteDirecte.groupBy({
    by: ["vendeurId"],
    where: whereVente(f),
    _sum: { montantTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { montantTotal: "desc" } },
  });
  const agents = await prisma.user.findMany({
    where: { id: { in: groupes.map((g) => g.vendeurId) } },
    select: { id: true, nom: true, prenom: true },
  });
  const parId = new Map(agents.map((a) => [a.id, a]));
  return groupes.map((g) => ({
    agentId: g.vendeurId,
    agent: parId.get(g.vendeurId) ?? null,
    nombreVentes: g._count._all,
    ca: Number(g._sum.montantTotal ?? 0),
  }));
}

/** "Rapport des ventes par produit" */
export async function rapportVentesParProduit(f: Filtre) {
  const lignes = await prisma.ligneVenteDirecte.findMany({
    where: { vente: whereVente(f) },
    select: { produitId: true, produitNom: true, quantite: true, montant: true },
  });
  const parProduit = new Map<string, { produitId: number | null; nom: string; quantite: number; montant: number }>();
  for (const l of lignes) {
    const cle = l.produitId ? `p${l.produitId}` : `libre:${l.produitNom}`;
    const acc = parProduit.get(cle) ?? { produitId: l.produitId, nom: l.produitNom ?? "—", quantite: 0, montant: 0 };
    acc.quantite += l.quantite; acc.montant += Number(l.montant);
    parProduit.set(cle, acc);
  }
  const ids = [...parProduit.values()].map((v) => v.produitId).filter((id): id is number => id !== null);
  const produits = await prisma.produit.findMany({ where: { id: { in: ids } }, select: { id: true, nom: true, codeProduit: true } });
  const parId = new Map(produits.map((p) => [p.id, p]));
  return [...parProduit.values()]
    .map((v) => ({ ...v, nom: v.produitId ? (parId.get(v.produitId)?.nom ?? v.nom) : v.nom, codeProduit: v.produitId ? parId.get(v.produitId)?.codeProduit ?? null : null }))
    .sort((a, b) => b.montant - a.montant);
}

/** "Rapport des ventes par agence" */
export async function rapportVentesParAgence(f: Filtre) {
  const groupes = await prisma.venteDirecte.groupBy({
    by: ["pointDeVenteId"],
    where: whereVente(f),
    _sum: { montantTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { montantTotal: "desc" } },
  });
  const pdvs = await prisma.pointDeVente.findMany({
    where: { id: { in: groupes.map((g) => g.pointDeVenteId) } },
    select: { id: true, nom: true, code: true },
  });
  const parId = new Map(pdvs.map((p) => [p.id, p]));
  return groupes.map((g) => ({
    pointDeVenteId: g.pointDeVenteId,
    pointDeVente: parId.get(g.pointDeVenteId) ?? null,
    nombreVentes: g._count._all,
    ca: Number(g._sum.montantTotal ?? 0),
  }));
}

/** "Rapport des ventes à crédit" */
export async function rapportVentesCredit(f: Filtre) {
  const ventesCredit = await prisma.venteDirecte.findMany({
    where: { ...whereVente(f), modePaiement: "CREDIT" },
    select: { montantTotal: true },
  });
  const nouveauxCredits = await prisma.creditClient.aggregate({
    where: { createdAt: { gte: f.debut, lte: f.fin }, ...(f.pointDeVenteId && { pointDeVenteId: f.pointDeVenteId }) },
    _sum: { montantTotal: true, montantRembourse: true, soldeRestant: true },
    _count: { _all: true },
  });
  return {
    nombreVentesCredit: ventesCredit.length,
    caCredit: ventesCredit.reduce((s, v) => s + Number(v.montantTotal), 0),
    nouveauxCredits: nouveauxCredits._count._all,
    montantNouveauxCredits: Number(nouveauxCredits._sum.montantTotal ?? 0),
    montantRembourseSurNouveaux: Number(nouveauxCredits._sum.montantRembourse ?? 0),
    soldeRestantSurNouveaux: Number(nouveauxCredits._sum.soldeRestant ?? 0),
  };
}

/** "Rapport des encaissements" */
export async function rapportEncaissements(f: Filtre) {
  const ventes = await prisma.venteDirecte.findMany({
    where: whereVente(f),
    select: { montantPaye: true, modePaiement: true },
  });
  const parMode = new Map<string, number>();
  let totalVentes = 0;
  for (const v of ventes) {
    totalVentes += Number(v.montantPaye);
    parMode.set(v.modePaiement, (parMode.get(v.modePaiement) ?? 0) + Number(v.montantPaye));
  }
  const remboursements = await prisma.remboursementCredit.aggregate({
    where: {
      dateRemboursement: { gte: f.debut, lte: f.fin },
      statut: "CONFIRME",
      ...(f.pointDeVenteId && { credit: { pointDeVenteId: f.pointDeVenteId } }),
    },
    _sum: { montant: true },
    _count: { _all: true },
  });
  const totalRemboursements = Number(remboursements._sum.montant ?? 0);
  return {
    totalEncaisse: totalVentes + totalRemboursements,
    encaisseVentes: totalVentes,
    parModePaiementVentes: [...parMode.entries()].map(([mode, montant]) => ({ mode, montant })),
    encaisseRemboursementsCredit: totalRemboursements,
    nombreRemboursementsCredit: remboursements._count._all,
  };
}

/** "Rapport des impayés" / "État des impayés" — échéances en retard, à date (pas de notion de plage). */
export async function rapportImpayes(pointDeVenteId?: number) {
  const echeances = await prisma.echeanceCredit.findMany({
    where: {
      statut: "EN_RETARD",
      ...(pointDeVenteId && { credit: { pointDeVenteId } }),
    },
    include: { credit: { select: { id: true, reference: true, pointDeVenteId: true, client: { select: { id: true, nom: true, prenom: true, telephone: true } } } } },
    orderBy: { dateEcheance: "asc" },
  });
  const parClient = new Map<number, { client: { id: number; nom: string; prenom: string; telephone: string | null }; nombreEcheances: number; montantDu: number; penalites: number }>();
  let montantTotalDu = 0, penalitesTotal = 0;
  for (const e of echeances) {
    const resteDu = Number(e.montantDu) - Number(e.montantPaye);
    montantTotalDu += resteDu;
    penalitesTotal += Number(e.penalite);
    const c = e.credit.client;
    const acc = parClient.get(c.id) ?? { client: c, nombreEcheances: 0, montantDu: 0, penalites: 0 };
    acc.nombreEcheances += 1; acc.montantDu += resteDu; acc.penalites += Number(e.penalite);
    parClient.set(c.id, acc);
  }
  return {
    nombreEcheancesEnRetard: echeances.length,
    montantTotalDu,
    penalitesTotal,
    parClient: [...parClient.values()].sort((a, b) => b.montantDu - a.montantDu),
  };
}

/** "Rapport de recouvrement" — actions de recouvrement crédit classique (§5.4) sur la plage. */
export async function rapportRecouvrement(f: Filtre) {
  const actions = await prisma.actionRecouvrementCredit.findMany({
    where: {
      dateAction: { gte: f.debut, lte: f.fin },
      ...(f.pointDeVenteId && { credit: { pointDeVenteId: f.pointDeVenteId } }),
    },
    select: { type: true, statut: true },
  });
  const parType = new Map<string, number>();
  const parStatut = new Map<string, number>();
  for (const a of actions) {
    parType.set(a.type, (parType.get(a.type) ?? 0) + 1);
    parStatut.set(a.statut, (parStatut.get(a.statut) ?? 0) + 1);
  }
  return {
    nombreActions: actions.length,
    parType: [...parType.entries()].map(([type, nombre]) => ({ type, nombre })),
    parStatut: [...parStatut.entries()].map(([statut, nombre]) => ({ statut, nombre })),
  };
}

/** "Rapport des retours" — retours marchandise client (§5.8) sur la plage. */
export async function rapportRetours(f: Filtre) {
  const retours = await prisma.retourMarchandiseClient.findMany({
    where: {
      createdAt: { gte: f.debut, lte: f.fin },
      ...(f.pointDeVenteId && { pointDeVenteId: f.pointDeVenteId }),
    },
    include: { lignes: true },
  });
  const parStatut = new Map<string, number>();
  let quantiteTotale = 0;
  for (const r of retours) {
    parStatut.set(r.statut, (parStatut.get(r.statut) ?? 0) + 1);
    quantiteTotale += r.lignes.reduce((s, l) => s + l.quantite, 0);
  }
  return {
    nombreRetours: retours.length,
    quantiteTotale,
    parStatut: [...parStatut.entries()].map(([statut, nombre]) => ({ statut, nombre })),
  };
}

/** "Rapport des réclamations" — réclamations client (§5.8) sur la plage. */
export async function rapportReclamations(f: Filtre) {
  const reclamations = await prisma.reclamationClient.findMany({
    where: {
      createdAt: { gte: f.debut, lte: f.fin },
      ...(f.pointDeVenteId && { pointDeVenteId: f.pointDeVenteId }),
    },
    select: { statut: true, type: true },
  });
  const parStatut = new Map<string, number>();
  const parType = new Map<string, number>();
  for (const r of reclamations) {
    parStatut.set(r.statut, (parStatut.get(r.statut) ?? 0) + 1);
    parType.set(r.type, (parType.get(r.type) ?? 0) + 1);
  }
  return {
    nombreReclamations: reclamations.length,
    parStatut: [...parStatut.entries()].map(([statut, nombre]) => ({ statut, nombre })),
    parType: [...parType.entries()].map(([type, nombre]) => ({ type, nombre })),
  };
}

/** "Rapport des performances commerciales" — indicateurs composites de la plage. */
export async function rapportPerformances(f: Filtre) {
  const [ventes, credit, retours, reclamations] = await Promise.all([
    rapportVentes(f), rapportVentesCredit(f), rapportRetours(f), rapportReclamations(f),
  ]);
  return {
    ca: ventes.ca,
    nombreVentes: ventes.nombreVentes,
    panierMoyen: ventes.panierMoyen,
    tauxCredit: ventes.ca ? (credit.caCredit / ventes.ca) * 100 : 0,
    tauxRetour: ventes.nombreVentes ? (retours.nombreRetours / ventes.nombreVentes) * 100 : 0,
    tauxReclamation: ventes.nombreVentes ? (reclamations.nombreReclamations / ventes.nombreVentes) * 100 : 0,
  };
}

/** "Tableau de bord commercial" consolidé — vue d'ensemble pour la Direction. */
export async function tableauBordCommercial(f: Filtre) {
  const [ventes, credit, encaissements, impayes, recouvrement, retours, reclamations] = await Promise.all([
    rapportVentes(f), rapportVentesCredit(f), rapportEncaissements(f),
    rapportImpayes(f.pointDeVenteId), rapportRecouvrement(f), rapportRetours(f), rapportReclamations(f),
  ]);
  return { ventes, credit, encaissements, impayes, recouvrement, retours, reclamations };
}
