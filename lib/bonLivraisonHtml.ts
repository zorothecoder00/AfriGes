// lib/bonLivraisonHtml.ts
// Bon de Livraison — document de transport imprimable (CDC digitalisation §5.7).
// Accompagne physiquement/juridiquement la marchandise ; distinct du Bon de
// Réception (attestation du client à l'arrivée, cf. lib/bonReceptionHtml.ts).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

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

export interface BonLivraisonLigneHtml { produitNom: string; quantite: number }

export interface BonLivraisonHtmlData {
  reference: string;
  commandeReference: string; bonSortieReference: string;
  clientNom: string; clientTelephone: string; adresseLivraison: string | null;
  lignes: BonLivraisonLigneHtml[];
  livreur: { nom: string; prenom: string };
  moyenTransport: string | null; dateDepart: Date | string;
  qrDataUrl?: string | null;
}

export function genBonLivraisonHtml(d: BonLivraisonHtmlData): string {
  const lignesHtml = d.lignes.map((l) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantite}</td>
    </tr>`).join("");

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de livraison</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">Départ le ${formatDateFr(d.dateDepart)}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom:20px;">
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Destinataire</p>
      <p style="margin:0; font-weight:bold;">${esc(d.clientNom)}</p>
      <p style="margin:2px 0 0; font-size:12px;">${esc(d.clientTelephone)}</p>
      ${d.adresseLivraison ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.adresseLivraison)}</p>` : ""}
    </div>
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Transport</p>
      <p style="margin:0; font-weight:bold;">${esc(d.livreur.prenom)} ${esc(d.livreur.nom)}</p>
      ${d.moyenTransport ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.moyenTransport)}</p>` : ""}
      <p style="margin:6px 0 0; font-size:12px; color:#64748b;">Commande ${esc(d.commandeReference)} · Bon de sortie ${esc(d.bonSortieReference)}</p>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        <th style="padding:8px; text-align:center;">Quantité</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>

  <div style="margin-top:40px; display:flex; justify-content:space-between;">
    <div>
      <p style="margin:0; font-weight:bold;">Signature du livreur</p>
      <div style="margin-top:30px; border-top:1px solid #aaa; width:200px;"></div>
    </div>
    <div style="text-align:right;">
      <p style="margin:0; font-weight:bold;">Signature du destinataire</p>
      <div style="margin-top:30px; border-top:1px solid #aaa; width:200px; margin-left:auto;"></div>
    </div>
  </div>
  <p style="font-size:10px; color:#94a3b8; margin-top:16px;">La réception effective est attestée séparément sur le Bon de Réception.</p>

  <hr style="margin-top:24px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
