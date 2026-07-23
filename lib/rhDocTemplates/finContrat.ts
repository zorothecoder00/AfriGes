// lib/rhDocTemplates/finContrat.ts
// Documents de fin de contrat (nature A) : certificat de travail,
// reçu pour solde de tout compte, attestation d'emploi.
// Gabarits standard éditables.

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";
import { SOCIETE } from "@/lib/societe";

const certificatTravail: RhDocTemplate = {
  type: "CERTIFICAT_TRAVAIL",
  label: "Certificat de travail",
  refSuffix: "CT",
  fields: [
    { name: "dateSortie", label: "Date de fin de contrat", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Certificat de Travail",
      refCode: refCode(c.matricule, "CT"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e), la Direction des Ressources Humaines, certifie que :
  </p>
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction occupée", c.fonction) +
    ligne("Département", c.departement),
  )}
  <p style="line-height:1.8; text-align:justify;">
    a été employé(e) au sein de notre société
    ${c.dateEmbauche ? `du <strong>${formatDateFr(c.dateEmbauche)}</strong>` : ""}
    au <strong>${formatDateFr(p.dateSortie)}</strong>${c.fonction ? `, en qualité de <strong>${c.fonction}</strong>` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    L'intéressé(e) quitte la société libre de tout engagement.
    Le présent certificat lui est délivré pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const soldeToutCompte: RhDocTemplate = {
  type: "SOLDE_TOUT_COMPTE",
  label: "Reçu pour solde de tout compte",
  refSuffix: "STC",
  fields: [
    { name: "dateSortie", label: "Date de fin de contrat", type: "date", required: true },
    { name: "montantSalaire", label: "Salaire dû (mois en cours)", type: "text", placeholder: "ex : 120 000 FCFA" },
    { name: "montantConges", label: "Indemnité de congés payés", type: "text", placeholder: "ex : 60 000 FCFA" },
    { name: "montantPreavis", label: "Indemnité de préavis", type: "text", placeholder: "facultatif" },
    { name: "autresMontants", label: "Autres indemnités", type: "text", placeholder: "facultatif" },
    { name: "montantTotal", label: "Net total à payer", type: "text", required: true, placeholder: "ex : 240 000 FCFA" },
  ],
  render: (c, p) => {
    const lignesMontant =
      ligne("Salaire dû", p.montantSalaire) +
      ligne("Indemnité de congés payés", p.montantConges) +
      ligne("Indemnité de préavis", p.montantPreavis) +
      ligne("Autres indemnités", p.autresMontants);
    return docShell({
      titre: "Reçu pour Solde de Tout Compte",
      refCode: refCode(c.matricule, "STC"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}${c.fonction ? `, ${c.fonction}` : ""},
    reconnais avoir reçu de mon Employeur, à l'occasion de la fin de mon contrat de travail intervenue le
    <strong>${formatDateFr(p.dateSortie)}</strong>, les sommes suivantes :
  </p>
  ${blocInfos(lignesMontant || ligne("Détail", "Voir décompte joint"))}
  <p style="line-height:1.8; text-align:justify;">
    Soit un <strong>net total de ${p.montantTotal}</strong>, pour solde de tout compte.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Le présent reçu est établi en double exemplaire. Il vaut solde de tout compte pour la période d'emploi écoulée,
    sous réserve des droits que la réglementation reconnaît au/à la salarié(e).
  </p>
  ${signatures(
    { role: "Le/la Salarié(e)", sousTitre: "(Bon pour solde de tout compte)", nom: `${c.prenom} ${c.nom}` },
    { role: "Pour l'Employeur", sousTitre: "La Direction" },
  )}`,
    });
  },
};

const attestationEmploi: RhDocTemplate = {
  type: "ATTESTATION_EMPLOI",
  label: "Attestation d'emploi",
  refSuffix: "AE",
  fields: [
    { name: "destinataire", label: "Destinataire / motif (facultatif)", type: "text", placeholder: "ex : en vue d'une demande de visa" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Attestation d'Emploi",
      refCode: refCode(c.matricule, "AE"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    La Direction des Ressources Humaines atteste par la présente que :
  </p>
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction) +
    ligne("Type de contrat", c.typeContrat),
  )}
  <p style="line-height:1.8; text-align:justify;">
    fait actuellement partie de nos effectifs${c.dateEmbauche ? ` depuis le <strong>${formatDateFr(c.dateEmbauche)}</strong>` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    La présente attestation est délivrée à l'intéressé(e)${p.destinataire ? ` <strong>${p.destinataire}</strong>` : ""} pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const acceptationDemission: RhDocTemplate = {
  type: "ACCEPTATION_DEMISSION",
  label: "Acceptation de démission",
  refSuffix: "ADM",
  fields: [
    { name: "dateReceptionLettre", label: "Date de réception de la lettre de démission", type: "date", required: true },
    { name: "dateEffetDemission", label: "Date d'effet de la démission", type: "date", required: true },
    { name: "dureePreavis", label: "Durée de préavis applicable", type: "text", placeholder: "ex : 1 mois" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Acceptation de Démission",
      refCode: refCode(c.matricule, "ADM"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Madame, Monsieur <strong>${c.prenom} ${c.nom}</strong>,
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Nous accusons réception de votre lettre de démission datée du <strong>${formatDateFr(p.dateReceptionLettre)}</strong>,
    par laquelle vous nous informez de votre décision de mettre fin à votre contrat de travail.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Nous vous confirmons par la présente notre acceptation de cette démission, qui prendra effet le
    <strong>${formatDateFr(p.dateEffetDemission)}</strong>${p.dureePreavis ? `, après observation d'un préavis de <strong>${p.dureePreavis}</strong>` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Nous vous remercions pour votre collaboration au sein de <strong>${SOCIETE.nom}</strong> et vous souhaitons
    plein succès dans vos projets futurs.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const notificationLicenciement: RhDocTemplate = {
  type: "NOTIFICATION_LICENCIEMENT",
  label: "Notification de licenciement",
  refSuffix: "NLI",
  fields: [
    { name: "motif", label: "Motif du licenciement", type: "textarea", required: true, placeholder: "ex : suppression de poste, motif économique…" },
    { name: "dateEffet", label: "Date d'effet", type: "date", required: true },
    { name: "dureePreavis", label: "Durée de préavis / indemnité", type: "text", placeholder: "ex : 1 mois de préavis ou indemnité compensatrice" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Notification de Licenciement",
      refCode: refCode(c.matricule, "NLI"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Madame, Monsieur <strong>${c.prenom} ${c.nom}</strong>,
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Nous vous notifions par la présente la rupture de votre contrat de travail pour le motif suivant :
    <em>${p.motif}</em>.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Cette décision prendra effet le <strong>${formatDateFr(p.dateEffet)}</strong>${p.dureePreavis ? `, ${p.dureePreavis}` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Vous percevrez, selon votre situation, les indemnités légales auxquelles votre ancienneté et votre statut
    vous donnent droit, dont le détail figurera sur votre reçu pour solde de tout compte.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction</p></div>
  </div>`,
    }),
};

const mainleveeMateriel: RhDocTemplate = {
  type: "MAINLEVEE_MATERIEL",
  label: "Mainlevée du matériel",
  refSuffix: "MLM",
  fields: [
    { name: "materielConcerne", label: "Matériel concerné (un par ligne)", type: "textarea", required: true, placeholder: "ex : Ordinateur portable - SN123456\nBadge d'accès" },
    { name: "dateMainlevee", label: "Date de la mainlevée", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Mainlevée du Matériel",
      refCode: refCode(c.matricule, "MLM"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    La Direction certifie que <strong>${c.prenom} ${c.nom}</strong> (Matricule ${c.matricule}) a restitué,
    le <strong>${formatDateFr(p.dateMainlevee)}</strong>, l'ensemble du matériel professionnel qui lui avait
    été confié, à savoir :
  </p>
  ${blocInfos(`<p style="margin:0; white-space:pre-line;">${p.materielConcerne}</p>`)}
  <p style="line-height:1.8; text-align:justify;">
    La présente mainlevée atteste que l'intéressé(e) n'est plus tenu(e) responsable dudit matériel à compter
    de cette date.
  </p>
  ${signatures({ role: "Le/la Salarié(e)", nom: `${c.prenom} ${c.nom}` }, { role: "Service Logistique / RH" })}`,
    }),
};

const ficheRestitutionBiens: RhDocTemplate = {
  type: "FICHE_RESTITUTION_BIENS",
  label: "Fiche de restitution des biens",
  refSuffix: "FRB",
  fields: [
    { name: "biensRestitues", label: "Biens restitués (un par ligne)", type: "textarea", required: true, placeholder: "ex : Véhicule de service\nClés de bureau\nDocuments internes" },
    { name: "biensManquants", label: "Biens manquants / observations", type: "textarea", placeholder: "facultatif" },
    { name: "dateRestitution", label: "Date de restitution", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Fiche de Restitution des Biens",
      refCode: refCode(c.matricule, "FRB"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Dans le cadre de la fin de contrat de <strong>${c.prenom} ${c.nom}</strong> (Matricule ${c.matricule}),
    les biens suivants ont été restitués le <strong>${formatDateFr(p.dateRestitution)}</strong> :
  </p>
  ${blocInfos(`<p style="margin:0; white-space:pre-line;">${p.biensRestitues}</p>`)}
  ${p.biensManquants ? `<p style="line-height:1.8; text-align:justify;"><strong>Observations / biens manquants :</strong> ${p.biensManquants}</p>` : ""}
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Restitution constatée)", nom: `${c.prenom} ${c.nom}` }, { role: "Service Logistique / RH" })}`,
    }),
};

const quitusAdministratif: RhDocTemplate = {
  type: "QUITUS_ADMINISTRATIF",
  label: "Quitus administratif",
  refSuffix: "QAD",
  fields: [
    { name: "dateSortie", label: "Date de fin de contrat", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Quitus Administratif",
      refCode: refCode(c.matricule, "QAD"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    La Direction des Ressources Humaines certifie que <strong>${c.prenom} ${c.nom}</strong>
    (Matricule ${c.matricule}), ayant quitté ses fonctions le <strong>${formatDateFr(p.dateSortie)}</strong>,
    a régularisé l'ensemble de ses obligations administratives vis-à-vis de <strong>${SOCIETE.nom}</strong> :
  </p>
  ${blocInfos(
    ligne("Matériel restitué", "Confirmé") +
    ligne("Soldes financiers apurés", "Confirmé") +
    ligne("Accès et badges désactivés", "Confirmé"),
  )}
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Aucune réclamation administrative n'est en cours à l'encontre de l'intéressé(e) à la date de délivrance
    du présent quitus.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const pvSortie: RhDocTemplate = {
  type: "PV_SORTIE",
  label: "Procès-verbal de sortie",
  refSuffix: "PVS",
  fields: [
    { name: "dateSortie", label: "Date de sortie effective", type: "date", required: true },
    { name: "motifSortie", label: "Motif de la sortie", type: "text", required: true, placeholder: "ex : démission, licenciement, fin de CDD…" },
    { name: "constatations", label: "Constatations (matériel, accès, dossier)", type: "textarea", placeholder: "facultatif" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Procès-Verbal de Sortie",
      refCode: refCode(c.matricule, "PVS"),
      body: `
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction) +
    ligne("Département", c.departement) +
    ligne("Motif de la sortie", p.motifSortie) +
    ligne("Date de sortie", formatDateFr(p.dateSortie)),
  )}
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Le présent procès-verbal constate la sortie effective de l'intéressé(e) des effectifs de
    <strong>${SOCIETE.nom}</strong> à la date ci-dessus.
  </p>
  ${p.constatations ? `<p style="line-height:1.8; text-align:justify;"><strong>Constatations :</strong> ${p.constatations}</p>` : ""}
  ${signatures({ role: "Le/la Salarié(e)", nom: `${c.prenom} ${c.nom}` }, { role: "Ressources Humaines" })}`,
    }),
};

export const templatesFinContrat: RhDocTemplate[] = [
  certificatTravail,
  soldeToutCompte,
  attestationEmploi,
  acceptationDemission,
  notificationLicenciement,
  mainleveeMateriel,
  ficheRestitutionBiens,
  quitusAdministratif,
  pvSortie,
];
