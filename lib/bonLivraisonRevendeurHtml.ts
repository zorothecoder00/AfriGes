// lib/bonLivraisonRevendeurHtml.ts
// Bon de livraison revendeur (CDC digitalisation §5.6). Même convention que
// lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function dash(v: string | null | undefined): string { return v ? esc(v) : "—"; }
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export interface BonLivraisonRevendeurHtmlData {
  reference: string;
  dateDepart: Date | string;
  notes: string | null;
  livreur: { nom: string; prenom: string } | null;
  lignes: { quantite: number; produit: { nom: string; codeProduit: string | null } }[];
  raisonSociale: string;
  commandeReference: string;
  qrDataUrl?: string | null;
}

export function genBonLivraisonRevendeurHtml(d: BonLivraisonRevendeurHtmlData): string {
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;

  const rows = d.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(l.produit.nom)}${l.produit.codeProduit ? ` <span style="color:#94a3b8">(${esc(l.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${l.quantite}</td>
  </tr>`).join("");

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:17px;font-weight:900;color:#047857;margin:0">BON DE LIVRAISON REVENDEUR</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de bon", esc(d.reference))}
    ${kv("Commande liée", esc(d.commandeReference))}
    ${kv("Revendeur", esc(d.raisonSociale))}
    ${kv("Date de départ", fmtDate(d.dateDepart))}
    ${kv("Livreur", d.livreur ? esc(`${d.livreur.prenom} ${d.livreur.nom}`) : dash(null))}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:#ecfdf5;color:#065f46">
      <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Qté livrée</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${d.notes ? `<p style="margin-top:10px;font-size:11px"><strong>Notes :</strong> ${esc(d.notes)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Livreur", "Revendeur (réception)"].map((r) => `
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
