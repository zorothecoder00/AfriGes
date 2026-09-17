// lib/avisEcheanceHtml.ts
// Avis d'échéance / Avis de retard (CDC digitalisation §5.4) — même document
// pour les deux variantes ("ECHEANCE" avant la date, "RETARD" après), seul le
// ton du texte change. Même convention que lib/bordereauRemiseHtml.ts.

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

export interface EcheanceAvisHtml { numeroEcheance: number; dateEcheance: Date | string; montantDu: number; montantPaye: number; joursRetard: number }

export interface AvisEcheanceHtmlData {
  numeroAvis: string;
  variante: "ECHEANCE" | "RETARD";
  creditReference: string;
  client: { nom: string; prenom: string; codeClient: string | null; telephone: string | null };
  echeances: EcheanceAvisHtml[];
  qrDataUrl?: string | null;
}

export function genAvisEcheanceHtml(d: AvisEcheanceHtmlData): string {
  const retard = d.variante === "RETARD";
  const totalDu = d.echeances.reduce((s, e) => s + (e.montantDu - e.montantPaye), 0);
  const plusAncienne = d.echeances.reduce((max, e) => Math.max(max, e.joursRetard), 0);

  const texte = retard
    ? `Nous constatons à ce jour un retard de paiement sur votre crédit ${esc(d.creditReference)}. Le tableau ci-dessous récapitule les échéances actuellement impayées. Nous vous invitons à régulariser votre situation dans les meilleurs délais afin d'éviter l'application de pénalités de retard et l'engagement d'une procédure de recouvrement.`
    : `Nous vous rappelons que la ou les échéances suivantes de votre crédit ${esc(d.creditReference)} arrivent prochainement à échéance. Merci de bien vouloir tenir votre paiement à disposition de votre agent ou du point de vente à la date prévue.`;

  const rows = d.echeances.map((e) => `<tr>
    <td style="padding:4px 8px;border:1px solid #eee;text-align:center">${e.numeroEcheance}</td>
    <td style="padding:4px 8px;border:1px solid #eee">${formatDateFr(e.dateEcheance)}</td>
    <td style="padding:4px 8px;border:1px solid #eee;text-align:right">${fmtMontant(e.montantDu)}</td>
    <td style="padding:4px 8px;border:1px solid #eee;text-align:right">${fmtMontant(e.montantDu - e.montantPaye)}</td>
    ${retard ? `<td style="padding:4px 8px;border:1px solid #eee;text-align:center;color:#dc2626;font-weight:600">${e.joursRetard} j</td>` : ""}
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
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase; color:${retard ? "#dc2626" : "#0f172a"};">${retard ? "Avis de retard de paiement" : "Avis d'échéance"}</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.numeroAvis)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">Crédit ${esc(d.creditReference)}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:16px;">
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Client</p>
    <p style="margin:0; font-weight:bold;">${esc(d.client.prenom)} ${esc(d.client.nom)}${d.client.codeClient ? ` (${esc(d.client.codeClient)})` : ""}</p>
    ${d.client.telephone ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.client.telephone)}</p>` : ""}
  </div>

  <p style="margin:16px 0; line-height:1.6; text-align:justify; ${retard ? "background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:6px;" : ""}">${texte}</p>

  <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:8px;">
    <thead><tr style="background:#0f172a; color:#fff;">
      <th style="padding:6px 8px;">Échéance</th><th style="padding:6px 8px;">Date</th>
      <th style="padding:6px 8px;">Montant dû</th><th style="padding:6px 8px;">Restant</th>
      ${retard ? `<th style="padding:6px 8px;">Retard</th>` : ""}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="display:flex; justify-content:flex-end; margin-top:16px; gap:12px;">
    <div style="padding:10px 16px; background:${retard ? "#dc2626" : "#0f172a"}; color:#fff; border-radius:8px; text-align:right;">
      <div style="font-size:11px; opacity:.85;">Total dû sur les échéances ci-dessus</div>
      <div style="font-weight:bold; font-size:15px;">${fmtMontant(totalDu)} XOF</div>
    </div>
    ${retard ? `<div style="padding:10px 16px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; text-align:right;">
      <div style="font-size:11px; color:#b91c1c;">Retard le plus ancien</div>
      <div style="font-weight:bold; font-size:15px; color:#b91c1c;">${plusAncienne} jour(s)</div>
    </div>` : ""}
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.numeroAvis)}
  </p>
</div>`.trim();
}
