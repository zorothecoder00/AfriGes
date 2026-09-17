// lib/releveAchatsRevendeurHtml.ts
// Relevé de compte revendeur + État des achats (CDC digitalisation §5.6) —
// rapport agrégé (pas d'instance unique, pas de QR sécurisé — même logique
// que les états financiers). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
function fmtMoney(n: number): string { return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA"; }

export interface FactureRevendeurLigneHtml { numero: string; statut: string; dateEmission: Date | string; montantTTC: number; montantPaye: number }

export interface ReleveAchatsRevendeurHtmlData {
  raisonSociale: string;
  factures: FactureRevendeurLigneHtml[];
  stats: { nbFactures: number; totalFacture: number; totalPaye: number; soldeDu: number; premierAchat: Date | string | null };
}

export function genReleveAchatsRevendeurHtml(d: ReleveAchatsRevendeurHtmlData): string {
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:45%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;

  const rows = d.factures.map((f) => {
    const solde = f.montantTTC - f.montantPaye;
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${esc(f.numero)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${fmtDate(f.dateEmission)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${fmtMoney(f.montantTTC)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${fmtMoney(f.montantPaye)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;${solde > 0 ? "color:#dc2626;font-weight:600" : ""}">${fmtMoney(solde)}</td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:760px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:17px;font-weight:900;color:#047857;margin:0">RELEVÉ DE COMPTE REVENDEUR</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — État des achats</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("Revendeur", esc(d.raisonSociale))}
    ${kv("Date d'émission", fmtDate(new Date()))}
    ${d.stats.premierAchat ? kv("Premier achat", fmtDate(d.stats.premierAchat)) : ""}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:14px">
    ${kv("Nombre de factures", String(d.stats.nbFactures))}
    ${kv("Total facturé", fmtMoney(d.stats.totalFacture))}
    ${kv("Total payé", fmtMoney(d.stats.totalPaye))}
    ${kv("Solde dû", `<span style="color:${d.stats.soldeDu > 0 ? "#dc2626" : "#047857"}">${fmtMoney(d.stats.soldeDu)}</span>`)}
  </table>

  <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">Détail des factures</h2>
  <table style="width:100%;border-collapse:collapse;font-size:10.5px">
    <thead><tr style="background:#ecfdf5;color:#065f46">
      <th style="padding:4px 8px;border:1px solid #e2e8f0">N° facture</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0">Date</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0">Montant TTC</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0">Payé</th>
      <th style="padding:4px 8px;border:1px solid #e2e8f0">Solde</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="padding:10px;border:1px solid #e2e8f0;text-align:center;color:#94a3b8">Aucune facture</td></tr>`}</tbody>
  </table>

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDate(new Date())} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
