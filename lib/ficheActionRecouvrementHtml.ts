// lib/ficheActionRecouvrementHtml.ts
// Fiche d'action de recouvrement (CDC digitalisation §5.4) — couvre les deux
// documents formels du CDC (Mise en demeure, Fiche de visite de
// recouvrement) et un compte-rendu générique pour les autres types d'action
// (appel, note, accord, saisie). Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const LABEL_TYPE_ACTION: Record<string, string> = {
  APPEL_TELEPHONIQUE: "Appel téléphonique",
  VISITE_TERRAIN: "Visite de recouvrement",
  MISE_EN_DEMEURE: "Mise en demeure",
  ACCORD_ECHEANCIER: "Accord sur échéancier",
  SAISIE_GARANTIE: "Saisie de garantie",
  NOTE_INTERNE: "Note interne",
};
const STATUT_LABEL: Record<string, string> = { EN_COURS: "En cours", RESOLU: "Résolu", SANS_SUITE: "Sans suite" };

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
function formatDateHeureFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export interface FicheActionRecouvrementHtmlData {
  numeroDocument: string;
  type: string;
  statut: string;
  notes: string | null;
  resultat: string | null;
  delaiRegularisationJours: number | null;
  lieuVisite: string | null;
  personneRencontree: string | null;
  effectuePar: { nom: string; prenom: string } | null;
  dateAction: Date | string;
  dateRelance: Date | string | null;
  creditReference: string;
  soldeRestant: number;
  client: { nom: string; prenom: string; codeClient: string | null; telephone: string | null; adresse?: string | null };
  qrDataUrl?: string | null;
}

export function genFicheActionRecouvrementHtml(d: FicheActionRecouvrementHtmlData): string {
  const isMED = d.type === "MISE_EN_DEMEURE";
  const isVisite = d.type === "VISITE_TERRAIN";
  const titre = isMED ? "MISE EN DEMEURE" : isVisite ? "FICHE DE VISITE DE RECOUVREMENT" : (LABEL_TYPE_ACTION[d.type] ?? d.type);
  const clientNomComplet = `${d.client.prenom} ${d.client.nom}`;
  const delai = d.delaiRegularisationJours ?? 8;
  const dateLimite = new Date(new Date(d.dateAction).getTime() + delai * 86_400_000);

  const corpsMED = `
    <p style="margin:14px 0; line-height:1.7; text-align:justify;">
      Madame, Monsieur <strong>${esc(clientNomComplet)}</strong>,
    </p>
    <p style="margin:0 0 10px; line-height:1.7; text-align:justify;">
      Malgré nos relances, votre compte crédit <strong>${esc(d.creditReference)}</strong> présente à ce jour un
      solde impayé de <strong>${fmtMontant(d.soldeRestant)} XOF</strong>. Par la présente, nous vous mettons en
      demeure de régulariser l'intégralité de cette somme dans un délai de <strong>${delai} jour(s)</strong>, soit
      au plus tard le <strong>${formatDateFr(dateLimite)}</strong>.
    </p>
    <p style="margin:0 0 10px; line-height:1.7; text-align:justify;">
      À défaut de règlement dans ce délai, ${esc(SOCIETE.nom)} se réserve le droit d'engager toute action de
      recouvrement complémentaire, y compris la mobilisation des garanties associées à ce crédit et/ou une
      procédure contentieuse, sans préjudice des pénalités de retard déjà applicables.
    </p>
    ${d.notes ? `<p style="margin:0 0 10px; line-height:1.6; text-align:justify; font-style:italic;">${esc(d.notes)}</p>` : ""}
  `;

  const corpsVisite = `
    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; background:#f1f5f9; padding:6px 10px; border-left:3px solid #0f172a; margin:16px 0 8px;">Constat de la visite</h2>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b; width:40%;">Lieu de la visite</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${esc(d.lieuVisite ?? "—")}</td></tr>
      <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Personne rencontrée</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${esc(d.personneRencontree ?? "—")}</td></tr>
      <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Date / heure</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${formatDateHeureFr(d.dateAction)}</td></tr>
    </table>
    ${d.notes ? `<p style="margin:10px 0; line-height:1.5; text-align:justify; font-size:12px;"><strong>Constat :</strong> ${esc(d.notes)}</p>` : ""}
    ${d.resultat ? `<p style="margin:0 0 10px; line-height:1.5; text-align:justify; font-size:12px;"><strong>Engagement / résultat :</strong> ${esc(d.resultat)}</p>` : ""}
    ${d.dateRelance ? `<p style="font-size:12px;"><strong>Prochaine relance prévue :</strong> ${formatDateFr(d.dateRelance)}</p>` : ""}
  `;

  const corpsGenerique = `
    <h2 style="font-size:12px; font-weight:800; text-transform:uppercase; background:#f1f5f9; padding:6px 10px; border-left:3px solid #0f172a; margin:16px 0 8px;">Compte-rendu</h2>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b; width:40%;">Statut</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${STATUT_LABEL[d.statut] ?? esc(d.statut)}</td></tr>
      ${d.notes ? `<tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Notes</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${esc(d.notes)}</td></tr>` : ""}
      ${d.resultat ? `<tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Résultat</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${esc(d.resultat)}</td></tr>` : ""}
      ${d.dateRelance ? `<tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Relance prévue</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${formatDateFr(d.dateRelance)}</td></tr>` : ""}
    </table>
  `;

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:20px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:17px; font-weight:bold; margin:0; text-transform:uppercase; color:${isMED ? "#dc2626" : "#0f172a"};">${titre}</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.numeroDocument)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">Crédit ${esc(d.creditReference)}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px;">
    <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b; width:40%;">Date</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${formatDateFr(new Date())}</td></tr>
    <tr><td style="padding:5px 10px; border:1px solid #e2e8f0; color:#64748b;">Émis par</td><td style="padding:5px 10px; border:1px solid #e2e8f0; font-weight:600;">${esc(d.effectuePar ? `${d.effectuePar.prenom} ${d.effectuePar.nom}` : "—")}</td></tr>
  </table>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:16px;">
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Client</p>
    <p style="margin:0; font-weight:bold;">${esc(clientNomComplet)}${d.client.codeClient ? ` (${esc(d.client.codeClient)})` : ""}</p>
    ${d.client.telephone ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.client.telephone)}</p>` : ""}
    ${d.client.adresse ? `<p style="margin:2px 0 0; font-size:12px;">${esc(d.client.adresse)}</p>` : ""}
  </div>

  ${isMED ? corpsMED : isVisite ? corpsVisite : corpsGenerique}

  <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:32px;">
    <tr>
      ${(isMED ? ["Responsable Vente Crédit", "Direction"] : ["Agent recouvrement", "Client (le cas échéant)"]).map((r) => `
        <td style="width:50%; text-align:center; padding:0 12px; vertical-align:top;">
          <div style="border-top:1px solid #333; margin-top:34px; padding-top:6px; color:#555;">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.numeroDocument)}
  </p>
</div>`.trim();
}
