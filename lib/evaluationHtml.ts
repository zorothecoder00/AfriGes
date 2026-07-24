// lib/evaluationHtml.ts
// Fiche d'évaluation imprimable (PDF serveur). Réutilise l'enveloppe société
// de lib/rhDocTemplates/shell.ts.

import { docShell, ligne, blocInfos, signatures, formatDateFr } from "@/lib/rhDocTemplates/shell";

const PERIODE_LABEL: Record<string, string> = {
  ANNUELLE: "Annuelle", SEMESTRIELLE: "Semestrielle", TRIMESTRIELLE: "Trimestrielle", PROBATOIRE: "Probatoire",
};
const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", OBJECTIFS_FIXES: "Objectifs fixés", EN_COURS: "En cours",
  EVALUATION: "Évaluation", VALIDATION: "Validation", PLAN_AMELIORATION: "Plan d'amélioration", CLOTURE: "Clôturée",
};
const TYPE_LABEL: Record<string, string> = {
  HIERARCHIQUE: "Hiérarchique", AUTO_EVALUATION: "Auto-évaluation", EVALUATION_360: "Évaluation 360°",
};

export interface EvaluationHtmlData {
  id: number; periode: string; annee: number; dateDebut: Date | string; dateFin: Date | string | null;
  typeEvaluation: string | null; statut: string; noteGlobale: number | string | null;
  appreciation: string | null; pointsForts: string | null; axesAmelioration: string | null;
  objectifsN1: string | null; planAmelioration: string | null;
  profilRH: { matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
  evaluateur: { nom: string; prenom: string } | null;
  criteres: { libelle: string; note: number | string; commentaire: string | null }[];
  objectifs: { libelle: string; indicateur: string | null; valeurCible: number | string; valeurAtteinte: number | string | null; unite: string | null; poids: number | null }[];
  actionsDeveloppement: { objectif: string; actionPrevue: string | null; echeance: Date | string | null; statut: string }[];
}

const ACTION_STATUT_LABEL: Record<string, string> = {
  A_FAIRE: "À faire", EN_COURS: "En cours", REALISE: "Réalisé", ANNULE: "Annulé",
};

export function genEvaluationHtml(e: EvaluationHtmlData): string {
  const criteresRows = e.criteres.map((c) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${c.libelle}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${c.note}/5</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${c.commentaire ?? ""}</td>
    </tr>`).join("");

  const objectifsRows = e.objectifs.map((o) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${o.libelle}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${o.valeurCible}${o.unite ? ` ${o.unite}` : ""}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${o.valeurAtteinte ?? "—"}${o.valeurAtteinte != null && o.unite ? ` ${o.unite}` : ""}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${o.poids != null ? `${o.poids}%` : "—"}</td>
    </tr>`).join("");

  const actionsRows = e.actionsDeveloppement.map((a) => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${a.objectif}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee;">${a.actionPrevue ?? ""}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${a.echeance ? formatDateFr(a.echeance) : "—"}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${ACTION_STATUT_LABEL[a.statut] ?? a.statut}</td>
    </tr>`).join("");

  const body = `
    ${blocInfos([
      ligne("Collaborateur", `${e.profilRH.prenom} ${e.profilRH.nom}`),
      ligne("Matricule", e.profilRH.matricule),
      ligne("Fonction", e.profilRH.fonction),
      ligne("Département", e.profilRH.departement),
      ligne("Évaluateur", e.evaluateur ? `${e.evaluateur.prenom} ${e.evaluateur.nom}` : null),
      ligne("Période", `${PERIODE_LABEL[e.periode] ?? e.periode} ${e.annee}`),
      ligne("Type", e.typeEvaluation ? TYPE_LABEL[e.typeEvaluation] ?? e.typeEvaluation : null),
      ligne("Statut", STATUT_LABEL[e.statut] ?? e.statut),
      ligne("Note globale", e.noteGlobale != null ? `${e.noteGlobale}/5` : null),
    ].join(""))}

    ${e.criteres.length > 0 ? `
    <h3 style="font-size:14px; margin:24px 0 8px;">Critères d'évaluation</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead><tr style="background:#f1f1f1;">
        <th style="padding:6px 8px; text-align:left;">Critère</th>
        <th style="padding:6px 8px; text-align:center;">Note</th>
        <th style="padding:6px 8px; text-align:left;">Commentaire</th>
      </tr></thead>
      <tbody>${criteresRows}</tbody>
    </table>` : ""}

    ${e.objectifs.length > 0 ? `
    <h3 style="font-size:14px; margin:24px 0 8px;">Objectifs / KPI</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead><tr style="background:#f1f1f1;">
        <th style="padding:6px 8px; text-align:left;">Objectif</th>
        <th style="padding:6px 8px; text-align:center;">Cible</th>
        <th style="padding:6px 8px; text-align:center;">Atteint</th>
        <th style="padding:6px 8px; text-align:center;">Poids</th>
      </tr></thead>
      <tbody>${objectifsRows}</tbody>
    </table>` : ""}

    ${e.pointsForts ? `<h3 style="font-size:14px; margin:24px 0 6px;">Points forts</h3><p style="font-size:13px; white-space:pre-line;">${e.pointsForts}</p>` : ""}
    ${e.axesAmelioration ? `<h3 style="font-size:14px; margin:24px 0 6px;">Axes d'amélioration</h3><p style="font-size:13px; white-space:pre-line;">${e.axesAmelioration}</p>` : ""}
    ${e.appreciation ? `<h3 style="font-size:14px; margin:24px 0 6px;">Appréciation générale</h3><p style="font-size:13px; white-space:pre-line;">${e.appreciation}</p>` : ""}
    ${e.objectifsN1 ? `<h3 style="font-size:14px; margin:24px 0 6px;">Objectifs pour la période N+1</h3><p style="font-size:13px; white-space:pre-line;">${e.objectifsN1}</p>` : ""}
    ${e.planAmelioration ? `<h3 style="font-size:14px; margin:24px 0 6px;">Plan de développement individuel (synthèse)</h3><p style="font-size:13px; white-space:pre-line;">${e.planAmelioration}</p>` : ""}

    ${e.actionsDeveloppement.length > 0 ? `
    <h3 style="font-size:14px; margin:24px 0 8px;">Actions de développement (PDI)</h3>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <thead><tr style="background:#f1f1f1;">
        <th style="padding:6px 8px; text-align:left;">Objectif</th>
        <th style="padding:6px 8px; text-align:left;">Action prévue</th>
        <th style="padding:6px 8px; text-align:center;">Échéance</th>
        <th style="padding:6px 8px; text-align:center;">Statut</th>
      </tr></thead>
      <tbody>${actionsRows}</tbody>
    </table>` : ""}

    ${signatures(
      { role: "Le collaborateur", nom: `${e.profilRH.prenom} ${e.profilRH.nom}` },
      { role: "L'évaluateur", sousTitre: e.evaluateur ? `${e.evaluateur.prenom} ${e.evaluateur.nom}` : undefined }
    )}
  `;

  return docShell({
    titre: "Fiche d'évaluation",
    sousTitre: `${PERIODE_LABEL[e.periode] ?? e.periode} ${e.annee}`,
    refCode: `EVL-${e.id}`,
    confidentiel: true,
    body,
  });
}
