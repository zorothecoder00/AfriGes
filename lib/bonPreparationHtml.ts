// lib/bonPreparationHtml.ts
// Bon de Préparation — liste de prélèvement imprimable (CDC digitalisation §5.7).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  EN_COURS: "En cours de préparation",
  PRETE: "Prête pour expédition",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export interface BonPreparationLigneHtml { produitNom: string; quantiteDemandee: number; quantitePreparee: number }

export interface BonPreparationHtmlData {
  reference: string; statut: string;
  commandeReference: string; bonSortieReference: string;
  lignes: BonPreparationLigneHtml[];
  preparateur: { nom: string; prenom: string } | null; datePreparation: Date | string | null;
  commentaireEcart: string | null;
  qrDataUrl?: string | null;
}

export function genBonPreparationHtml(d: BonPreparationHtmlData): string {
  const lignesHtml = d.lignes.map((l) => {
    const ecart = l.quantitePreparee !== l.quantiteDemandee;
    return `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantiteDemandee}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; ${ecart ? "color:#b45309; font-weight:bold;" : ""}">${l.quantitePreparee}</td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de préparation</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:20px;">
    <p style="font-size:12px; color:#64748b; margin:0;">Commande ${esc(d.commandeReference)} · Bon de sortie ${esc(d.bonSortieReference)}</p>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        <th style="padding:8px; text-align:center;">Qté demandée</th>
        <th style="padding:8px; text-align:center;">Qté préparée</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  ${d.commentaireEcart ? `<p style="font-size:12px; color:#b45309; margin:16px 0;"><strong>Écart de préparation :</strong> ${esc(d.commentaireEcart)}</p>` : ""}

  <div style="margin-top:40px;">
    <p style="margin:0; font-weight:bold;">Préparé par</p>
    <p style="font-size:12px; margin-top:6px;">${d.preparateur ? `${esc(d.preparateur.prenom)} ${esc(d.preparateur.nom)}` : "—"}${d.datePreparation ? `<br/>le ${formatDateFr(d.datePreparation)}` : ""}</p>
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
