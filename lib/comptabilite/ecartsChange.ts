// lib/comptabilite/ecartsChange.ts
//
// Écarts de change à la clôture (CDC §27) : les lignes d'écriture sont toujours
// comptabilisées en devise fonctionnelle (XOF) au taux du jour de la transaction
// (EcritureComptable.tauxChange) — lib/comptabilite/moteur.ts ne fait alors
// aucune conversion ultérieure (cf. son commentaire "pas de calcul d'écart de
// change — hors scope de cette étape"). À la clôture, les soldes de bilan
// (trésorerie/créances/dettes) encore libellés dans une devise étrangère
// doivent être réévalués au taux de clôture (Devise.tauxVersFonctionnelle,
// paramétrable par le comptable — jamais codé en dur, CDC §21/§49, pas
// d'historique de taux : le comptable met à jour le taux avant de lancer ce
// calcul). L'écart entre solde comptabilisé et solde réévalué est constaté en
// 476 (perte latente) ou 477 (gain latent), jamais directement en résultat
// (prudence SYSCOHADA — le gain/la perte ne devient réel qu'au règlement
// effectif de la créance/dette/trésorerie concernée).
import type { Prisma } from "@prisma/client";
import { creerEcriture } from "@/lib/comptabilite/moteur";

type TxClient = Prisma.TransactionClient;

export interface EcartChangeLigne {
  compteNumero: string;
  compteLibelle: string;
  devise: string;
  soldeDeviseUnites: number;
  soldeComptabilise: number;
  tauxCloture: number;
  soldeReevalue: number;
  /** > 0 = gain latent (477) ; < 0 = perte latente (476). */
  ecart: number;
  ecritureId: number | null;
}

export interface EtatEcartsChange {
  annee: number;
  dateCloture: Date;
  lignes: EcartChangeLigne[];
  totalGains: number;
  totalPertes: number;
}

/**
 * Calcule les écarts de change de clôture pour l'année `annee` et, sauf
 * `dryRun`, les comptabilise (journal OD, une écriture par compte+devise).
 * Idempotent par référence (`ECHG-{annee}-{compteId}-{devise}`) : une
 * ré-exécution après correction du taux ne duplique jamais l'écriture — elle
 * est retrouvée par `creerEcriture` et son id renvoyé tel quel (voir
 * limitation ci-dessous si le taux a changé entre deux exécutions).
 */
export async function genererEcartsChangeCloture(
  tx: TxClient,
  annee: number,
  userId: number,
  opts?: { dryRun?: boolean }
): Promise<EtatEcartsChange> {
  const dateCloture = new Date(annee, 11, 31, 23, 59, 59, 999);

  const devises = await tx.devise.findMany({ where: { actif: true, code: { not: "XOF" } } });
  if (devises.length === 0) return { annee, dateCloture, lignes: [], totalGains: 0, totalPertes: 0 };
  const tauxParDevise = new Map(devises.map((d) => [d.code, Number(d.tauxVersFonctionnelle)]));

  const lignes = await tx.ligneEcriture.findMany({
    where: {
      compte: { type: { in: ["ACTIF", "PASSIF", "TRESORERIE"] } },
      ecriture: { statut: { in: ["VALIDE", "CLOTURE"] }, date: { lte: dateCloture }, devise: { not: "XOF" } },
    },
    select: {
      debit: true, credit: true,
      compte: { select: { id: true, numero: true, libelle: true } },
      ecriture: { select: { devise: true, tauxChange: true } },
    },
  });
  if (lignes.length === 0) return { annee, dateCloture, lignes: [], totalGains: 0, totalPertes: 0 };

  type Agg = { compteId: number; numero: string; libelle: string; devise: string; netDC: number; netDeviseDC: number };
  const parCompteDevise = new Map<string, Agg>();
  for (const l of lignes) {
    const devise = l.ecriture.devise;
    if (!tauxParDevise.has(devise)) continue; // devise non paramétrée/inactive : ignorée, pas d'erreur bloquante
    const cle = `${l.compte.id}:${devise}`;
    if (!parCompteDevise.has(cle)) parCompteDevise.set(cle, { compteId: l.compte.id, numero: l.compte.numero, libelle: l.compte.libelle, devise, netDC: 0, netDeviseDC: 0 });
    const agg = parCompteDevise.get(cle)!;
    const dc = Number(l.debit) - Number(l.credit);
    const tauxOrigine = Number(l.ecriture.tauxChange) || 1;
    agg.netDC += dc;
    agg.netDeviseDC += dc / tauxOrigine;
  }

  const resultLignes: EcartChangeLigne[] = [];
  let totalGains = 0;
  let totalPertes = 0;

  for (const agg of parCompteDevise.values()) {
    const tauxCloture = tauxParDevise.get(agg.devise)!;
    const soldeReevalue = agg.netDeviseDC * tauxCloture;
    const ecart = soldeReevalue - agg.netDC;
    if (Math.abs(ecart) < 0.01) continue;

    let ecritureId: number | null = null;
    if (!opts?.dryRun) {
      const reference = `ECHG-${annee}-${agg.compteId}-${agg.devise}`;
      const libelle = `Écart de change clôture ${annee} — ${agg.numero} ${agg.libelle} (${agg.devise})`;
      ecritureId = ecart > 0
        // Gain latent : le compte concerné vaut plus en XOF → débit compte / crédit 477.
        ? await creerEcriture(tx, {
            journal: "OD", date: dateCloture, libelle, userId, reference, ignorerCloture: true,
            lignes: [
              { numero: agg.numero, debit: ecart, libelle },
              { numero: "477", credit: ecart, libelle },
            ],
          })
        // Perte latente : le compte concerné vaut moins (ou la dette augmente) en XOF → débit 476 / crédit compte.
        : await creerEcriture(tx, {
            journal: "OD", date: dateCloture, libelle, userId, reference, ignorerCloture: true,
            lignes: [
              { numero: "476", debit: -ecart, libelle },
              { numero: agg.numero, credit: -ecart, libelle },
            ],
          });
    }

    if (ecart > 0) totalGains += ecart; else totalPertes += -ecart;
    resultLignes.push({
      compteNumero: agg.numero, compteLibelle: agg.libelle, devise: agg.devise,
      soldeDeviseUnites: agg.netDeviseDC, soldeComptabilise: agg.netDC, tauxCloture, soldeReevalue, ecart, ecritureId,
    });
  }

  return {
    annee, dateCloture,
    lignes: resultLignes.sort((a, b) => a.compteNumero.localeCompare(b.compteNumero)),
    totalGains, totalPertes,
  };
}
