// lib/decaissementHtml.ts
// Fiche de Décaissement — accusé/reçu imprimable (CDC digitalisation §3.6).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  SOUMISE: "Soumise", APPROUVEE: "Approuvée", PAYEE: "Payée", REJETEE: "Rejetée",
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

export interface DecaissementHtmlData {
  reference: string; statut: string;
  demandeur: { nom: string; prenom: string };
  beneficiaireNom: string; beneficiaireContact: string | null;
  motif: string; typeDepense: string;
  montantDemande: number; montantApprouve: number | null; motifEcartMontant: string | null;
  modePaiement: string | null; referencePaiement: string | null;
  piecesJustificatives: string[];
  approbateurN1: { nom: string; prenom: string } | null; dateApprobationN1: Date | string | null;
  approbateurN2: { nom: string; prenom: string } | null; dateApprobationN2: Date | string | null;
  executePar: { nom: string; prenom: string } | null; dateExecution: Date | string | null;
  beneficiaireConfirmationNom: string | null; dateConfirmationBeneficiaire: Date | string | null;
  qrDataUrl?: string | null;
}

export function genDecaissementHtml(d: DecaissementHtmlData): string {
  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Fiche de décaissement</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom:20px;">
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Demandeur</p>
      <p style="margin:0; font-weight:bold;">${esc(d.demandeur.prenom)} ${esc(d.demandeur.nom)}</p>
    </div>
    <div style="flex:1; padding:14px 18px; background:#f8fafc; border-radius:8px;">
      <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Bénéficiaire</p>
      <p style="margin:0; font-weight:bold;">${esc(d.beneficiaireNom)}</p>
      ${d.beneficiaireContact ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.beneficiaireContact)}</p>` : ""}
    </div>
  </div>

  <p style="font-size:12px; margin-bottom:4px;"><strong>Type de dépense :</strong> ${esc(d.typeDepense)}</p>
  <p style="font-size:12px; margin-bottom:16px;"><strong>Motif :</strong> ${esc(d.motif)}</p>
  ${d.piecesJustificatives.length ? `<p style="font-size:12px; margin-bottom:16px;"><strong>Pièces justificatives :</strong> ${d.piecesJustificatives.map(esc).join(", ")}</p>` : ""}

  <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
    <div style="width:280px;">
      <div style="display:flex; justify-content:space-between; padding:4px 8px; font-size:12px;"><span>Montant demandé</span><span>${fmtMontant(d.montantDemande)}</span></div>
      ${d.montantApprouve != null ? `<div style="display:flex; justify-content:space-between; padding:10px 8px; background:#0f172a; color:#fff; border-radius:8px; font-weight:bold; margin-top:6px;"><span>Montant approuvé</span><span>${fmtMontant(d.montantApprouve)} XOF</span></div>` : ""}
    </div>
  </div>
  ${d.motifEcartMontant ? `<p style="font-size:12px; color:#b45309; margin-bottom:16px;"><strong>Écart montant :</strong> ${esc(d.motifEcartMontant)}</p>` : ""}
  ${d.modePaiement ? `<p style="font-size:12px; margin-bottom:16px;"><strong>Paiement :</strong> ${esc(d.modePaiement)}${d.referencePaiement ? ` — réf. ${esc(d.referencePaiement)}` : ""}</p>` : ""}

  ${d.approbateurN1 ? `
  <div style="padding:10px 16px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; margin-bottom:12px; font-size:12px; color:#065f46;">
    <strong>Visa N1</strong> — ${esc(d.approbateurN1.prenom)} ${esc(d.approbateurN1.nom)} le ${formatDateFr(d.dateApprobationN1)}.
  </div>` : ""}
  ${d.approbateurN2 ? `
  <div style="padding:10px 16px; background:#fef9c3; border:1px solid #fde68a; border-radius:8px; margin-bottom:12px; font-size:12px; color:#854d0e;">
    <strong>Visa N2 — Direction Générale</strong> — ${esc(d.approbateurN2.prenom)} ${esc(d.approbateurN2.nom)} le ${formatDateFr(d.dateApprobationN2)}.
  </div>` : ""}
  ${d.executePar ? `
  <div style="padding:10px 16px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:12px; font-size:12px; color:#1e40af;">
    <strong>Payé</strong> — exécuté par ${esc(d.executePar.prenom)} ${esc(d.executePar.nom)} le ${formatDateFr(d.dateExecution)}.
  </div>` : ""}
  ${d.beneficiaireConfirmationNom ? `
  <div style="margin-top:24px;">
    <p style="margin:0; font-weight:bold;">Réception confirmée par le bénéficiaire</p>
    <p style="font-size:12px; color:#059669; margin-top:6px;">${esc(d.beneficiaireConfirmationNom)} — le ${formatDateFr(d.dateConfirmationBeneficiaire)}</p>
  </div>` : ""}

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
