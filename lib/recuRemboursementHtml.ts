// lib/recuRemboursementHtml.ts
// Reçu de remboursement de crédit (CDC digitalisation §5.4) — un reçu par
// versement encaissé, complémentaire au Bordereau de remboursement (qui
// couvre l'échéancier complet). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  WALLET_GENERAL: "Compte courant — solde général",
  WALLET_TONTINE: "Compte courant — épargne tontine",
  WALLET_CREDIT: "Compte courant — réservé crédit",
  EXTERNE: "Paiement externe",
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

export interface RecuRemboursementHtmlData {
  numeroRecu: string;
  creditReference: string;
  client: { nom: string; prenom: string; codeClient: string | null; telephone: string | null };
  montant: number;
  dateRemboursement: Date | string;
  modePaiement: string;
  numeroJour: number | null;
  notes: string | null;
  soldeRestant: number;
  collectePar: { nom: string; prenom: string };
  qrDataUrl?: string | null;
}

export function genRecuRemboursementHtml(d: RecuRemboursementHtmlData): string {
  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:640px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Reçu de remboursement</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.numeroRecu)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">Crédit ${esc(d.creditReference)}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:20px;">
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Client</p>
    <p style="margin:0; font-weight:bold;">${esc(d.client.prenom)} ${esc(d.client.nom)}${d.client.codeClient ? ` (${esc(d.client.codeClient)})` : ""}</p>
    ${d.client.telephone ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.client.telephone)}</p>` : ""}
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead><tr style="background:#0f172a; color:#fff;"><th colspan="2" style="padding:8px; text-align:left;">Versement encaissé</th></tr></thead>
    <tbody>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Montant reçu</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${fmtMontant(d.montant)} XOF</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Date de collecte</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${formatDateFr(d.dateRemboursement)}</td></tr>
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Mode de paiement</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${MODE_LABEL[d.modePaiement] ?? esc(d.modePaiement)}</td></tr>
      ${d.numeroJour ? `<tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Jour de l'échéancier</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">Jour ${d.numeroJour}</td></tr>` : ""}
      <tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Collecté par</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${esc(d.collectePar.prenom)} ${esc(d.collectePar.nom)}</td></tr>
      ${d.notes ? `<tr><td style="padding:6px 8px; border-bottom:1px solid #eee;">Observation</td><td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:right;">${esc(d.notes)}</td></tr>` : ""}
    </tbody>
  </table>

  <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
    <div style="width:280px; padding:10px 16px; background:#0f172a; color:#fff; border-radius:8px; display:flex; justify-content:space-between;">
      <span style="font-weight:bold;">Solde restant dû</span>
      <span style="font-weight:bold;">${fmtMontant(d.soldeRestant)} XOF</span>
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:32px;">
    <tr>
      ${["Client", "Agent / Caissier"].map((r) => `
        <td style="width:50%; text-align:center; padding:0 12px; vertical-align:top;">
          <div style="border-top:1px solid #333; margin-top:34px; padding-top:6px; color:#555;">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.numeroRecu)}
  </p>
</div>`.trim();
}
