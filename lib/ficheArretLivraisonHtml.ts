// lib/ficheArretLivraisonHtml.ts
// Constat d'un arrêt de tournée (CDC digitalisation §5.7) — la mise en page
// s'adapte au statut constaté (NON_EFFECTUE/INCIDENT/EFFECTUE). Même
// convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

const TITRES: Record<string, string> = {
  EFFECTUE: "CONSTAT DE LIVRAISON",
  NON_EFFECTUE: "FICHE DE LIVRAISON NON EFFECTUÉE",
  INCIDENT: "FICHE D'INCIDENT LIVRAISON",
  PLANIFIE: "CONSTAT D'ARRÊT",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function dash(v: string | null | undefined): string { return v ? esc(v) : "—"; }
function fmtDateHeure(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export interface ArretConstatHtmlData {
  ordre: number; statut: string;
  clientNom: string; clientTelephone: string | null; adresseLivraison: string | null;
  heureArrivee: Date | string | null; motifNonEffectue: string | null; incidentDescription: string | null; signatureClientNom: string | null;
  retourLignes: { quantite: number; motif: string | null; produit: { nom: string; codeProduit: string | null } }[];
  tourneeReference: string;
  qrDataUrl?: string | null;
}

export function genFicheArretLivraisonHtml(a: ArretConstatHtmlData): string {
  const titre = TITRES[a.statut] ?? "CONSTAT D'ARRÊT";
  const grave = a.statut === "NON_EFFECTUE" || a.statut === "INCIDENT";

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:38%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  const retourRows = a.retourLignes.map((r) => `<tr>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(r.produit.nom)}${r.produit.codeProduit ? ` <span style="color:#94a3b8">(${esc(r.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${r.quantite}</td>
    <td style="padding:5px 8px;border:1px solid #e2e8f0">${dash(r.motif)}</td>
  </tr>`).join("");

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:${grave ? "#dc2626" : "#047857"};margin:0">${esc(titre)}</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Logistique &amp; livraison</p>
    </div>
    <div style="text-align:right">${a.qrDataUrl ? `<img src="${a.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("Tournée", esc(a.tourneeReference))}
    ${kv("Arrêt n°", String(a.ordre))}
    ${kv("Client", esc(a.clientNom))}
    ${kv("Téléphone", dash(a.clientTelephone))}
    ${kv("Adresse", dash(a.adresseLivraison))}
    ${kv("Heure de passage", a.heureArrivee ? fmtDateHeure(a.heureArrivee) : "—")}
  </table>

  ${a.statut === "NON_EFFECTUE" ? `
    ${sectionTitle("Motif de non-livraison")}
    <p style="margin:8px 0;line-height:1.5;text-align:justify;font-size:11px;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:4px">${esc(a.motifNonEffectue ?? "—")}</p>` : ""}

  ${a.statut === "INCIDENT" ? `
    ${sectionTitle("Description de l'incident")}
    <p style="margin:8px 0;line-height:1.5;text-align:justify;font-size:11px;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:4px">${esc(a.incidentDescription ?? "—")}</p>` : ""}

  ${a.retourLignes.length > 0 ? `
    ${sectionTitle("Marchandises retournées")}
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <thead><tr style="background:#ecfdf5;color:#065f46">
        <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th>
        <th style="padding:5px 8px;border:1px solid #e2e8f0">Qté</th>
        <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Motif</th>
      </tr></thead>
      <tbody>${retourRows}</tbody>
    </table>` : ""}

  ${a.statut === "EFFECTUE" ? table(kv("Réceptionné par", dash(a.signatureClientNom))) : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Livreur", "Client (le cas échéant)"].map((r) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid #333;margin-top:34px;padding-top:6px;color:#555">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDateHeure(new Date())} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
