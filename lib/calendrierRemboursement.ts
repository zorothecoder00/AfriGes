/**
 * Calcul du calendrier de remboursement journalier — logique partagée entre le
 * bordereau imprimable (components/BordereauRemboursement.tsx) et la page publique
 * de suivi ouverte au scan du QR (app/suivi/[reference]).
 *
 * Règles (cf. demande métier, corrigées le 2026-09-22 — cf. mémoire) :
 *  - Montant payé : UNIQUEMENT des portions de remboursements réellement
 *    enregistrés, jamais échéance.montantPaye (allocation en cascade côté
 *    serveur, opaque et non traçable jusqu'aux remboursements source — un
 *    seul paiement peut y "étaler" un montant sur des jours qui n'ont rien
 *    reçu). Un remboursement tagué avec un "Jour" (numeroJour) est placé
 *    intégralement sur ce jour précis, jamais scindé. Un remboursement SANS
 *    "Jour" renseigné (y compris tardif, reçu bien après l'échéance qu'il
 *    couvre réellement — sa date ne permet donc pas de deviner le bon jour)
 *    est réparti en cascade sur le plus ancien jour encore non couvert,
 *    exactement comme une réconciliation manuelle le ferait — à partir des
 *    VRAIS montants de remboursement uniquement, donc toujours traçable.
 *  - Solde restant : décrémenté chaque jour par le montant réellement payé si le
 *    client a remboursé, sinon par le montant prévu (amortissement théorique).
 *  - Statut : piloté par le champ serveur `echeance.statut` (reflète correctement
 *    la cascade), décorrélé du montant affiché — un jour peut être "Payé" par
 *    report d'un paiement fait un autre jour, sans montant sur CE jour. Un
 *    crédit SOLDE ne montre plus jamais de retard, même sur un jour dont
 *    l'échéance n'a pas été balayée par la clôture (durée modifiée après coup…).
 *    Un jour en retard qui a quand même reçu un paiement réel (mais partiel)
 *    est marqué PARTIEL plutôt que EN_RETARD, pour ne pas perdre l'info.
 */

export type StatutCalendrier = "PAYE" | "PARTIEL" | "EN_RETARD" | "A_VENIR";

export interface CalendrierInput {
  dureeJours: number;
  dateDebut: string;
  montantTotal: number | string;
  montantJournalier: number | string;
  /** Statut global du crédit — SOLDE force tous les jours à "Payé". */
  statutCredit: string;
  echeances: {
    numeroEcheance: number;
    dateEcheance: string;
    montantDu: number | string;
    montantPaye: number | string;
    statut: string;
  }[];
  /** Remboursements réels (hors REJETE), pour le montant payé réel par jour. */
  remboursements: {
    montant: number | string;
    numeroJour: number | null;
    dateRemboursement: string;
    statut: string;
  }[];
}

export interface CalendrierRow {
  jour: number;
  date: string; // ISO
  montantPrevu: number;
  montantPaye: number;
  soldeRestant: number;
  statut: StatutCalendrier;
}

const N = (v: number | string | null | undefined) => Number(v ?? 0);

export function buildCalendrier(input: CalendrierInput, now: Date = new Date()): CalendrierRow[] {
  const duree        = Math.max(0, input.dureeJours);
  const debut        = new Date(input.dateDebut);
  const montantTotal = N(input.montantTotal);
  const journalier   = N(input.montantJournalier);
  const dernierMontant = Number((montantTotal - journalier * (duree - 1)).toFixed(2)); // résiduel du dernier jour

  const byNum = new Map(input.echeances.map((e) => [e.numeroEcheance, e]));

  // Infos de chaque jour (numéro, montant dû, date, échéance) — calculées une
  // fois, nécessaires à la fois pour la répartition des paiements non tagués
  // ci-dessous et pour la construction finale des lignes.
  const joursInfo = Array.from({ length: duree }, (_, idx) => {
    const jour = idx + 1;
    const e    = byNum.get(jour);
    const dateEch = e
      ? new Date(e.dateEcheance)
      : (() => { const d = new Date(debut); d.setDate(d.getDate() + idx); return d; })();
    const montantPrevu = e ? N(e.montantDu) : (jour === duree ? dernierMontant : journalier);
    return { jour, dateEch, montantPrevu, e };
  });

  // 1) Remboursements tagués avec un "Jour" (numeroJour) → placement EXACT,
  // intégral, sur ce jour précis — jamais scindé ni étalé sur d'autres jours.
  const montantParJour = new Map<number, number>();
  const rembSansJour: { montant: number; date: Date }[] = [];
  for (const r of input.remboursements) {
    if (r.statut === "REJETE") continue;
    if (r.numeroJour == null) { rembSansJour.push({ montant: N(r.montant), date: new Date(r.dateRemboursement) }); continue; }
    montantParJour.set(r.numeroJour, (montantParJour.get(r.numeroJour) ?? 0) + N(r.montant));
  }

  // 2) Remboursements SANS "Jour" renseigné (y compris tardifs) : répartis en
  // cascade sur le plus ancien jour encore non couvert, à partir des VRAIS
  // montants uniquement (jamais echeance.montantPaye) — traçable au total près.
  const rembSansJourTries = [...rembSansJour].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const r of rembSansJourTries) {
    let reste = r.montant;
    for (const j of joursInfo) {
      if (reste <= 0) break;
      const couvert = montantParJour.get(j.jour) ?? 0;
      const place = Math.max(0, j.montantPrevu - couvert);
      if (place <= 0) continue;
      const alloue = Math.min(reste, place);
      montantParJour.set(j.jour, couvert + alloue);
      reste -= alloue;
    }
    if (reste > 0 && joursInfo.length > 0) {
      const dernierJour = joursInfo[joursInfo.length - 1].jour;
      montantParJour.set(dernierJour, (montantParJour.get(dernierJour) ?? 0) + reste);
    }
  }

  let cumulDecrement = 0;

  return joursInfo.map(({ jour, dateEch, montantPrevu, e }) => {
    // Montant réellement reçu CE jour précis — jamais e.montantPaye (cascade serveur, cf. commentaire en-tête).
    const montantPaye = montantParJour.get(jour) ?? 0;

    // Amortissement affiché : réel si payé ce jour, sinon théorique (le statut
    // PAYE/EN_RETARD reste piloté par echeance.statut ci-dessous, pas par ce calcul).
    cumulDecrement += montantPaye > 0 ? montantPaye : montantPrevu;
    const soldeRestant = Math.max(0, montantTotal - cumulDecrement);

    const statutRaw   = e ? e.statut : "EN_ATTENTE";
    const estPaye      = input.statutCredit === "SOLDE" || statutRaw === "PAYE";
    const estPartiel   = !estPaye && (statutRaw === "PARTIEL" || montantPaye > 0);
    const enRetard     = !estPaye && !estPartiel && dateEch < now;
    const statut: StatutCalendrier = estPaye ? "PAYE" : estPartiel ? "PARTIEL" : enRetard ? "EN_RETARD" : "A_VENIR";

    return { jour, date: dateEch.toISOString(), montantPrevu, montantPaye, soldeRestant, statut };
  });
}
