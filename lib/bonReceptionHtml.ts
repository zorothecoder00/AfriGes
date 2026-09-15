// lib/bonReceptionHtml.ts
// Bon de Réception — accusé imprimable (CDC digitalisation §3.5).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE_SIGNATURE: "En attente de signature client",
  SIGNE: "Signé — conforme",
  LITIGE: "Litige / réserve",
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

export interface BonReceptionLigneHtml { produitNom: string; quantiteCommandee: number; quantiteLivree: number }

export interface BonReceptionHtmlData {
  reference: string; statut: string;
  commandeReference: string; bonSortieReference: string;
  clientNom: string; clientTelephone: string; clientAdresse: string | null;
  lignes: BonReceptionLigneHtml[];
  etatMarchandise: string | null; reserve: string | null;
  signatureClientNom: string | null; dateSignatureClient: Date | string | null;
  livreur: { nom: string; prenom: string } | null; dateSignatureLivreur: Date | string | null;
  latitudeLivraison: number | null; longitudeLivraison: number | null;
  qrDataUrl?: string | null;
}

export function genBonReceptionHtml(d: BonReceptionHtmlData): string {
  const lignesHtml = d.lignes.map((l) => {
    const ecart = l.quantiteLivree !== l.quantiteCommandee;
    return `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantiteCommandee}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; ${ecart ? "color:#b45309; font-weight:bold;" : ""}">${l.quantiteLivree}</td>
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
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de réception</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:20px;">
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Client</p>
    <p style="margin:0; font-weight:bold;">${esc(d.clientNom)}</p>
    <p style="margin:2px 0 0; font-size:12px;">${esc(d.clientTelephone)}${d.clientAdresse ? ` — ${esc(d.clientAdresse)}` : ""}</p>
    <p style="margin:6px 0 0; font-size:12px; color:#64748b;">Commande ${esc(d.commandeReference)} · Bon de sortie ${esc(d.bonSortieReference)}</p>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        <th style="padding:8px; text-align:center;">Qté commandée</th>
        <th style="padding:8px; text-align:center;">Qté livrée</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  ${d.reserve ? `<p style="font-size:12px; color:#b45309; margin:16px 0;"><strong>Réserve :</strong> ${esc(d.reserve)}</p>` : ""}

  <div style="margin-top:40px; display:flex; justify-content:space-between;">
    <div>
      <p style="margin:0; font-weight:bold;">Livreur</p>
      <p style="font-size:12px; margin-top:6px;">${d.livreur ? `${esc(d.livreur.prenom)} ${esc(d.livreur.nom)}` : "—"}${d.dateSignatureLivreur ? `<br/>${formatDateFr(d.dateSignatureLivreur)}` : ""}</p>
      ${d.latitudeLivraison != null && d.longitudeLivraison != null ? `<p style="font-size:11px; color:#94a3b8; margin-top:4px;">GPS : ${d.latitudeLivraison.toFixed(5)}, ${d.longitudeLivraison.toFixed(5)}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <p style="margin:0; font-weight:bold; text-transform:uppercase;">Attestation client</p>
      ${d.signatureClientNom
        ? `<p style="font-size:12px; color:#059669; margin-top:6px;">Signé électroniquement par ${esc(d.signatureClientNom)}<br/>le ${formatDateFr(d.dateSignatureClient)}</p>`
        : `<div style="margin-top:40px; border-top:1px solid #aaa; width:200px; margin-left:auto;"></div>`}
    </div>
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
