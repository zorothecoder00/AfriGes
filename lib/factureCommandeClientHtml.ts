// lib/factureCommandeClientHtml.ts
// Facture d'une commande client — même gabarit que la facture AFRISIME de FactureModal / printInvoice
// (en-tête société avec logo, méta, parties, tableau, totaux, pied baseline + RCCM/NIF), rendu côté
// serveur pour le PDF. Lib pure (aucun import prisma). À garder synchro avec FactureModal.

import { SOCIETE, SOCIETE_LEGAL, SOCIETE_SIEGE } from "@/lib/societe";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR");

const MODE_LABEL: Record<string, string> = { COMPTANT: "Comptant", MOBILE_MONEY: "Mobile Money", CREDIT: "Crédit" };

export interface FactureCommandeClientData {
  numero: string;            // ex. FAC-2026-000123
  commandeReference: string; // BCC-2026-000123
  modeReglement: string;     // COMPTANT | MOBILE_MONEY | CREDIT
  dateEmission: Date | string;
  client: { nom: string; prenom: string; telephone: string | null; adresse: string | null };
  emisPar: { nom: string; prenom: string };
  pointDeVente: { nom: string } | null;
  lieuLivraison: string | null;
  lignes: { designation: string; quantite: number; prixUnitaire: number; remiseMontant: number; montant: number }[];
  totalHT: number; totalRemise: number; totalTVA: number; totalTTC: number;
  logoDataUrl?: string | null;
}

export function genFactureCommandeClientHtml(f: FactureCommandeClientData): string {
  const primary = "#059669", text = "#0f172a", muted = "#64748b", faint = "#94a3b8", rule = "#cbd5e1", rowLine = "#f1f5f9", headRule = "#e2e8f0", boxBg = "#f8fafc";
  const badge = f.modeReglement === "CREDIT" ? { label: "À CRÉDIT", bg: "#2563eb" } : { label: "AU COMPTANT", bg: "#059669" };
  const th = (label: string, extra = "") => `<th style="padding-bottom:8px;color:${faint};font-size:11px;letter-spacing:1px;text-transform:uppercase;${extra}">${label}</th>`;

  const lignes = f.lignes.map((l, i) => `
    <tr>
      <td style="padding:10px 6px;border-bottom:1px solid ${rowLine};color:${faint};font-size:12px">${i + 1}</td>
      <td style="padding:10px 6px;border-bottom:1px solid ${rowLine};font-weight:500;color:${text}">${esc(l.designation)}${l.remiseMontant > 0 ? ` <span style="color:${faint};font-size:11px">(remise ${fmt(l.remiseMontant)})</span>` : ""}</td>
      <td style="padding:10px 6px;border-bottom:1px solid ${rowLine};text-align:center;color:${muted}">${l.quantite}</td>
      <td style="padding:10px 6px;border-bottom:1px solid ${rowLine};text-align:right;color:${muted}">${fmt(l.prixUnitaire)}</td>
      <td style="padding:10px 6px;border-bottom:1px solid ${rowLine};text-align:right;font-weight:600;color:${text}">${fmt(l.montant)}</td>
    </tr>`).join("");

  const ligneTotal = (k: string, v: string) => `<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="color:${muted}">${k}</span><span style="font-weight:500">${v}</span></div>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/><title>Facture ${esc(f.numero)}</title>
<style>* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 14px; color: ${text}; background: white; padding: 24px; max-width: 794px; margin: 0 auto; }</style></head>
<body>
  <div style="margin-bottom:20px">
    ${f.logoDataUrl ? `<img src="${f.logoDataUrl}" alt="AFRISIME" style="height:56px;width:auto;display:block;margin-bottom:10px"/>` : ""}
    <h1 style="font-size:22px;font-weight:900;color:${primary};letter-spacing:-0.5px">AFRISIME SARL</h1>
    <p style="font-size:13px;font-weight:600;color:${muted};margin-top:2px">La Grande Distribution Africaine</p>
    <div style="font-size:11px;color:${muted};line-height:1.6;margin-top:4px">
      ${SOCIETE.activites.map((a) => `<p>${esc(a)}</p>`).join("")}
      <p>${esc(SOCIETE_SIEGE)}</p>
    </div>
  </div>
  <div style="border-top:3px double ${rule};margin-bottom:24px"></div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div><span style="display:inline-block;padding:4px 12px;border-radius:8px;font-size:11px;font-weight:900;letter-spacing:1px;background:${badge.bg};color:#fff">FACTURE ${badge.label}</span>
      <p style="font-size:12px;color:${muted};margin-top:8px">Commande ${esc(f.commandeReference)} · Règlement : ${esc(MODE_LABEL[f.modeReglement] ?? f.modeReglement)}</p></div>
    <div style="text-align:right"><p style="font-size:20px;font-weight:900;color:${text}">${esc(f.numero)}</p>
      <p style="font-size:13px;color:${muted};margin-top:4px">Émise le ${fmtDate(f.dateEmission)}</p></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px">
    <div style="background:${boxBg};border-radius:12px;padding:16px">
      <p style="font-size:10px;font-weight:700;color:${faint};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Facturé à</p>
      <p style="font-weight:700;font-size:15px">${esc(f.client.prenom)} ${esc(f.client.nom)}</p>
      ${f.client.telephone ? `<p style="font-size:13px;color:${muted};margin-top:4px">${esc(f.client.telephone)}</p>` : ""}
      ${f.client.adresse ? `<p style="font-size:13px;color:${muted}">${esc(f.client.adresse)}</p>` : ""}
    </div>
    <div style="background:${boxBg};border-radius:12px;padding:16px">
      <p style="font-size:10px;font-weight:700;color:${faint};letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Émis par</p>
      <p style="font-weight:700;font-size:15px">${esc(f.emisPar.prenom)} ${esc(f.emisPar.nom)}</p>
      ${f.pointDeVente ? `<p style="font-size:13px;color:${muted};margin-top:4px">${esc(f.pointDeVente.nom)}</p>` : ""}
      ${f.lieuLivraison ? `<p style="font-size:13px;color:${muted}">Livraison : ${esc(f.lieuLivraison)}</p>` : ""}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <thead><tr style="border-bottom:2px solid ${headRule}">
      ${th("N°", "text-align:left;width:32px")}${th("Désignation", "text-align:left")}${th("Qté", "text-align:center;width:60px")}${th("Prix de vente", "text-align:right;width:140px")}${th("Montant", "text-align:right;width:140px")}
    </tr></thead>
    <tbody>${lignes}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:32px"><div style="width:280px">
    ${f.totalRemise > 0 ? ligneTotal("Remises accordées", fmt(f.totalRemise)) : ""}
    ${f.totalTVA > 0 ? ligneTotal("Sous-total HT", fmt(f.totalHT)) + ligneTotal("TVA", fmt(f.totalTVA)) : ""}
    <div style="display:flex;justify-content:space-between;border-top:2px solid ${headRule};padding-top:10px">
      <span style="font-weight:700;font-size:16px">Total TTC</span><span style="font-weight:900;font-size:18px;color:${primary}">${fmt(f.totalTTC)}</span>
    </div>
  </div></div>

  <div style="margin-top:40px">
    <div style="border-top:3px double ${rule};margin-bottom:12px"></div>
    <p style="text-align:center;font-size:12px;font-weight:600">${esc(SOCIETE.nom)} | ${esc(SOCIETE.baseline)}.</p>
    <p style="text-align:center;font-size:11px;color:${faint};margin-top:2px">${esc(SOCIETE_LEGAL)}</p>
  </div>
</body></html>`;
}
