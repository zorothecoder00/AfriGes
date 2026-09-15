// lib/commandeClientHtml.ts
// Bon de Commande Client — accusé imprimable (CDC digitalisation §3.2).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  SOUMISE: "Soumise", EN_VALIDATION: "En attente de validation", VALIDEE: "Validée",
  EN_PREPARATION: "En préparation", LIVREE: "Livrée", CLOTUREE: "Clôturée",
  REJETEE: "Rejetée", ANNULEE: "Annulée",
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

export interface CommandeClientLigneHtml { produitNom: string; quantite: number; prixUnitaire: number; remiseMontant: number; totalLigne: number }

export interface CommandeClientHtmlData {
  reference: string; statut: string;
  agent: { nom: string; prenom: string };
  pointDeVente: { nom: string; code: string };
  client: { nom: string; prenom: string; telephone: string; adresse: string | null };
  modeReglement: string; typeClientCommande: string;
  dateLivraisonSouhaitee: Date | string | null; lieuLivraison: string | null;
  lignes: CommandeClientLigneHtml[];
  totalHT: number; totalRemise: number; totalTVA: number; totalTTC: number;
  signatureClientNom: string; dateSignatureClient: Date | string;
  visaResponsablePar: { nom: string; prenom: string } | null; dateVisaResponsable: Date | string | null;
  qrDataUrl?: string | null;
}

export function genCommandeClientHtml(d: CommandeClientHtmlData): string {
  const lignesHtml = d.lignes.map((l) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantite}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(l.prixUnitaire)}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${l.remiseMontant > 0 ? `-${fmtMontant(l.remiseMontant)}` : "—"}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${fmtMontant(l.totalLigne)}</td>
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
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de commande client</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom:20px;">
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Client</p>
      <p style="margin:0; font-weight:bold;">${esc(d.client.prenom)} ${esc(d.client.nom)} ${d.typeClientCommande === "REVENDEUR" ? "(Revendeur)" : ""}</p>
      <p style="margin:2px 0 0; font-size:12px;">${esc(d.client.telephone)}</p>
      ${d.client.adresse ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.client.adresse)}</p>` : ""}
    </div>
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Agent / Agence</p>
      <p style="margin:0; font-weight:bold;">${esc(d.agent.prenom)} ${esc(d.agent.nom)}</p>
      <p style="margin:2px 0 0; font-size:12px;">${esc(d.pointDeVente.nom)} (${esc(d.pointDeVente.code)})</p>
      <p style="margin:6px 0 0; font-size:12px;">Règlement : ${esc(d.modeReglement)}</p>
      <p style="margin:2px 0 0; font-size:12px;">Livraison souhaitée : ${d.dateLivraisonSouhaitee ? formatDateFr(d.dateLivraisonSouhaitee) : "non précisée"}${d.lieuLivraison ? ` — ${esc(d.lieuLivraison)}` : ""}</p>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        <th style="padding:8px; text-align:center;">Quantité</th>
        <th style="padding:8px; text-align:right;">Prix unitaire</th>
        <th style="padding:8px; text-align:right;">Remise</th>
        <th style="padding:8px; text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>
  <div style="display:flex; justify-content:flex-end;">
    <div style="width:280px;">
      <div style="display:flex; justify-content:space-between; padding:4px 8px; font-size:12px;"><span>Total HT</span><span>${fmtMontant(d.totalHT)}</span></div>
      ${d.totalRemise > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 8px; font-size:12px; color:#b45309;"><span>Remise</span><span>-${fmtMontant(d.totalRemise)}</span></div>` : ""}
      <div style="display:flex; justify-content:space-between; padding:4px 8px; font-size:12px;"><span>TVA</span><span>${fmtMontant(d.totalTVA)}</span></div>
      <div style="display:flex; justify-content:space-between; padding:10px 8px; background:#0f172a; color:#fff; border-radius:8px; font-weight:bold; margin-top:6px;"><span>Total TTC</span><span>${fmtMontant(d.totalTTC)} XOF</span></div>
    </div>
  </div>

  ${d.visaResponsablePar ? `
  <div style="padding:10px 16px; background:#fef9c3; border:1px solid #fde68a; border-radius:8px; margin-top:20px; font-size:12px; color:#854d0e;">
    <strong>Visa Responsable Vente Crédit</strong> — accordé par ${esc(d.visaResponsablePar.prenom)} ${esc(d.visaResponsablePar.nom)} le ${formatDateFr(d.dateVisaResponsable)}.
  </div>` : ""}

  <div style="margin-top:40px;">
    <p style="margin:0; font-weight:bold;">Engagement d'achat — signature électronique du client</p>
    <p style="font-size:12px; color:#059669; margin-top:6px;">Signé électroniquement par ${esc(d.signatureClientNom)} le ${formatDateFr(d.dateSignatureClient)}</p>
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
