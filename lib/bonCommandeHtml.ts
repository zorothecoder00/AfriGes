// lib/bonCommandeHtml.ts
// Bon de commande (PO) imprimable — CDC Approvisionnement §7 étape 7.
// PDF serveur (lib/pdf.ts) avec en-tête/pied société (lib/societe.ts).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  DRAFT: "Brouillon", PENDING_APPROVAL: "En attente d'approbation", APPROVED: "Approuvé",
  SENT: "Envoyé", ACKNOWLEDGED: "Accusé de réception", PARTIALLY_DELIVERED: "Partiellement livré",
  COMPLETED: "Complété", CANCELLED: "Annulé",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export interface BonCommandeLigneHtml {
  produitNom: string; quantite: number; prixUnitaire: number;
}

export interface BonCommandeHtmlData {
  reference: string; statut: string; devise: string | null;
  dateCommande: Date | string; dateLivraisonPrevue: Date | string | null;
  notes: string | null;
  fournisseur: { nom: string; code: string | null; adresse: string | null; contact: string | null; telephone: string | null; email: string | null };
  pointDeVente: { nom: string; code: string };
  lignes: BonCommandeLigneHtml[];
  montantTotal: number;
  signePar: { nom: string; prenom: string } | null;
  dateSignature: Date | string | null;
}

export function genBonCommandeHtml(d: BonCommandeHtmlData): string {
  const devise = d.devise ?? "XOF";
  const lignesHtml = d.lignes.map((l) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantite}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(l.prixUnitaire)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(l.quantite * l.prixUnitaire)}</td>
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
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de commande</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom:24px;">
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Fournisseur</p>
      <p style="margin:0; font-weight:bold;">${esc(d.fournisseur.nom)}${d.fournisseur.code ? ` (${esc(d.fournisseur.code)})` : ""}</p>
      ${d.fournisseur.adresse ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.fournisseur.adresse)}</p>` : ""}
      ${d.fournisseur.telephone ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.fournisseur.telephone)}</p>` : ""}
      ${d.fournisseur.email ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.fournisseur.email)}</p>` : ""}
    </div>
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Livraison</p>
      <p style="margin:0; font-weight:bold;">${esc(d.pointDeVente.nom)} (${esc(d.pointDeVente.code)})</p>
      <p style="margin:6px 0 0; font-size:12px;">Date de commande : ${formatDateFr(d.dateCommande)}</p>
      <p style="margin:2px 0 0; font-size:12px;">Livraison prévue : ${d.dateLivraisonPrevue ? formatDateFr(d.dateLivraisonPrevue) : "non précisée"}</p>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        <th style="padding:8px; text-align:center;">Quantité</th>
        <th style="padding:8px; text-align:right;">Prix unitaire (${esc(devise)})</th>
        <th style="padding:8px; text-align:right;">Total (${esc(devise)})</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>
  <div style="display:flex; justify-content:flex-end; margin-bottom:24px;">
    <div style="width:260px; padding:12px 18px; background:#0f172a; color:#fff; border-radius:8px; display:flex; justify-content:space-between;">
      <span style="font-weight:bold;">Montant total</span>
      <span style="font-weight:bold;">${fmtMontant(d.montantTotal)} ${esc(devise)}</span>
    </div>
  </div>

  ${d.notes ? `<p style="font-size:12px; color:#475569; margin-bottom:24px;"><strong>Notes :</strong> ${esc(d.notes)}</p>` : ""}

  <div style="margin-top:48px; display:flex; justify-content:space-between;">
    <div>
      <p style="margin:0; font-weight:bold;">Le fournisseur</p>
      <div style="margin-top:50px; border-top:1px solid #aaa; width:200px;"></div>
    </div>
    <div style="text-align:right;">
      <p style="margin:0; font-weight:bold; text-transform:uppercase;">${esc(SOCIETE.nom)}</p>
      ${d.signePar
        ? `<p style="font-size:12px; color:#059669; margin-top:6px;">Signé électroniquement par ${esc(d.signePar.prenom)} ${esc(d.signePar.nom)}<br/>le ${formatDateFr(d.dateSignature)}</p>`
        : `<div style="margin-top:50px; border-top:1px solid #aaa; width:200px; margin-left:auto;"></div>`}
    </div>
  </div>

  <hr style="margin-top:48px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
