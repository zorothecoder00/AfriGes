// lib/rhDocTemplates/formation.ts
// Documents de formation : attestation de formation, certificat de participation.
// Réutilise le CollabCtx standard ; les données de la formation suivie sont
// saisies en payload (intitulé, dates, organisme) plutôt que tirées d'un
// contexte dédié, pour rester sur le pipeline générique `documents-rh`.

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";
import { SOCIETE } from "@/lib/societe";

const attestationFormation: RhDocTemplate = {
  type: "ATTESTATION_FORMATION",
  label: "Attestation de formation",
  refSuffix: "ATF",
  fields: [
    { name: "intituleFormation", label: "Intitulé de la formation", type: "text", required: true },
    { name: "organisme", label: "Organisme / formateur", type: "text", placeholder: "ex : interne, cabinet externe…" },
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin", type: "date", required: true },
    { name: "dureeHeures", label: "Durée (heures)", type: "text", placeholder: "ex : 24 heures" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Attestation de Formation",
      refCode: refCode(c.matricule, "ATF"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    <strong>${SOCIETE.nom}</strong> atteste que :
  </p>
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction),
  )}
  <p style="line-height:1.8; text-align:justify;">
    a suivi la formation intitulée <strong>« ${p.intituleFormation} »</strong>${p.organisme ? `, dispensée par ${p.organisme}` : ""},
    du <strong>${formatDateFr(p.dateDebut)}</strong> au <strong>${formatDateFr(p.dateFin)}</strong>${p.dureeHeures ? `, soit une durée de <strong>${p.dureeHeures}</strong>` : ""}.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top:48px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:60px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction RH</p></div>
  </div>`,
    }),
};

const certificatParticipation: RhDocTemplate = {
  type: "CERTIFICAT_PARTICIPATION",
  label: "Certificat de participation",
  refSuffix: "CPT",
  fields: [
    { name: "intituleFormation", label: "Intitulé de la formation / séminaire", type: "text", required: true },
    { name: "lieu", label: "Lieu", type: "text", placeholder: "facultatif" },
    { name: "dateEvenement", label: "Date de l'événement", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Certificat de Participation",
      refCode: refCode(c.matricule, "CPT"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Il est certifié que <strong>${c.prenom} ${c.nom}</strong> (Matricule ${c.matricule})${c.fonction ? `, ${c.fonction}` : ""},
    a participé à <strong>« ${p.intituleFormation} »</strong>${p.lieu ? `, à ${p.lieu}` : ""},
    le <strong>${formatDateFr(p.dateEvenement)}</strong>.
  </p>
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Ce certificat est délivré par <strong>${SOCIETE.nom}</strong> pour servir et valoir ce que de droit.
  </p>
  ${signatures({ role: "Ressources Humaines" }, { role: "La Direction" })}`,
    }),
};

export const templatesFormation: RhDocTemplate[] = [
  attestationFormation,
  certificatParticipation,
];
