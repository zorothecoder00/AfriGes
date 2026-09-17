// lib/rapportIncidentCommercialHtml.ts
// "Rapport d'incident" commercial (vente/livraison) — CDC digitalisation
// §5.8. Distinct du RapportIncident SST (accidents de travail). Même
// convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

const LABEL_TYPE: Record<string, string> = {
  LIVRAISON: "Livraison", PRODUIT: "Produit", COMPORTEMENT_CLIENT: "Comportement client", COMPORTEMENT_AGENT: "Comportement agent", AUTRE: "Autre",
};
const STATUT_LABEL: Record<string, string> = { OUVERT: "Ouvert", EN_COURS: "En cours", CLOTURE: "Clôturé", ANNULE: "Annulé" };

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

export interface IncidentCommercialHtmlData {
  numero: string; dateIncident: Date | string; lieu: string; type: string; description: string;
  personnesImpliquees: string | null; actionsCorrectives: string | null; statut: string;
  declarePar: { nom: string; prenom: string } | null;
  reclamation?: { numero: string } | null;
  qrDataUrl?: string | null;
}

export function genRapportIncidentCommercialHtml(inc: IncidentCommercialHtmlData): string {
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">RAPPORT D'INCIDENT</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Incident commercial (vente/livraison)</p>
    </div>
    <div style="text-align:right">${inc.qrDataUrl ? `<img src="${inc.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(inc.numero))}
    ${kv("Date de l'incident", fmtDateHeure(inc.dateIncident))}
    ${kv("Lieu", esc(inc.lieu))}
    ${kv("Type", LABEL_TYPE[inc.type] ?? esc(inc.type))}
    ${kv("Statut", STATUT_LABEL[inc.statut] ?? esc(inc.statut))}
    ${inc.reclamation ? kv("Réclamation liée", esc(inc.reclamation.numero)) : ""}
    ${kv("Déclaré par", esc(inc.declarePar ? `${inc.declarePar.prenom} ${inc.declarePar.nom}` : "—"))}
  </table>

  ${sectionTitle("Description de l'incident")}
  <p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(inc.description)}</p>

  ${sectionTitle("Personnes impliquées")}
  <p style="font-size:11px">${dash(inc.personnesImpliquees)}</p>

  ${sectionTitle("Actions correctives")}
  <p style="font-size:11px">${dash(inc.actionsCorrectives)}</p>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Déclarant", "Responsable Point de Vente / Chef d'agence"].map((r) => `
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
