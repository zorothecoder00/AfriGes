// lib/bonRemplacementHtml.ts
// "Bon de remplacement" — organise le remplacement d'un produit défectueux
// (CDC digitalisation §5.8). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = { DEMANDE: "Demandé", APPROUVE: "Approuvé", LIVRE: "Livré", REJETE: "Rejeté" };

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
function fmtDateHeure(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export interface RemplacementHtmlData {
  numero: string; statut: string; quantite: number; dateLivraison: Date | string | null; motifRejet: string | null;
  produitOrigine: { nom: string }; produitRemplacement: { nom: string };
  reclamation: { numero: string; client: { nom: string; prenom: string } };
  magasinier: { nom: string; prenom: string } | null;
  qrDataUrl?: string | null;
}

export function genBonRemplacementHtml(r: RemplacementHtmlData): string {
  const clientNom = `${r.reclamation.client.prenom} ${r.reclamation.client.nom}`;
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">BON DE REMPLACEMENT</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Retours et réclamations</p>
    </div>
    <div style="text-align:right">${r.qrDataUrl ? `<img src="${r.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(r.numero))}
    ${kv("Réclamation liée", esc(r.reclamation.numero))}
    ${kv("Statut", STATUT_LABEL[r.statut] ?? esc(r.statut))}
    ${kv("Date de livraison", fmtDateHeure(r.dateLivraison))}
    ${kv("Traité par", esc(r.magasinier ? `${r.magasinier.prenom} ${r.magasinier.nom}` : "—"))}
  </table>

  ${sectionTitle("Client")}
  ${table(kv("Nom & Prénoms", esc(clientNom)))}

  ${sectionTitle("Détail du remplacement")}
  ${table(
    kv("Produit d'origine (défectueux)", esc(r.produitOrigine.nom)) +
    kv("Produit de remplacement", esc(r.produitRemplacement.nom)) +
    kv("Quantité", String(r.quantite)),
  )}

  ${r.motifRejet ? `${sectionTitle("Motif de rejet")}<p style="font-size:11px;color:#dc2626">${esc(r.motifRejet)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Magasinier", "Client"].map((rLabel) => `
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
