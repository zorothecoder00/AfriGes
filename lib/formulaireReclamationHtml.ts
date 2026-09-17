// lib/formulaireReclamationHtml.ts
// "Formulaire de réclamation client" (CDC digitalisation §5.8). Même
// convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { LABEL_TYPE_RECLAMATION } from "@/lib/reclamationClient";

const STATUT_LABEL: Record<string, string> = {
  ENREGISTREE: "Enregistrée", EN_TRAITEMENT: "En traitement", RESOLUE: "Résolue", CLOTUREE: "Clôturée", REJETEE: "Rejetée",
};

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

export interface ReclamationHtmlData {
  numero: string; type: string; objet: string; description: string; statut: string;
  sourceReference: string | null; createdAt: Date | string;
  client: { nom: string; prenom: string; telephone: string | null; codeClient?: string | null };
  pointDeVente: { nom: string; code: string } | null;
  creePar: { nom: string; prenom: string } | null;
  lignes: { produit: { nom: string }; quantite: number; motif: string | null }[];
  qrDataUrl?: string | null;
}

export function genFormulaireReclamationHtml(r: ReclamationHtmlData): string {
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  const clientNomComplet = `${r.client.prenom} ${r.client.nom}`;
  const lignesHtml = r.lignes.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <tr style="background:#ecfdf5"><th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th><th style="padding:5px 8px;border:1px solid #e2e8f0">Quantité</th><th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Motif</th></tr>
        ${r.lignes.map((l) => `<tr>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(l.produit.nom)}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${l.quantite}</td>
          <td style="padding:5px 8px;border:1px solid #e2e8f0">${dash(l.motif)}</td>
        </tr>`).join("")}
      </table>`
    : `<p style="font-size:11px;color:#64748b">Aucun produit spécifique rattaché à cette réclamation.</p>`;

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">FORMULAIRE DE RÉCLAMATION CLIENT</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Service Commercial</p>
    </div>
    <div style="text-align:right">${r.qrDataUrl ? `<img src="${r.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de réclamation", esc(r.numero))}
    ${kv("Date d'enregistrement", fmtDateHeure(r.createdAt))}
    ${kv("Statut", STATUT_LABEL[r.statut] ?? esc(r.statut))}
    ${kv("Point de vente", r.pointDeVente ? esc(`${r.pointDeVente.nom} (${r.pointDeVente.code})`) : "—")}
    ${kv("Enregistrée par", esc(r.creePar ? `${r.creePar.prenom} ${r.creePar.nom}` : "—"))}
  </table>

  ${sectionTitle("Client")}
  ${table(
    kv("Nom & Prénoms", esc(clientNomComplet) + (r.client.codeClient ? ` (${esc(r.client.codeClient)})` : "")) +
    kv("Téléphone", dash(r.client.telephone)),
  )}

  ${sectionTitle("Objet de la réclamation")}
  ${table(
    kv("Type", LABEL_TYPE_RECLAMATION[r.type as keyof typeof LABEL_TYPE_RECLAMATION] ?? esc(r.type)) +
    kv("Objet", esc(r.objet)) +
    kv("Référence document source", dash(r.sourceReference)),
  )}
  <p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(r.description)}</p>

  ${sectionTitle("Produits concernés")}
  ${lignesHtml}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Client", "Agent / Service Commercial"].map((rLabel) => `
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
