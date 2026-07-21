// lib/rhDocTemplates/discipline.ts
// Documents disciplinaires (nature A), rattachés au collaborateur (ProfilRH).
// Gabarits standard éditables. Tous confidentiels.

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";

const enTete = (c: { prenom: string; nom: string; matricule: string; fonction?: string | null; departement?: string | null }) =>
  blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction) +
    ligne("Département", c.departement),
  );

const signatureRH = (today: Date) => `
  <div style="margin-top:44px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(today)}</strong></p>
    <div style="margin-top:52px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction des Ressources Humaines</p></div>
  </div>`;

// ── Avertissement écrit ───────────────────────────────────────────────────────
const avertissementEcrit: RhDocTemplate = {
  type: "AVERTISSEMENT_ECRIT",
  label: "Avertissement écrit",
  refSuffix: "AVT",
  fields: [
    { name: "faits", label: "Faits reprochés", type: "textarea", required: true, placeholder: "Description précise des faits" },
    { name: "dateFaits", label: "Date des faits", type: "date" },
    { name: "rappel", label: "Rappel / mise en garde", type: "textarea", placeholder: "Attentes et conséquences en cas de récidive" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Avertissement",
      refCode: refCode(c.matricule, "AVT"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Nous sommes au regret de vous notifier un avertissement pour les faits suivants${p.dateFaits ? `, survenus le <strong>${formatDateFr(p.dateFaits)}</strong>` : ""} :
  </p>
  <p style="line-height:1.8; text-align:justify;"><em>${p.faits}</em></p>
  <p style="line-height:1.8; text-align:justify;">
    ${p.rappel ? p.rappel : "Nous vous invitons à vous conformer strictement à vos obligations professionnelles et au règlement intérieur."}
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Le présent avertissement est versé à votre dossier. Une réitération de tels faits pourrait donner lieu à des sanctions plus lourdes.
  </p>
  ${signatures({ role: "L'Intéressé(e)", sousTitre: "(Reçu notification)", nom: `${c.prenom} ${c.nom}` }, { role: "La Direction des Ressources Humaines" })}`,
    }),
};

// ── Mise en demeure ───────────────────────────────────────────────────────────
const miseEnDemeure: RhDocTemplate = {
  type: "MISE_EN_DEMEURE",
  label: "Mise en demeure",
  refSuffix: "MED",
  fields: [
    { name: "objet", label: "Objet", type: "text", required: true, placeholder: "ex : abandon de poste, non-respect des consignes" },
    { name: "faits", label: "Faits / manquements", type: "textarea", required: true },
    { name: "delai", label: "Délai imparti", type: "text", placeholder: "ex : 48 heures" },
    { name: "consequences", label: "Conséquences en cas de manquement", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Mise en Demeure",
      sousTitre: p.objet,
      refCode: refCode(c.matricule, "MED"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Nous constatons les manquements suivants : <em>${p.faits}</em>.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Par la présente, nous vous mettons en demeure de régulariser votre situation
    ${p.delai ? `dans un délai de <strong>${p.delai}</strong>` : "sans délai"} à compter de la réception de ce courrier.
  </p>
  ${p.consequences ? `<p style="line-height:1.8; text-align:justify;">${p.consequences}</p>` : `<p style="line-height:1.8; text-align:justify;">À défaut, nous nous réservons le droit d'engager la procédure disciplinaire appropriée.</p>`}
  ${signatureRH(c.today)}`,
    }),
};

// ── Demande d'explication ─────────────────────────────────────────────────────
const demandeExplication: RhDocTemplate = {
  type: "DEMANDE_EXPLICATION",
  label: "Demande d'explication",
  refSuffix: "DEX",
  fields: [
    { name: "faits", label: "Faits concernés", type: "textarea", required: true },
    { name: "dateFaits", label: "Date des faits", type: "date" },
    { name: "delaiReponse", label: "Délai de réponse", type: "text", placeholder: "ex : 72 heures" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Demande d'Explication",
      refCode: refCode(c.matricule, "DEX"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Nous avons constaté les faits suivants${p.dateFaits ? ` en date du <strong>${formatDateFr(p.dateFaits)}</strong>` : ""} : <em>${p.faits}</em>.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Avant toute décision, nous vous invitons à nous fournir vos explications écrites
    ${p.delaiReponse ? `dans un délai de <strong>${p.delaiReponse}</strong>` : "dans les meilleurs délais"}.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    À défaut de réponse dans le délai imparti, nous serons amenés à statuer au vu des seuls éléments en notre possession.
  </p>
  ${signatureRH(c.today)}`,
    }),
};

// ── Convocation disciplinaire ─────────────────────────────────────────────────
const convocationDisciplinaire: RhDocTemplate = {
  type: "CONVOCATION_DISCIPLINAIRE",
  label: "Convocation disciplinaire",
  refSuffix: "CVD",
  fields: [
    { name: "dateEntretien", label: "Date de l'entretien", type: "date", required: true },
    { name: "heure", label: "Heure", type: "text", placeholder: "ex : 10h00" },
    { name: "lieu", label: "Lieu", type: "text", placeholder: "ex : Bureau RH, siège" },
    { name: "objet", label: "Motif de la convocation", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Convocation à un Entretien Préalable",
      refCode: refCode(c.matricule, "CVD"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Nous vous convoquons à un entretien préalable dans le cadre d'une procédure disciplinaire
    ${p.objet ? `concernant : <em>${p.objet}</em>` : ""}.
  </p>
  ${blocInfos(
    ligne("Date", formatDateFr(p.dateEntretien)) +
    ligne("Heure", p.heure) +
    ligne("Lieu", p.lieu),
  )}
  <p style="line-height:1.8; text-align:justify;">
    Vous avez la possibilité de vous faire assister par une personne de votre choix appartenant au personnel de l'entreprise.
    Cet entretien n'est pas une sanction : il vise à recueillir vos explications avant toute décision.
  </p>
  ${signatureRH(c.today)}`,
    }),
};

// ── Procès-verbal d'audition ──────────────────────────────────────────────────
const pvAudition: RhDocTemplate = {
  type: "PV_AUDITION",
  label: "Procès-verbal d'audition",
  refSuffix: "PVA",
  fields: [
    { name: "dateAudition", label: "Date de l'audition", type: "date", required: true },
    { name: "faits", label: "Faits examinés", type: "textarea", required: true },
    { name: "declarations", label: "Déclarations de l'intéressé(e)", type: "textarea" },
    { name: "presents", label: "Personnes présentes", type: "textarea", placeholder: "Une par ligne" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Procès-Verbal d'Audition",
      refCode: refCode(c.matricule, "PVA"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8; text-align:justify;">
    L'an <strong>${new Date(p.dateAudition ?? c.today).getFullYear()}</strong>, le <strong>${formatDateFr(p.dateAudition)}</strong>,
    s'est tenue l'audition de l'intéressé(e) dans le cadre d'une procédure disciplinaire.
  </p>
  ${p.presents ? blocInfos(`<p style="margin:0;"><strong>Personnes présentes :</strong></p><p style="margin:6px 0 0; white-space:pre-line;">${p.presents}</p>`) : ""}
  <p style="line-height:1.8; text-align:justify;"><strong>Faits examinés.</strong> ${p.faits}</p>
  ${p.declarations ? `<p style="line-height:1.8; text-align:justify;"><strong>Déclarations de l'intéressé(e).</strong> <em>${p.declarations}</em></p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    Lecture faite, le présent procès-verbal est signé par les parties.
  </p>
  ${signatures({ role: "L'Intéressé(e)", nom: `${c.prenom} ${c.nom}` }, { role: "La Direction des Ressources Humaines" })}`,
    }),
};

// ── Décision disciplinaire ────────────────────────────────────────────────────
const decisionDisciplinaire: RhDocTemplate = {
  type: "DECISION_DISCIPLINAIRE",
  label: "Décision disciplinaire",
  refSuffix: "DSD",
  fields: [
    { name: "sanction", label: "Sanction retenue", type: "text", required: true, placeholder: "ex : avertissement, blâme, mise à pied…" },
    { name: "faits", label: "Faits retenus", type: "textarea", required: true },
    { name: "dateEffet", label: "Date d'effet", type: "date" },
    { name: "motivation", label: "Motivation de la décision", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Décision Disciplinaire",
      sousTitre: `N° ${refCode(c.matricule, "DSD")}`,
      refCode: refCode(c.matricule, "DSD"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8; text-align:justify;">
    À l'issue de la procédure disciplinaire et après examen des faits reprochés (<em>${p.faits}</em>)
    ainsi que des explications recueillies, la Direction décide de la sanction suivante :
  </p>
  <p style="line-height:1.8; text-align:center; font-weight:bold; font-size:16px; margin:16px 0;">${p.sanction}</p>
  ${p.motivation ? `<p style="line-height:1.8; text-align:justify;"><strong>Motivation.</strong> ${p.motivation}</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    La présente décision prend effet${p.dateEffet ? ` à compter du <strong>${formatDateFr(p.dateEffet)}</strong>` : " à compter de sa notification"} et est versée à votre dossier.
  </p>
  ${signatures({ role: "L'Intéressé(e)", sousTitre: "(Reçu notification)", nom: `${c.prenom} ${c.nom}` }, { role: "La Direction Générale" })}`,
    }),
};

// ── Mise à pied ───────────────────────────────────────────────────────────────
const miseAPied: RhDocTemplate = {
  type: "MISE_A_PIED",
  label: "Mise à pied",
  refSuffix: "MAP",
  fields: [
    { name: "duree", label: "Durée", type: "text", required: true, placeholder: "ex : 3 jours" },
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin", type: "date" },
    { name: "motif", label: "Motif", type: "textarea", required: true },
    { name: "maintienSalaire", label: "Maintien du salaire", type: "select", options: [{ value: "avec", label: "Avec salaire (conservatoire)" }, { value: "sans", label: "Sans salaire (disciplinaire)" }] },
  ],
  render: (c, p) =>
    docShell({
      titre: "Notification de Mise à Pied",
      refCode: refCode(c.matricule, "MAP"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Pour le motif suivant : <em>${p.motif}</em>, nous vous notifions une mise à pied
    d'une durée de <strong>${p.duree}</strong>, à compter du <strong>${formatDateFr(p.dateDebut)}</strong>${p.dateFin ? ` jusqu'au <strong>${formatDateFr(p.dateFin)}</strong>` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    ${p.maintienSalaire === "avec"
      ? "Cette mise à pied est conservatoire ; votre rémunération est maintenue durant cette période."
      : p.maintienSalaire === "sans"
      ? "Cette mise à pied est disciplinaire ; elle entraîne la suspension de votre rémunération pour la période concernée."
      : "Les conditions de rémunération applicables vous seront précisées conformément à la réglementation."}
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Durant cette période, vous êtes tenu(e) de cesser toute activité au sein de l'entreprise.
  </p>
  ${signatures({ role: "L'Intéressé(e)", sousTitre: "(Reçu notification)", nom: `${c.prenom} ${c.nom}` }, { role: "La Direction Générale" })}`,
    }),
};

// ── Lettre de licenciement ────────────────────────────────────────────────────
const lettreLicenciement: RhDocTemplate = {
  type: "LETTRE_LICENCIEMENT",
  label: "Lettre de licenciement",
  refSuffix: "LIC",
  fields: [
    { name: "motif", label: "Motif du licenciement", type: "textarea", required: true },
    { name: "dateEffet", label: "Date d'effet", type: "date", required: true },
    { name: "preavis", label: "Préavis", type: "text", placeholder: "ex : 1 mois, ou dispense" },
    { name: "indemnites", label: "Indemnités", type: "textarea", placeholder: "Indemnités de rupture éventuelles" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Lettre de Licenciement",
      refCode: refCode(c.matricule, "LIC"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    À l'issue de la procédure engagée, nous sommes contraints de vous notifier votre licenciement pour le motif suivant :
    <em>${p.motif}</em>.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Votre contrat de travail prendra fin le <strong>${formatDateFr(p.dateEffet)}</strong>.
    ${p.preavis ? `Un préavis de <strong>${p.preavis}</strong> s'applique.` : ""}
  </p>
  ${p.indemnites ? `<p style="line-height:1.8; text-align:justify;"><strong>Indemnités.</strong> ${p.indemnites}</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    Vos documents de fin de contrat (certificat de travail, solde de tout compte, attestation) vous seront remis à la date d'effet.
  </p>
  <p style="line-height:1.8; margin-top:12px;">Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
  ${signatureRH(c.today)}`,
    }),
};

// ── Procès-verbal de rupture ──────────────────────────────────────────────────
const pvRupture: RhDocTemplate = {
  type: "PV_RUPTURE",
  label: "Procès-verbal de rupture",
  refSuffix: "PVR",
  fields: [
    { name: "typeRupture", label: "Type de rupture", type: "text", placeholder: "ex : rupture d'un commun accord" },
    { name: "dateRupture", label: "Date de la rupture", type: "date", required: true },
    { name: "motif", label: "Motif / conditions", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Procès-Verbal de Rupture",
      refCode: refCode(c.matricule, "PVR"),
      confidentiel: true,
      body: `
  ${enTete(c)}
  <p style="line-height:1.8; text-align:justify;">
    Les parties constatent la rupture du contrat de travail${p.typeRupture ? ` (<strong>${p.typeRupture}</strong>)` : ""},
    prenant effet le <strong>${formatDateFr(p.dateRupture)}</strong>.
  </p>
  ${p.motif ? `<p style="line-height:1.8; text-align:justify;"><strong>Conditions.</strong> ${p.motif}</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    Les parties reconnaissent avoir réglé l'ensemble des comptes liés à l'exécution et à la rupture du contrat,
    sous réserve des documents de fin de contrat à remettre.
  </p>
  ${signatures({ role: "L'Intéressé(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

export const templatesDiscipline: RhDocTemplate[] = [
  avertissementEcrit,
  miseEnDemeure,
  demandeExplication,
  convocationDisciplinaire,
  pvAudition,
  decisionDisciplinaire,
  miseAPied,
  lettreLicenciement,
  pvRupture,
];
