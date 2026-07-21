// lib/rhDocTemplates/embauche.ts
// Documents d'embauche (nature A) : contrats CDI / CDD / stage et avenant.
// Gabarits standard éditables (clauses génériques raisonnables, non OHADA-certifiées).

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, ligne, signatures, formatDateFr } from "./shell";
import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

/** Paragraphe « Article N — Titre » + contenu. */
function art(n: number, titre: string, contenu: string): string {
  return `<p style="line-height:1.8; text-align:justify; margin:10px 0;"><strong>Article ${n} — ${titre}.</strong> ${contenu}</p>`;
}

/** Bloc d'identification des parties (Employeur / Salarié). */
function parties(prenom: string, nom: string, matricule: string, qualiteSalarie: string): string {
  return `
  <p style="line-height:1.8;">Entre les soussignés :</p>
  <p style="line-height:1.8; text-align:justify;">
    <strong>${SOCIETE.nom}</strong>, ${SOCIETE_LEGAL}, dont le siège est sis à ${SOCIETE.adresse},
    représentée par sa Direction, ci-après dénommée « l'Employeur »,
  </p>
  <p style="line-height:1.8;">d'une part,</p>
  <p style="line-height:1.8; text-align:justify;">
    Et <strong>${prenom} ${nom}</strong>, Matricule ${matricule}, ci-après dénommé(e) « ${qualiteSalarie} »,
  </p>
  <p style="line-height:1.8;">d'autre part,</p>
  <p style="line-height:1.8;">Il a été convenu et arrêté ce qui suit :</p>`;
}

/** Ligne « Fait à …, le …, en deux exemplaires originaux. » */
function faitLe(today: Date): string {
  return `<p style="line-height:1.8; margin-top:20px;">Fait à ${SOCIETE.adresse}, le <strong>${formatDateFr(today)}</strong>, en deux (2) exemplaires originaux dont un remis à chaque partie.</p>`;
}

const contratCDI: RhDocTemplate = {
  type: "CONTRAT_CDI",
  label: "Contrat de travail (CDI)",
  refSuffix: "CDI",
  fields: [
    { name: "dateDebut", label: "Date de prise d'effet", type: "date", required: true },
    { name: "salaireBrut", label: "Rémunération brute mensuelle", type: "text", required: true, placeholder: "ex : 250 000 FCFA" },
    { name: "lieuTravail", label: "Lieu de travail", type: "text", placeholder: "ex : Lomé (siège)" },
    { name: "periodeEssai", label: "Durée de la période d'essai", type: "text", placeholder: "ex : 3 mois" },
    { name: "horaire", label: "Horaire hebdomadaire", type: "text", placeholder: "ex : 40 heures" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Contrat de Travail à Durée Indéterminée",
      refCode: refCode(c.matricule, "CDI"),
      body: `
  ${parties(c.prenom, c.nom, c.matricule, "le/la Salarié(e)")}
  ${art(1, "Engagement", `Le/la Salarié(e) est engagé(e)${c.fonction ? ` en qualité de <strong>${c.fonction}</strong>` : ""}${c.departement ? `, au sein du département ${c.departement}` : ""}${c.niveauHierarchique ? `, classification ${c.niveauHierarchique}` : ""}.`)}
  ${art(2, "Prise d'effet et durée", `Le présent contrat prend effet à compter du <strong>${formatDateFr(p.dateDebut)}</strong> pour une <strong>durée indéterminée</strong>.`)}
  ${art(3, "Période d'essai", p.periodeEssai ? `Le contrat débute par une période d'essai de <strong>${p.periodeEssai}</strong>, renouvelable une fois, durant laquelle chacune des parties peut y mettre fin sans indemnité.` : "Le contrat débute par une période d'essai conforme à la réglementation en vigueur.")}
  ${art(4, "Lieu de travail", p.lieuTravail ? `Le/la Salarié(e) exercera ses fonctions à <strong>${p.lieuTravail}</strong>, sous réserve des nécessités de service.` : "Le/la Salarié(e) exercera ses fonctions au lieu indiqué par l'Employeur, sous réserve des nécessités de service.")}
  ${art(5, "Durée du travail", p.horaire ? `La durée hebdomadaire de travail est fixée à <strong>${p.horaire}</strong>.` : "La durée du travail est conforme à la réglementation applicable.")}
  ${art(6, "Rémunération", `En contrepartie de son travail, le/la Salarié(e) percevra une rémunération brute mensuelle de <strong>${p.salaireBrut}</strong>, payable à terme échu.`)}
  ${art(7, "Obligations", "Le/la Salarié(e) s'engage à exécuter ses fonctions avec loyauté, diligence et à respecter le règlement intérieur ainsi que les consignes de confidentialité de l'Employeur.")}
  ${art(8, "Rupture", "Le présent contrat pourra être rompu par l'une ou l'autre des parties dans les conditions et moyennant le préavis prévus par la réglementation du travail en vigueur.")}
  ${faitLe(c.today)}
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const contratCDD: RhDocTemplate = {
  type: "CONTRAT_CDD",
  label: "Contrat de travail (CDD)",
  refSuffix: "CDD",
  fields: [
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin", type: "date", required: true },
    { name: "motif", label: "Motif du recours au CDD", type: "textarea", required: true, placeholder: "ex : accroissement temporaire d'activité, remplacement…" },
    { name: "salaireBrut", label: "Rémunération brute mensuelle", type: "text", required: true, placeholder: "ex : 200 000 FCFA" },
    { name: "lieuTravail", label: "Lieu de travail", type: "text", placeholder: "ex : Lomé (siège)" },
    { name: "periodeEssai", label: "Durée de la période d'essai", type: "text", placeholder: "ex : 1 mois" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Contrat de Travail à Durée Déterminée",
      refCode: refCode(c.matricule, "CDD"),
      body: `
  ${parties(c.prenom, c.nom, c.matricule, "le/la Salarié(e)")}
  ${art(1, "Engagement et objet", `Le/la Salarié(e) est engagé(e)${c.fonction ? ` en qualité de <strong>${c.fonction}</strong>` : ""} au titre de : <em>${p.motif}</em>.`)}
  ${art(2, "Durée", `Le présent contrat est conclu pour une durée déterminée, du <strong>${formatDateFr(p.dateDebut)}</strong> au <strong>${formatDateFr(p.dateFin)}</strong>. Il prendra fin de plein droit à son terme.`)}
  ${art(3, "Période d'essai", p.periodeEssai ? `Le contrat comporte une période d'essai de <strong>${p.periodeEssai}</strong>.` : "Le contrat comporte une période d'essai conforme à la réglementation en vigueur.")}
  ${art(4, "Lieu de travail", p.lieuTravail ? `Le/la Salarié(e) exercera ses fonctions à <strong>${p.lieuTravail}</strong>.` : "Le/la Salarié(e) exercera ses fonctions au lieu indiqué par l'Employeur.")}
  ${art(5, "Rémunération", `Le/la Salarié(e) percevra une rémunération brute mensuelle de <strong>${p.salaireBrut}</strong>, payable à terme échu.`)}
  ${art(6, "Obligations", "Le/la Salarié(e) s'engage à respecter le règlement intérieur et les obligations de confidentialité de l'Employeur.")}
  ${faitLe(c.today)}
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const contratStage: RhDocTemplate = {
  type: "CONTRAT_STAGE",
  label: "Contrat de stage",
  refSuffix: "STG",
  fields: [
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin", type: "date", required: true },
    { name: "objetStage", label: "Objet / missions du stage", type: "textarea", required: true, placeholder: "Missions confiées au stagiaire" },
    { name: "ecole", label: "Établissement de formation", type: "text", placeholder: "École / université" },
    { name: "tuteur", label: "Tuteur / encadrant", type: "text", placeholder: "Nom de l'encadrant" },
    { name: "gratification", label: "Gratification mensuelle", type: "text", placeholder: "ex : 50 000 FCFA (facultatif)" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Convention de Stage",
      refCode: refCode(c.matricule, "STG"),
      body: `
  ${parties(c.prenom, c.nom, c.matricule, "le/la Stagiaire")}
  ${art(1, "Objet", `La présente convention a pour objet d'accueillir le/la Stagiaire${p.ecole ? `, inscrit(e) à <strong>${p.ecole}</strong>,` : ""} afin d'effectuer un stage pratique portant sur : <em>${p.objetStage}</em>.`)}
  ${art(2, "Durée", `Le stage se déroule du <strong>${formatDateFr(p.dateDebut)}</strong> au <strong>${formatDateFr(p.dateFin)}</strong>.`)}
  ${art(3, "Encadrement", p.tuteur ? `Le/la Stagiaire est placé(e) sous la responsabilité de <strong>${p.tuteur}</strong>, tuteur de stage.` : "Le/la Stagiaire est placé(e) sous la responsabilité d'un tuteur désigné par l'Employeur.")}
  ${art(4, "Gratification", p.gratification ? `Le/la Stagiaire percevra une gratification mensuelle de <strong>${p.gratification}</strong>.` : "Le stage ne donne pas lieu à rémunération, sauf gratification éventuelle décidée par l'Employeur.")}
  ${art(5, "Obligations", "Le/la Stagiaire s'engage à respecter le règlement intérieur, les horaires et les règles de confidentialité de l'Employeur. Ce stage ne constitue pas un contrat de travail.")}
  ${faitLe(c.today)}
  ${signatures({ role: "Le/la Stagiaire", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const avenantContrat: RhDocTemplate = {
  type: "AVENANT_CONTRAT",
  label: "Avenant au contrat",
  refSuffix: "AVE",
  fields: [
    { name: "objetAvenant", label: "Objet de la modification", type: "textarea", required: true, placeholder: "ex : révision de la rémunération, changement de poste…" },
    { name: "dateEffet", label: "Date de prise d'effet", type: "date", required: true },
    { name: "nouvelleClause", label: "Nouvelle clause / nouvelles conditions", type: "textarea", required: true, placeholder: "Texte de la clause modifiée" },
    { name: "ancienneClause", label: "Clause initiale (facultatif)", type: "textarea", placeholder: "Texte remplacé" },
  ],
  render: (c, p) => {
    const contratOrigine = c.typeContrat
      ? `contrat de travail (${c.typeContrat})${c.dateEmbauche ? ` conclu le ${formatDateFr(c.dateEmbauche)}` : ""}`
      : "contrat de travail initial";
    return docShell({
      titre: "Avenant au Contrat de Travail",
      refCode: refCode(c.matricule, "AVE"),
      body: `
  <div style="margin-bottom:20px;">
    ${ligne("Salarié(e)", `${c.prenom} ${c.nom} (${c.matricule})`)}
    ${ligne("Fonction", c.fonction)}
    ${ligne("Contrat concerné", contratOrigine)}
  </div>
  <p style="line-height:1.8; text-align:justify;">
    Le présent avenant a pour objet de modifier le ${contratOrigine} liant les parties, sur le point suivant :
    <strong>${p.objetAvenant}</strong>.
  </p>
  ${p.ancienneClause ? art(1, "Disposition initiale", `<em>${p.ancienneClause}</em>`) : ""}
  ${art(p.ancienneClause ? 2 : 1, "Nouvelle disposition", `${p.nouvelleClause}`)}
  ${art(p.ancienneClause ? 3 : 2, "Prise d'effet", `La présente modification prend effet à compter du <strong>${formatDateFr(p.dateEffet)}</strong>.`)}
  ${art(p.ancienneClause ? 4 : 3, "Autres clauses", "Toutes les autres clauses du contrat initial demeurent inchangées et continuent de produire leurs effets.")}
  ${faitLe(c.today)}
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    });
  },
};

export const templatesEmbauche: RhDocTemplate[] = [
  contratCDI,
  contratCDD,
  contratStage,
  avenantContrat,
];
