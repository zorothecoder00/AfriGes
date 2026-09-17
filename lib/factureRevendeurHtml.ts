// lib/factureRevendeurHtml.ts
// Facture revendeur (CDC digitalisation §5.6) — imprimée depuis une
// FactureVente (type REVENDEUR). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE_PIED, SOCIETE_LEGAL } from "@/lib/societe";

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
function fmtMoney(n: number): string { return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA"; }

export interface FactureRevendeurHtmlData {
  numero: string;
  statut: string;
  clientNom: string;
  clientTelephone: string | null;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  montantPaye: number;
  dateEmission: Date | string;
  emiseParNom: string;
  lignes: { designation: string; quantite: number; prixUnitaire: number; montant: number }[];
  qrDataUrl?: string | null;
}

export function genFactureRevendeurHtml(f: FactureRevendeurHtmlData): string {
  const solde = f.montantTTC - f.montantPaye;
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;

  const rows = f.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(l.designation)}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${l.quantite}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right">${fmtMoney(l.prixUnitaire)}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:600">${fmtMoney(l.montant)}</td>
  </tr>`).join("");

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:760px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:17px;font-weight:900;color:#047857;margin:0">FACTURE REVENDEUR</h1>
      <p style="font-size:10.5px;color:#64748b;margin:4px 0 0">${esc(SOCIETE_LEGAL)}</p>
    </div>
    <div style="text-align:right">${f.qrDataUrl ? `<img src="${f.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de facture", esc(f.numero))}
    ${kv("Client (revendeur)", esc(f.clientNom))}
    ${kv("Téléphone", dash(f.clientTelephone))}
    ${kv("Date d'émission", fmtDate(f.dateEmission))}
    ${kv("Émise par", esc(f.emiseParNom))}
    ${kv("Statut", f.statut === "EMISE" ? "Émise" : esc(f.statut))}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:#ecfdf5;color:#065f46">
      <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Désignation</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Qté</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Prix unit.</th>
      <th style="padding:5px 8px;border:1px solid #e2e8f0">Montant</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="width:50%;margin-left:auto;border-collapse:collapse;font-size:11.5px;margin-top:10px">
    ${kv("Total HT", fmtMoney(f.montantHT))}
    ${f.montantTVA > 0 ? kv("TVA", fmtMoney(f.montantTVA)) : ""}
    ${kv("Total TTC", `<span style="font-size:14px;color:#047857">${fmtMoney(f.montantTTC)}</span>`)}
    ${kv("Déjà payé", fmtMoney(f.montantPaye))}
    ${kv("Solde dû", `<span style="color:${solde > 0 ? "#dc2626" : "#047857"}">${fmtMoney(solde)}</span>`)}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["AFRISIME", "Revendeur"].map((r) => `
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
