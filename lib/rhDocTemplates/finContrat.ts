// lib/rhDocTemplates/finContrat.ts
// Documents de fin de contrat (nature A) : certificat de travail,
// reçu pour solde de tout compte, attestation d'emploi.
// Gabarits standard éditables.

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";

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

export const templatesFinContrat: RhDocTemplate[] = [
  certificatTravail,
  soldeToutCompte,
  attestationEmploi,
];
