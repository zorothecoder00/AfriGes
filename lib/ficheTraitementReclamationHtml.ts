// lib/ficheTraitementReclamationHtml.ts
// "Fiche de traitement de réclamation" — journal des actions menées. Devient
// la "Fiche de clôture de réclamation" une fois statut CLOTUREE (CDC
// digitalisation §5.8). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { LABEL_TYPE_ACTION_RECLAMATION, LABEL_TYPE_RECLAMATION } from "@/lib/reclamationClient";

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
function fmtDateHeure(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export interface ActionReclamationHtml { type: string; description: string | null; dateAction: Date | string; auteur: { nom: string; prenom: string } }

export interface ReclamationTraitementHtmlData {
  numero: string; type: string; objet: string; statut: string;
  resumeCloture: string | null; clotureLe: Date | string | null;
  client: { nom: string; prenom: string };
  actions: ActionReclamationHtml[];
  qrDataUrl?: string | null;
}

export function genFicheTraitementReclamationHtml(r: ReclamationTraitementHtmlData): string {
  const estCloture = r.statut === "CLOTUREE";
  const titre = estCloture ? "FICHE DE CLÔTURE DE RÉCLAMATION" : "FICHE DE TRAITEMENT DE RÉCLAMATION";
  const clientNom = `${r.client.prenom} ${r.client.nom}`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  const journalHtml = r.actions.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <tr style="background:#ecfdf5"><th style="padding:5px 8px;border:1px solid #e2e8f0">Date</th><th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Action</th><th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Description</th><th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Auteur</th></tr>
        ${r.actions.map((a) => `<tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;white-space:nowrap">${fmtDateHeure(a.dateAction)}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${LABEL_TYPE_ACTION_RECLAMATION[a.type as keyof typeof LABEL_TYPE_ACTION_RECLAMATION] ?? esc(a.type)}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${dash(a.description)}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(`${a.auteur.prenom} ${a.auteur.nom}`)}</td>
        </tr>`).join("")}
      </table>`
    : `<p style="font-size:11px;color:#64748b">Aucune action enregistrée.</p>`;

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">${titre}</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Retours et réclamations</p>
    </div>
    <div style="text-align:right">${r.qrDataUrl ? `<img src="${r.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de réclamation", esc(r.numero))}
    ${kv("Type", LABEL_TYPE_RECLAMATION[r.type as keyof typeof LABEL_TYPE_RECLAMATION] ?? esc(r.type))}
    ${kv("Objet", esc(r.objet))}
    ${kv("Client", esc(clientNom))}
    ${estCloture ? kv("Date de clôture", fmtDateHeure(r.clotureLe)) : ""}
  </table>

  ${sectionTitle("Journal des actions de traitement")}
  ${journalHtml}

  ${estCloture ? `${sectionTitle("Résumé de clôture")}<p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(r.resumeCloture ?? "")}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Responsable du traitement", "Client (accusé de clôture)"].map((rLabel) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid #333;margin-top:34px;padding-top:6px;color:#555">${rLabel}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDate(new Date())} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
