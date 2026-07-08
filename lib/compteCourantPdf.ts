// lib/compteCourantPdf.ts
// Gabarits HTML des documents du module Compte Courant (Lot 5) :
// relevé de compte, attestation, carnet. Rendu en PDF via lib/pdf.ts (Chromium).
// En-tête / pied AFRISIME mutualisés pour une identité visuelle cohérente.

import { escapeHtml } from "@/lib/pdf";
import { SOCIETE_PIED } from "@/lib/societe";

export const fcfa = (v: number) => `${Math.round(Number(v ?? 0)).toLocaleString("fr-FR")} FCFA`;
export const dtLong = (d: Date | string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
export const dLong = (d: Date | string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

/** Ligne clé/valeur d'un tableau méta. */
export function row(k: string, v: string): string {
  return `<tr><td class="k">${escapeHtml(k)}</td><td class="v">${escapeHtml(v)}</td></tr>`;
}

interface DocumentOpts {
  title: string;
  /** Bloc HTML affiché à droite de l'en-tête (référence, période, date…). */
  headerRight?: string;
  /** Corps du document (HTML déjà échappé/construit). */
  bodyHtml: string;
  /** Affiche le bloc de signatures en bas. */
  signatures?: [string, string];
  landscape?: boolean;
}

/**
 * Enveloppe un corps de document dans le gabarit AFRISIME complet (en-tête,
 * styles partagés, pied de page). Renvoie un document HTML autonome.
 */
export function renderDocumentCC(opts: DocumentOpts): string {
  const signatures = opts.signatures
    ? `<div class="sign">${opts.signatures.map((s) => `<div>${escapeHtml(s)}</div>`).join("")}</div>`
    : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,"Helvetica Neue",sans-serif;color:#0f172a;padding:26px;${opts.landscape ? "" : "max-width:760px;"}margin:0 auto;font-size:13px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #047857;padding-bottom:12px;margin-bottom:18px}
    .brand{font-size:22px;font-weight:900;color:#047857;letter-spacing:.5px}
    .sub{font-size:11px;color:#64748b}
    .hr{text-align:right}
    .hr .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px}
    .hr .val{font-family:monospace;font-weight:700}
    h1{font-size:17px;color:#065f46;margin:2px 0 14px}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    .meta td{padding:5px 0;vertical-align:top}
    .meta .k{color:#64748b;width:38%}
    .meta .v{text-align:right;font-weight:600;color:#0f172a}
    .amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px 16px;margin:16px 0;display:flex;justify-content:space-between;align-items:center}
    .amount .lbl{font-size:11px;color:#64748b}
    .amount .big{font-size:24px;font-weight:900;color:#047857}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
    .card{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px}
    .card .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase}
    .card .num{font-size:15px;font-weight:800;color:#0f172a;margin-top:2px}
    .ledger{margin-top:6px}
    .ledger th{background:#f1f5f9;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:.3px;padding:7px 8px;text-align:left;border-bottom:1px solid #e2e8f0}
    .ledger td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px}
    .ledger .num{text-align:right;font-variant-numeric:tabular-nums}
    .credit{color:#047857;font-weight:600}
    .debit{color:#ea580c;font-weight:600}
    .body-text{line-height:1.8;margin:10px 0}
    .body-text b{color:#065f46}
    .sign{display:flex;gap:60px;margin-top:44px}
    .sign div{flex:1;border-top:1px solid #0f172a;padding-top:6px;font-size:11px;color:#64748b;text-align:center}
    .foot{margin-top:26px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#94a3b8;text-align:center}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700}
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">AFRISIME</div>
        <div class="sub">Compte Courant — Portefeuille interne</div>
      </div>
      <div class="hr">${opts.headerRight ?? ""}</div>
    </div>
    <h1>${escapeHtml(opts.title)}</h1>
    ${opts.bodyHtml}
    ${signatures}
    <div class="foot">Document généré le ${escapeHtml(dtLong(new Date()))} · ${escapeHtml(SOCIETE_PIED)}</div>
  </body></html>`;
}
