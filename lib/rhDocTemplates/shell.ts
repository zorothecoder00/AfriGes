// lib/rhDocTemplates/shell.ts
// Enveloppe HTML commune à tous les documents RH générés : en-tête société,
// titre, corps, pied légal + référence. Source d'identité unique : lib/societe.ts
// (RCCM/NIF/nom propagés partout — cf. mémoire « identité société centralisée »).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

/** Date longue en français, ou une ligne à compléter si absente. */
export function formatDateFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

/** Ligne « Label : valeur », omise si la valeur est vide. */
export function ligne(label: string, value?: string | null): string {
  if (value == null || value === "") return "";
  return `<p style="margin:4px 0;"><strong>${label} :</strong> ${value}</p>`;
}

/** Bloc encadré (gris, filet à gauche) regroupant des lignes d'infos. */
export function blocInfos(rowsHtml: string): string {
  return `<div style="margin:24px 0; padding:20px 28px; background:#f8f8f8; border-left:4px solid #1a1a1a;">${rowsHtml}</div>`;
}

/** Deux zones de signature côte à côte (gauche = intéressé, droite = direction). */
export function signatures(gauche: { role: string; sousTitre?: string; nom?: string }, droite: { role: string; sousTitre?: string }): string {
  return `
  <div style="margin-top:48px; display:flex; justify-content:space-between; gap:24px;">
    <div>
      <p style="margin:0; font-weight:bold;">${gauche.role}</p>
      ${gauche.sousTitre ? `<p style="font-size:12px; color:#555; margin-top:4px;">${gauche.sousTitre}</p>` : ""}
      <div style="margin-top:50px; border-top:1px solid #aaa; width:170px;"></div>
      ${gauche.nom ? `<p style="margin-top:4px; font-size:12px;">${gauche.nom}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <p style="margin:0; font-weight:bold; text-transform:uppercase;">${droite.role}</p>
      ${droite.sousTitre ? `<p style="font-size:12px; color:#555; margin-top:4px;">${droite.sousTitre}</p>` : ""}
      <div style="margin-top:50px; border-top:1px solid #aaa; width:170px; margin-left:auto;"></div>
    </div>
  </div>`;
}

/**
 * Enveloppe complète d'un document : en-tête société → titre → corps → pied légal.
 * `body` est le HTML métier du document (paragraphes, blocs, signatures).
 */
export function docShell(opts: { titre: string; refCode: string; body: string; sousTitre?: string; confidentiel?: boolean }): string {
  const { titre, refCode, body, sousTitre, confidentiel } = opts;
  return `
<div style="font-family:'Times New Roman', serif; max-width:680px; margin:0 auto; padding:40px; color:#1a1a1a;">
  <div style="text-align:center; margin-bottom:32px;">
    <p style="font-size:13px; color:#555; text-transform:uppercase; letter-spacing:2px; margin:0;">${SOCIETE.nom} — Direction des Ressources Humaines</p>
    <h1 style="font-size:22px; font-weight:bold; text-transform:uppercase; margin:10px 0 6px;">${titre}</h1>
    ${sousTitre ? `<p style="font-size:13px; color:#555; margin:0 0 6px;">${sousTitre}</p>` : ""}
    <div style="width:60px; height:3px; background:#1a1a1a; margin:0 auto;"></div>
  </div>
  ${body}
  <hr style="margin-top:48px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:11px; color:#999; text-align:center; margin:6px 0 0;">
    ${confidentiel ? "Document officiel · Confidentiel · " : ""}${SOCIETE.nom} · ${SOCIETE_LEGAL} · Réf. ${refCode}
  </p>
</div>`.trim();
}
