// lib/rhDocTemplates/divers.ts
// Templates historiques (migrés depuis l'ancien switch de /generer) :
// attestation de travail, certificat de présence, décision d'affectation, lettre de mission.

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";

const attestationTravail: RhDocTemplate = {
  type: "ATTESTATION_TRAVAIL",
  label: "Attestation de travail",
  refSuffix: "ATT",
  fields: [],
  render: (c) =>
    docShell({
      titre: "Attestation de Travail",
      refCode: refCode(c.matricule, "ATT"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e), la Direction des Ressources Humaines, atteste par la présente que :
  </p>
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction) +
    ligne("Département", c.departement) +
    ligne("Type de contrat", c.typeContrat) +
    ligne("Email professionnel", c.emailPro),
  )}
  <p style="line-height:1.8; text-align:justify;">
    est employé(e) au sein de notre société${c.dateEmbauche ? ` depuis le <strong>${formatDateFr(c.dateEmbauche)}</strong>` : ""},
    et exerce ses fonctions avec sérieux et compétence.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    La présente attestation est délivrée à la demande de l'intéressé(e) pour faire valoir ce que de droit.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const certificatPresence: RhDocTemplate = {
  type: "CERTIFICAT_PRESENCE",
  label: "Certificat de présence",
  refSuffix: "CERT",
  fields: [],
  render: (c) =>
    docShell({
      titre: "Certificat de Présence",
      refCode: refCode(c.matricule, "CERT"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    La Direction des Ressources Humaines certifie que :
  </p>
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Poste", c.fonction) +
    ligne("Département", c.departement),
  )}
  <p style="line-height:1.8; text-align:justify;">
    ${c.dateEmbauche
      ? `est présent(e) dans nos effectifs depuis le <strong>${formatDateFr(c.dateEmbauche)}</strong> et occupe actuellement son poste à temps plein.`
      : "est présent(e) dans nos effectifs et occupe actuellement son poste à temps plein."}
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Ce certificat est établi à la demande de l'intéressé(e) pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const decisionAffectation: RhDocTemplate = {
  type: "DECISION_AFFECTATION",
  label: "Décision d'affectation",
  refSuffix: "AFF",
  fields: [],
  render: (c) => {
    const art2 = c.niveauHierarchique
      ? `<p style="line-height:1.8;"><strong>Article 2 :</strong> La classification hiérarchique est fixée au niveau <strong>${c.niveauHierarchique}</strong>.</p>`
      : "";
    return docShell({
      titre: "Décision d'Affectation",
      refCode: refCode(c.matricule, "AFF"),
      sousTitre: `N° ${refCode(c.matricule, "AFF")}`,
      confidentiel: true,
      body: `
  <p style="line-height:1.8;">La Direction Générale,</p>
  <p style="line-height:1.8; font-weight:bold; text-transform:uppercase; margin:0 0 16px;">DÉCIDE :</p>
  <p style="line-height:1.8; text-align:justify;">
    <strong>Article 1 :</strong> Monsieur / Madame <strong>${c.prenom} ${c.nom}</strong>,
    Matricule <strong>${c.matricule}</strong>, est affecté(e)
    ${c.fonction ? `au poste de <strong>${c.fonction}</strong>` : "au poste défini ci-dessus"}
    ${c.departement ? ` au sein du département <strong>${c.departement}</strong>` : ""}
    ${c.service ? ` — service <strong>${c.service}</strong>` : ""}.
  </p>
  ${art2}
  <p style="line-height:1.8;">
    <strong>Article ${c.niveauHierarchique ? "3" : "2"} :</strong>
    La présente décision prend effet à compter du <strong>${formatDateFr(c.today)}</strong>.
  </p>
  ${signatures(
    { role: "L'Intéressé(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` },
    { role: "La Direction Générale" },
  )}`,
    });
  },
};

const lettreMission: RhDocTemplate = {
  type: "LETTRE_MISSION",
  label: "Lettre de mission",
  refSuffix: "MISS",
  fields: [
    { name: "destination", label: "Destination", type: "text", placeholder: "Ville / lieu de la mission" },
    { name: "dateDebutMission", label: "Date de début", type: "date" },
    { name: "dateFinMission", label: "Date de fin", type: "date" },
    { name: "objet", label: "Objet de la mission", type: "textarea", placeholder: "But et livrables attendus" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Lettre de Mission",
      refCode: refCode(c.matricule, "MISS"),
      confidentiel: true,
      body: `
  <div style="margin-bottom:24px;">
    ${ligne("À", `${c.prenom} ${c.nom} (${c.matricule})`)}
    ${ligne("Fonction", c.fonction)}
    ${ligne("Département", c.departement)}
    ${ligne("Date", formatDateFr(c.today))}
    ${ligne("Objet", p.objet)}
  </div>
  <p style="line-height:1.8;">Monsieur / Madame,</p>
  <p style="line-height:1.8; text-align:justify;">
    Vous êtes missionné(e) par la Direction Générale
    ${p.destination ? `à <strong>${p.destination}</strong>` : "dans le cadre de vos fonctions"}
    ${p.dateDebutMission ? ` du <strong>${formatDateFr(p.dateDebutMission)}</strong>` : ""}
    ${p.dateFinMission ? ` au <strong>${formatDateFr(p.dateFinMission)}</strong>` : ""}.
  </p>
  ${p.objet ? `<p style="line-height:1.8; text-align:justify;">L'objet de cette mission est : <em>${p.objet}</em>.</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    Vous êtes autorisé(e) à engager les dépenses strictement nécessaires à l'accomplissement de cette mission,
    sous réserve de produire les justificatifs correspondants à votre retour.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Nous vous demandons de rédiger un rapport de mission dans les cinq (5) jours ouvrables suivant votre retour.
  </p>
  <p style="line-height:1.8; margin-top:16px;">Veuillez agréer, Monsieur/Madame, l'expression de notre considération distinguée.</p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction Générale</p></div>
  </div>`,
    }),
};

export const templatesDivers: RhDocTemplate[] = [
  attestationTravail,
  certificatPresence,
  decisionAffectation,
  lettreMission,
];
