// lib/comptabilite/etatsFinanciersPdf.ts
//
// CDC §46 — export PDF serveur des états financiers (bilan, compte de résultat,
// balance, grand livre). Jusqu'ici les boutons "PDF" de ces 4 pages n'appelaient
// que `window.print()` (impression navigateur) — ici on génère un vrai PDF côté
// serveur via lib/pdf.ts, comme le fait déjà le module RH (25 routes).
import { formatCurrency } from "@/lib/format";
import { escapeHtml } from "@/lib/pdf";
import { SOCIETE, SOCIETE_LEGAL, SOCIETE_SIEGE } from "@/lib/societe";
import type { LigneBalanceGenerale, LigneGrandLivreGenerique } from "@/lib/comptabilite/grandLivreBalance";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function entete(titre: string, sousTitre: string): string {
  return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:16px;">
      <div>
        <div style="font-size:18px; font-weight:700; color:#0f172a;">${escapeHtml(SOCIETE.nom)}</div>
        <div style="font-size:10px; color:#64748b;">${escapeHtml(SOCIETE.baseline)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:15px; font-weight:700; color:#0f172a;">${escapeHtml(titre)}</div>
        <div style="font-size:10px; color:#64748b;">${escapeHtml(sousTitre)}</div>
      </div>
    </div>`;
}

function pied(): string {
  return `
    <div style="margin-top:20px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:9px; color:#94a3b8; text-align:center;">
      ${escapeHtml(SOCIETE_LEGAL)}<br/>${escapeHtml(SOCIETE_SIEGE)}
    </div>`;
}

function document(titre: string, corps: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(titre)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; margin: 0; padding: 24px; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; padding: 4px 6px; }
  td { padding: 3px 6px; border-bottom: 1px solid #f1f5f9; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: "Courier New", monospace; font-size: 10px; }
  .total-row td { font-weight: 700; border-top: 2px solid #0f172a; border-bottom: none; }
  .section-title { font-weight: 700; font-size: 12px; margin-top: 14px; color: #0f172a; }
</style>
</head>
<body>${corps}${pied()}</body>
</html>`;
}

export function genBilanPdfHtml(annee: number, bilan: {
  actif: { compteNumero: string; libelle: string; montant: number }[];
  passif: { compteNumero: string; libelle: string; montant: number }[];
  totalActif: number; totalPassif: number; equilibre: boolean;
}): string {
  const table = (lignes: { compteNumero: string; libelle: string; montant: number }[], total: number, label: string) => `
    <table>
      <thead><tr><th>Compte</th><th>Libellé</th><th class="num">Montant</th></tr></thead>
      <tbody>
        ${lignes.map((l) => `<tr><td class="mono">${escapeHtml(l.compteNumero)}</td><td>${escapeHtml(l.libelle)}</td><td class="num">${escapeHtml(formatCurrency(l.montant))}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="2">Total ${label}</td><td class="num">${escapeHtml(formatCurrency(total))}</td></tr>
      </tbody>
    </table>`;

  const corps = `
    ${entete("Bilan", `Exercice ${annee} — ${bilan.equilibre ? "Équilibré" : "Déséquilibré"}`)}
    <div class="section-title">Actif</div>
    ${table(bilan.actif, bilan.totalActif, "Actif")}
    <div class="section-title">Passif</div>
    ${table(bilan.passif, bilan.totalPassif, "Passif")}`;
  return document(`Bilan ${annee}`, corps);
}

export function genResultatPdfHtml(annee: number, cr: {
  produits: { compteNumero: string; libelle: string; montant: number }[];
  charges: { compteNumero: string; libelle: string; montant: number }[];
  totalProduits: number; totalCharges: number; resultatNet: number;
}): string {
  const table = (lignes: { compteNumero: string; libelle: string; montant: number }[], total: number, label: string) => `
    <table>
      <thead><tr><th>Compte</th><th>Libellé</th><th class="num">Montant</th></tr></thead>
      <tbody>
        ${lignes.map((l) => `<tr><td class="mono">${escapeHtml(l.compteNumero)}</td><td>${escapeHtml(l.libelle)}</td><td class="num">${escapeHtml(formatCurrency(l.montant))}</td></tr>`).join("")}
        <tr class="total-row"><td colspan="2">Total ${label}</td><td class="num">${escapeHtml(formatCurrency(total))}</td></tr>
      </tbody>
    </table>`;

  const corps = `
    ${entete("Compte de résultat", `Exercice ${annee}`)}
    <div class="section-title">Produits</div>
    ${table(cr.produits, cr.totalProduits, "Produits")}
    <div class="section-title">Charges</div>
    ${table(cr.charges, cr.totalCharges, "Charges")}
    <table style="margin-top:14px;">
      <tbody><tr class="total-row"><td>Résultat net</td><td class="num">${escapeHtml(formatCurrency(cr.resultatNet))}</td></tr></tbody>
    </table>`;
  return document(`Compte de résultat ${annee}`, corps);
}

export function genBalancePdfHtml(periode: { debut: Date; fin: Date }, lignes: LigneBalanceGenerale[]): string {
  const totaux = lignes.reduce(
    (acc, l) => ({
      soldeInitial: acc.soldeInitial + l.soldeInitial,
      mouvementDebit: acc.mouvementDebit + l.mouvementDebit,
      mouvementCredit: acc.mouvementCredit + l.mouvementCredit,
      soldeFinalDebiteur: acc.soldeFinalDebiteur + l.soldeFinalDebiteur,
      soldeFinalCrediteur: acc.soldeFinalCrediteur + l.soldeFinalCrediteur,
    }),
    { soldeInitial: 0, mouvementDebit: 0, mouvementCredit: 0, soldeFinalDebiteur: 0, soldeFinalCrediteur: 0 },
  );
  const corps = `
    ${entete("Balance générale", `Du ${fmtDate(periode.debut)} au ${fmtDate(periode.fin)}`)}
    <table>
      <thead><tr>
        <th>Compte</th><th>Libellé</th><th class="num">Solde initial</th>
        <th class="num">Débit</th><th class="num">Crédit</th>
        <th class="num">Solde débiteur</th><th class="num">Solde créditeur</th>
      </tr></thead>
      <tbody>
        ${lignes.map((l) => `<tr>
          <td class="mono">${escapeHtml(l.numero)}</td><td>${escapeHtml(l.libelle)}</td>
          <td class="num">${escapeHtml(formatCurrency(l.soldeInitial))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.mouvementDebit))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.mouvementCredit))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.soldeFinalDebiteur))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.soldeFinalCrediteur))}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td colspan="2">Totaux</td>
          <td class="num">${escapeHtml(formatCurrency(totaux.soldeInitial))}</td>
          <td class="num">${escapeHtml(formatCurrency(totaux.mouvementDebit))}</td>
          <td class="num">${escapeHtml(formatCurrency(totaux.mouvementCredit))}</td>
          <td class="num">${escapeHtml(formatCurrency(totaux.soldeFinalDebiteur))}</td>
          <td class="num">${escapeHtml(formatCurrency(totaux.soldeFinalCrediteur))}</td>
        </tr>
      </tbody>
    </table>`;
  return document(`Balance générale`, corps);
}

export function genGrandLivrePdfHtml(compte: { numero: string; libelle: string }, periode: { debut: Date | null; fin: Date | null }, soldeOuverture: number, lignes: LigneGrandLivreGenerique[], soldeFinal: number): string {
  const sousTitre = `${compte.numero} — ${compte.libelle}` + (periode.debut && periode.fin ? ` · du ${fmtDate(periode.debut)} au ${fmtDate(periode.fin)}` : "");
  const corps = `
    ${entete("Grand livre", sousTitre)}
    <table>
      <thead><tr>
        <th>Date</th><th>Pièce</th><th>Journal</th><th>Libellé</th>
        <th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th>
      </tr></thead>
      <tbody>
        <tr><td colspan="6"><em>Solde d&apos;ouverture</em></td><td class="num">${escapeHtml(formatCurrency(soldeOuverture))}</td></tr>
        ${lignes.map((l) => `<tr>
          <td>${escapeHtml(fmtDate(new Date(l.date)))}</td><td class="mono">${escapeHtml(l.numeroPiece)}</td>
          <td>${escapeHtml(l.journal)}</td><td>${escapeHtml(l.libelle)}</td>
          <td class="num">${escapeHtml(formatCurrency(l.debit))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.credit))}</td>
          <td class="num">${escapeHtml(formatCurrency(l.solde))}</td>
        </tr>`).join("")}
        <tr class="total-row"><td colspan="6">Solde final</td><td class="num">${escapeHtml(formatCurrency(soldeFinal))}</td></tr>
      </tbody>
    </table>`;
  return document(`Grand livre — ${compte.numero}`, corps);
}
