// lib/attestationSoldeHtml.ts
// Attestation de solde / quittance finale (CDC digitalisation §5.4) — certifie
// qu'un client a intégralement soldé son crédit. Même convention que
// lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

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

export interface AttestationSoldeHtmlData {
  reference: string;
  client: { nom: string; prenom: string; codeClient: string | null; telephone: string | null };
  montantTotal: number;
  dateDebut: Date | string;
  dateSolde: Date | string | null;
  gestionnaire: { nom: string; prenom: string } | null;
  qrDataUrl?: string | null;
}

export function genAttestationSoldeHtml(d: AttestationSoldeHtmlData): string {
  const clientNomComplet = `${d.client.prenom} ${d.client.nom}`;

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Attestation de solde</h2>
      <p style="font-size:11px; color:#888; margin:2px 0 0;">Quittance finale</p>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <p style="line-height:1.8; text-align:justify;">
    Nous soussignés, <strong>${esc(SOCIETE.nom)}</strong>, certifions par la présente que
    <strong>${esc(clientNomComplet)}</strong>${d.client.codeClient ? ` (code client ${esc(d.client.codeClient)})` : ""}
    ${d.client.telephone ? `, joignable au ${esc(d.client.telephone)},` : ""}
    a intégralement soldé le crédit référencé <strong>${esc(d.reference)}</strong>, d'un montant total de
    <strong>${fmtMontant(d.montantTotal)} XOF</strong>, octroyé le ${formatDateFr(d.dateDebut)}.
  </p>

  <p style="line-height:1.8; text-align:justify;">
    Le solde de ce crédit a été ramené à zéro le <strong>${formatDateFr(d.dateSolde)}</strong>. Aucune somme
    ne reste due par le client au titre de ce crédit à la date d'émission de la présente attestation.
  </p>

  <p style="line-height:1.8; text-align:justify; margin-top:24px;">
    Cette attestation est délivrée au client pour servir et valoir ce que de droit.
  </p>

  <div style="display:flex; justify-content:space-between; margin-top:56px;">
    <div style="text-align:center; width:45%;">
      <div style="border-top:1px solid #333; padding-top:6px; font-size:11px; color:#555;">
        ${d.gestionnaire ? esc(`${d.gestionnaire.prenom} ${d.gestionnaire.nom}`) : "Responsable Vente Crédit"}
      </div>
    </div>
    <div style="text-align:center; width:45%;">
      <div style="border-top:1px solid #333; padding-top:6px; font-size:11px; color:#555;">
        Direction
      </div>
    </div>
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Fait le ${formatDateFr(new Date())} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}
