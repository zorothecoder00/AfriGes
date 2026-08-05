// lib/comptabilite/consolidation.ts
//
// CDC §50 — consolidation multi-société (version légère). AfriSime SARL reste
// aujourd'hui l'unique société réelle (Societe.estPrincipale=true) ; cette
// fonction agrège par simple ADDITION le bilan et le compte de résultat de
// chaque société active — pas d'élimination des opérations inter-sociétés
// (participations croisées, créances/dettes réciproques), non pertinente tant
// qu'une seule société existe concrètement. À enrichir le jour où une 2e
// société réelle apparaît et où des flux inter-sociétés doivent être neutralisés.
import type { Prisma } from "@prisma/client";
import { genererBilan, genererCompteResultat } from "@/lib/comptabilite/etatsFinanciers";

type TxClient = Prisma.TransactionClient;

export interface ConsolidationSociete {
  societeId: number;
  nom: string;
  totalActif: number;
  totalPassif: number;
  totalProduits: number;
  totalCharges: number;
  resultatNet: number;
}

export interface ResultatConsolidation {
  societes: ConsolidationSociete[];
  totalActif: number;
  totalPassif: number;
  totalProduits: number;
  totalCharges: number;
  resultatNet: number;
  equilibre: boolean;
}

/** Consolide bilan + compte de résultat de toutes les sociétés actives sur [dateDebut, dateFin]. */
export async function genererConsolidation(tx: TxClient, dateDebut: Date, dateFin: Date): Promise<ResultatConsolidation> {
  const societesActives = await tx.societe.findMany({ where: { actif: true }, select: { id: true, nom: true, estPrincipale: true } });

  const societes: ConsolidationSociete[] = await Promise.all(
    societesActives.map(async (s) => {
      // La société principale hérite aussi des écritures sans societeId explicite
      // (convention "société principale implicite" du moteur — cf. lib/comptabilite/moteur.ts).
      const societeIds: (number | null)[] = s.estPrincipale ? [s.id, null] : [s.id];
      const [bilan, cr] = await Promise.all([
        genererBilan(tx, dateFin, societeIds),
        genererCompteResultat(tx, dateDebut, dateFin, societeIds),
      ]);
      return {
        societeId: s.id,
        nom: s.nom,
        totalActif: bilan.totalActif,
        totalPassif: bilan.totalPassif,
        totalProduits: cr.totalProduits,
        totalCharges: cr.totalCharges,
        resultatNet: cr.resultatNet,
      };
    }),
  );

  const totaux = societes.reduce(
    (acc, s) => ({
      totalActif: acc.totalActif + s.totalActif,
      totalPassif: acc.totalPassif + s.totalPassif,
      totalProduits: acc.totalProduits + s.totalProduits,
      totalCharges: acc.totalCharges + s.totalCharges,
      resultatNet: acc.resultatNet + s.resultatNet,
    }),
    { totalActif: 0, totalPassif: 0, totalProduits: 0, totalCharges: 0, resultatNet: 0 },
  );

  return { societes, ...totaux, equilibre: Math.abs(totaux.totalActif - totaux.totalPassif) < 1 };
}
