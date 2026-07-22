// lib/popc/salairesPaie.ts
// §1/§3.1 — Câblage automatique des salaires depuis le module Paie (aucune ressaisie).
// Agrège le brut (FichePaie.totalBrut, statut d'engagement) par groupe de rôle,
// pour un mois donné. Si le mois demandé n'a pas encore de fiches (la planification
// précède souvent la paie), on retombe sur le dernier mois disponible.
// Serveur uniquement (accès Prisma).

import { prisma } from "@/lib/prisma";

// Fiches prises en compte : engagement réel (comme le dashboard Paie), pas les brouillons.
const ENGAGEMENT = ["PAYE", "EN_PAIEMENT", "VALIDE"] as const;

// Correspondance rôles → lignes de salaire §3.1 (décision métier, ajustable).
//  - Agents Terrain      → AGENT_TERRAIN
//  - Superviseurs        → CONTROLEUR_TERRAIN (pas de rôle « Superviseur » distinct)
//  - Contrôleurs         → SAISIE MANUELLE (non câblé ici)
//  - Responsables        → tous les RESPONSABLE_* + CHEF_AGENCE
const ROLES_AGENTS = ["AGENT_TERRAIN"];
const ROLES_SUPERVISEURS = ["CONTROLEUR_TERRAIN"];
const ROLES_RESPONSABLES = [
  "RESPONSABLE_POINT_DE_VENTE", "RESPONSABLE_VENTE_CREDIT", "RESPONSABLE_ECONOMIQUE",
  "RESPONSABLE_COMMUNAUTE", "RESPONSABLE_MARKETING", "RESPONSABLE_RH", "RESPONSABLE_RIA",
  "CHEF_AGENCE",
];

export interface SalairesPaie {
  salaireAgents: number;
  salaireSuperviseurs: number;
  salaireResponsables: number;
  annee: number;               // mois demandé
  mois: number;
  source: "aucune" | "mois" | "fallback";
  anneeSource: number | null;  // mois effectivement utilisé (si fallback)
  moisSource: number | null;
}

const rang = (annee: number, mois: number) => annee * 12 + (mois - 1);

/**
 * Salaires bruts mensuels par groupe de rôle, depuis la Paie.
 * pdv = 0 → global ; sinon scopé aux collaborateurs affectés à l'agence.
 */
export async function salairesDepuisPaie(annee: number, mois: number, pdv = 0): Promise<SalairesPaie> {
  const vide: SalairesPaie = {
    salaireAgents: 0, salaireSuperviseurs: 0, salaireResponsables: 0,
    annee, mois, source: "aucune", anneeSource: null, moisSource: null,
  };

  // Scoping agence : membres affectés au PDV (filtre sur le gestionnaire du profil).
  let gestFilter: { gestionnaire: { memberId: { in: number[] } } } | undefined;
  if (pdv) {
    const affs = await prisma.gestionnaireAffectation.findMany({
      where: { pointDeVenteId: pdv, actif: true }, select: { userId: true },
    });
    if (affs.length === 0) return vide;
    gestFilter = { gestionnaire: { memberId: { in: affs.map((a) => a.userId) } } };
  }
  const profilFilter = gestFilter ? { profilRH: gestFilter } : {};

  // Mois source = mois demandé s'il a des fiches, sinon le dernier mois antérieur.
  const dispo = await prisma.fichePaie.findMany({
    where: {
      statut: { in: [...ENGAGEMENT] },
      OR: [{ annee: { lt: annee } }, { annee, mois: { lte: mois } }],
      ...profilFilter,
    },
    select: { annee: true, mois: true }, distinct: ["annee", "mois"],
  });
  if (dispo.length === 0) return vide;

  const src = dispo.reduce((best, d) => (rang(d.annee, d.mois) > rang(best.annee, best.mois) ? d : best));
  const source = src.annee === annee && src.mois === mois ? "mois" : "fallback";

  const fiches = await prisma.fichePaie.findMany({
    where: { annee: src.annee, mois: src.mois, statut: { in: [...ENGAGEMENT] }, ...profilFilter },
    select: {
      totalBrut: true,
      profilRH: { select: { gestionnaire: { select: { role: true } } } },
    },
  });

  let agents = 0, superviseurs = 0, responsables = 0;
  for (const f of fiches) {
    const role = String(f.profilRH.gestionnaire.role);
    const brut = Number(f.totalBrut);
    if (ROLES_AGENTS.includes(role)) agents += brut;
    else if (ROLES_SUPERVISEURS.includes(role)) superviseurs += brut;
    else if (ROLES_RESPONSABLES.includes(role)) responsables += brut;
  }

  const r = (v: number) => Number(v.toFixed(2));
  return {
    salaireAgents: r(agents), salaireSuperviseurs: r(superviseurs), salaireResponsables: r(responsables),
    annee, mois, source, anneeSource: src.annee, moisSource: src.mois,
  };
}
