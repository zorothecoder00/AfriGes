// lib/bordereauRemiseHtml.ts
// Bordereau de Remise de Fonds — accusé imprimable (CDC digitalisation §3.1).
// Même convention que lib/bonCommandeHtml.ts / lib/bonSortieHtml.ts.

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  SOUMIS: "Soumis",
  ECART_SIGNALE: "Écart signalé",
  VALIDE: "Validé",
  CLOTURE: "Clôturé",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export interface BordereauRemiseHtmlData {
  reference: string; statut: string;
  pointDeVente: { nom: string; code: string };
  collecteur: { nom: string; prenom: string; telephone: string | null };
  cotisationsEspeces: number; cotisationsMobileMoney: number; mobileMoneyReference: string | null;
  remboursements: number; ventes: number; venteCarnet: number; fraisLivraison: number;
  montantVirement: number; virementReference: string | null;
  totalEspecesAttendu: number;
  lignesBilletage: { denomination: number; nombre: number; total: number }[];
  totalBilletageCalcule: number;
  ecartSoumission: number; motifEcartSoumission: string | null;
  tresorier: { nom: string; prenom: string } | null;
  montantConfirmeTresorier: number | null; dateTraitementTresorier: Date | string | null;
  visaCGTPar: { nom: string; prenom: string } | null; dateVisaCGT: Date | string | null;
  depotBancaireReference: string | null; dateCloture: Date | string | null;
  qrDataUrl?: string | null;
}

export function genBordereauRemiseHtml(d: BordereauRemiseHtmlData): string {
  const lignesBilletageHtml = d.lignesBilletage
    .filter((l) => l.nombre > 0)
    .map((l) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${fmtMontant(l.denomination)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${l.nombre}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(l.total)}</td>
    </tr>`).join("");

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bordereau de remise de fonds</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom:20px;">
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Collecteur</p>
      <p style="margin:0; font-weight:bold;">${esc(d.collecteur.prenom)} ${esc(d.collecteur.nom)}</p>
      ${d.collecteur.telephone ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.collecteur.telephone)}</p>` : ""}
    </div>
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Agence / point de dépôt</p>
      <p style="margin:0; font-weight:bold;">${esc(d.pointDeVente.nom)} (${esc(d.pointDeVente.code)})</p>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead><tr style="background:#0f172a; color:#fff;"><th colspan="2" style="padding:8px; text-align:left;">Récapitulatif des fonds remis</th></tr></thead>
    <tbody>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Cotisations espèces</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.cotisationsEspeces)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Cotisations mobile money${d.mobileMoneyReference ? ` (réf. ${esc(d.mobileMoneyReference)})` : ""}</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.cotisationsMobileMoney)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Remboursements</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.remboursements)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Ventes</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.ventes)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Vente de carnet</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.venteCarnet)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Frais de livraison</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.fraisLivraison)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Virement / dépôt direct${d.virementReference ? ` (réf. ${esc(d.virementReference)})` : ""}</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(d.montantVirement)}</td></tr>
    </tbody>
  </table>
  <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
    <div style="width:280px; padding:10px 16px; background:#0f172a; color:#fff; border-radius:8px; display:flex; justify-content:space-between;">
      <span style="font-weight:bold;">Total espèces attendu</span>
      <span style="font-weight:bold;">${fmtMontant(d.totalEspecesAttendu)} XOF</span>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead><tr style="background:#0f172a; color:#fff;"><th style="padding:8px; text-align:left;">Dénomination</th><th style="padding:8px; text-align:center;">Nombre</th><th style="padding:8px; text-align:right;">Total</th></tr></thead>
    <tbody>${lignesBilletageHtml || `<tr><td colspan="3" style="padding:8px; text-align:center; color:#999;">Aucune ligne de billetage</td></tr>`}</tbody>
  </table>
  <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
    <div style="width:280px; padding:10px 16px; background:#0f172a; color:#fff; border-radius:8px; display:flex; justify-content:space-between;">
      <span style="font-weight:bold;">Total billetage</span>
      <span style="font-weight:bold;">${fmtMontant(d.totalBilletageCalcule)} XOF</span>
    </div>
  </div>
  ${Math.abs(d.ecartSoumission) > 0.01 ? `<p style="font-size:12px; color:#b45309; margin-bottom:16px;"><strong>Écart déclaré :</strong> ${fmtMontant(d.ecartSoumission)} XOF — ${esc(d.motifEcartSoumission)}</p>` : ""}

  ${d.tresorier ? `
  <div style="padding:10px 16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; margin-bottom:16px; font-size:12px; color:#065f46;">
    <strong>Comptage caissier</strong> — ${esc(d.tresorier.prenom)} ${esc(d.tresorier.nom)} a confirmé ${d.montantConfirmeTresorier != null ? fmtMontant(d.montantConfirmeTresorier) : "—"} XOF le ${formatDateFr(d.dateTraitementTresorier)}.
  </div>` : ""}

  ${d.visaCGTPar ? `
  <div style="padding:10px 16px; background:#fef9c3; border:1px solid #fde68a; border-radius:8px; margin-bottom:16px; font-size:12px; color:#854d0e;">
    <strong>Visa Président CGT / Direction</strong> — accordé par ${esc(d.visaCGTPar.prenom)} ${esc(d.visaCGTPar.nom)} le ${formatDateFr(d.dateVisaCGT)}.
  </div>` : ""}

  ${d.depotBancaireReference ? `
  <div style="padding:10px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:16px; font-size:12px; color:#1e40af;">
    <strong>Clôturé</strong> — dépôt bancaire réf. ${esc(d.depotBancaireReference)}, le ${formatDateFr(d.dateCloture)}.
  </div>` : ""}

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
