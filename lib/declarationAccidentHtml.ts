// lib/declarationAccidentHtml.ts
// Déclaration / rapport d'accident du travail, imprimable (PDF serveur).
// Réutilise l'enveloppe société de lib/rhDocTemplates/shell.ts.

import { docShell, ligne, blocInfos, signatures, formatDateFr } from "@/lib/rhDocTemplates/shell";

const GRAVITE_LABEL: Record<string, string> = {
  LEGER: "Léger", MODERE: "Modéré", GRAVE: "Grave", MORTEL: "Mortel",
};
const STATUT_LABEL: Record<string, string> = {
  DECLARE: "Déclaré", EN_INSTRUCTION: "En instruction", CLOTURE: "Clôturé", ANNULE: "Annulé",
};

export interface DeclarationAccidentData {
  id: number; dateAccident: Date | string; heureAccident: string | null; lieu: string;
  circonstances: string; natureLesion: string | null; gravite: string;
  arretTravail: boolean; dureeArretJours: number | null; temoin: string | null;
  mesuresCorrectives: string | null; notes: string | null; statut: string;
  profilRH: { matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
  declarePar: { nom: string; prenom: string } | null;
}

export function genDeclarationAccidentHtml(a: DeclarationAccidentData): string {
  const body = `
    ${blocInfos([
      ligne("Collaborateur accidenté", `${a.profilRH.prenom} ${a.profilRH.nom}`),
      ligne("Matricule", a.profilRH.matricule),
      ligne("Fonction", a.profilRH.fonction),
      ligne("Département", a.profilRH.departement),
      ligne("Date de l'accident", formatDateFr(a.dateAccident)),
      ligne("Heure", a.heureAccident),
      ligne("Lieu", a.lieu),
      ligne("Gravité", GRAVITE_LABEL[a.gravite] ?? a.gravite),
      ligne("Arrêt de travail", a.arretTravail ? `Oui — ${a.dureeArretJours ?? "?"} jour(s)` : "Non"),
      ligne("Témoin(s)", a.temoin),
      ligne("Statut du dossier", STATUT_LABEL[a.statut] ?? a.statut),
    ].join(""))}

    <h3 style="font-size:14px; margin:24px 0 6px;">Circonstances de l'accident</h3>
    <p style="font-size:13px; white-space:pre-line; text-align:justify;">${a.circonstances}</p>

    ${a.natureLesion ? `<h3 style="font-size:14px; margin:24px 0 6px;">Nature de la lésion</h3><p style="font-size:13px; white-space:pre-line;">${a.natureLesion}</p>` : ""}
    ${a.mesuresCorrectives ? `<h3 style="font-size:14px; margin:24px 0 6px;">Mesures correctives</h3><p style="font-size:13px; white-space:pre-line;">${a.mesuresCorrectives}</p>` : ""}
    ${a.notes ? `<h3 style="font-size:14px; margin:24px 0 6px;">Notes complémentaires</h3><p style="font-size:13px; white-space:pre-line;">${a.notes}</p>` : ""}

    ${signatures(
      { role: "Le déclarant", nom: a.declarePar ? `${a.declarePar.prenom} ${a.declarePar.nom}` : undefined },
      { role: "Responsable Santé & Sécurité" }
    )}
  `;

  return docShell({
    titre: "Déclaration d'accident du travail",
    sousTitre: `Réf. AT-${a.id}`,
    refCode: `AT-${a.id}`,
    confidentiel: true,
    body,
  });
}
