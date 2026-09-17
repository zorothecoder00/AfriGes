// lib/bonCommandeRevendeurHtml.ts
// Bon de commande revendeur (CDC digitalisation §5.6). Même convention que
// lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", CONFIRMEE: "Confirmée", LIVREE: "Livrée", FACTUREE: "Facturée", ANNULEE: "Annulée" };

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

export interface LigneCommandeRevendeurHtml {
  quantite: number; prixUnitaire: number; montantLigne: number;
  produit: { nom: string; codeProduit: string | null };
}

export interface CommandeRevendeurHtmlData {
  id: number; reference: string; statut: string;
  raisonSociale: string;
  pointDeVente: { nom: string; code: string };
  lignes: LigneCommandeRevendeurHtml[];
  totalTTC: number;
  dateLivraisonSouhaitee: Date | string | null;
  notes: string | null;
  createdAt: Date | string;
  qrDataUrl?: string | null;
}

export function genBonCommandeRevendeurHtml(d: CommandeRevendeurHtmlData): string {
  const rows = d.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(l.produit.nom)}${l.produit.codeProduit ? ` <span style="color:#94a3b8">(${esc(l.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${l.quantite}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right">${fmtMoney(l.prixUnitaire)}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${fmtMoney(l.montantLigne)}</td>
  </tr>`).join("");

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:760px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:17px;font-weight:900;color:#047857;margin:0">BON DE COMMANDE REVENDEUR</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}
      <p style="font-size:9px;color:#94a3b8;text-align:center;letter-spacing:1px;margin-top:4px">${esc(d.reference)}</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de commande", esc(d.reference))}
    ${kv("Revendeur", esc(d.raisonSociale))}
    ${kv("Point de vente", esc(`${d.pointDeVente.nom} (${d.pointDeVente.code})`))}
    ${kv("Date", fmtDate(d.createdAt))}
    ${d.dateLivraisonSouhaitee ? kv("Livraison souhaitée", fmtDate(d.dateLivraisonSouhaitee)) : ""}
    ${kv("Statut", STATUT_LABEL[d.statut] ?? esc(d.statut))}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:#ecfdf5;color:#065f46">
      <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Qté</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Prix unit.</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Montant</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3" style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:700">Total</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:900;color:#047857">${fmtMoney(d.totalTTC)}</td>
    </tr></tfoot>
  </table>

  ${d.notes ? `<p style="margin-top:10px;font-size:11px"><strong>Notes :</strong> ${esc(d.notes)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Revendeur", "AFRISIME"].map((r) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid #333;margin-top:34px;padding-top:6px;color:#555">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDate(new Date())} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
