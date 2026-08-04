// lib/comptabilite/analytique.ts
//
// Comptabilité analytique (CDC §24) et comparaison budget/réalisé (CDC §25).
// Le "réalisé" ne compte que les écritures VALIDE/CLOTURE — jamais un brouillon
// non contrôlé — dans le sens naturel du compte (débiteur ou créditeur).
import type { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export async function calculerRealiseCompte(
  tx: TxClient,
  params: { compteId: number; annee: number; mois?: number; sectionAnalytiqueId?: number; pointDeVenteId?: number },
): Promise<number> {
  const compte = await tx.compteComptable.findUnique({ where: { id: params.compteId }, select: { sens: true } });
  if (!compte) return 0;

  const dateDebut = new Date(params.annee, params.mois ? params.mois - 1 : 0, 1);
  const dateFin = params.mois ? new Date(params.annee, params.mois, 1) : new Date(params.annee + 1, 0, 1);

  const agg = await tx.ligneEcriture.aggregate({
    where: {
      compteId: params.compteId,
      ...(params.sectionAnalytiqueId != null && { sectionAnalytiqueId: params.sectionAnalytiqueId }),
      ...(params.pointDeVenteId != null && { pointDeVenteId: params.pointDeVenteId }),
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { gte: dateDebut, lt: dateFin } },
    },
    _sum: { debit: true, credit: true },
  });

  const totalDebit = Number(agg._sum.debit ?? 0);
  const totalCredit = Number(agg._sum.credit ?? 0);
  return compte.sens === "CREDITEUR" ? totalCredit - totalDebit : totalDebit - totalCredit;
}

/** Code de section dérivé d'un libellé libre (ex. "Ressources Humaines" → "RESSOURCES_HUMAINES"). */
function sluggifierCode(libelle: string): string {
  return libelle
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "DEPARTEMENT";
}

/**
 * Synchronise l'axe analytique DEPARTEMENT avec les départements RH réels
 * (CDC §24 : "que la création des départements puisse être automatique").
 * `ProfilRH.departement` reste un champ texte libre (aucun modèle Departement
 * dédié dans le module RH) — cette fonction crée, pour chaque valeur distincte
 * déjà utilisée par au moins un profil RH, la SectionAnalytique correspondante
 * si elle n'existe pas encore. Additive et idempotente : ne modifie ni ne
 * supprime jamais une section existante, même si le libellé RH change ensuite.
 */
export async function synchroniserSectionsDepartements(tx: TxClient): Promise<{ crees: string[] }> {
  const departements = await tx.profilRH.findMany({
    where: { departement: { not: null } },
    select: { departement: true },
    distinct: ["departement"],
  });

  const existantes = await tx.sectionAnalytique.findMany({
    where: { axe: "DEPARTEMENT" },
    select: { libelle: true },
  });
  const libellesExistants = new Set(existantes.map((s) => s.libelle.trim().toLowerCase()));

  const crees: string[] = [];
  for (const d of departements) {
    const libelle = d.departement?.trim();
    if (!libelle || libellesExistants.has(libelle.toLowerCase())) continue;

    let code = sluggifierCode(libelle);
    if (await tx.sectionAnalytique.findUnique({ where: { code }, select: { id: true } })) {
      code = `${code}_${Math.floor(100 + Math.random() * 900)}`;
    }

    await tx.sectionAnalytique.create({ data: { axe: "DEPARTEMENT", code, libelle } });
    libellesExistants.add(libelle.toLowerCase());
    crees.push(libelle);
  }

  return { crees };
}
