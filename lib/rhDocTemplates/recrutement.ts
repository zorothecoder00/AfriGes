// lib/rhDocTemplates/recrutement.ts
// Documents de recrutement (nature A) rattachés à un PosteOuvert ou une Candidature.
// Contexte propre (poste + candidat), registre séparé de celui des documents collaborateur.
// Gabarits standard éditables.

import type { FieldSpec, DocPayload } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";
import { SOCIETE } from "@/lib/societe";

/** Données projetées depuis le poste et (le cas échéant) la candidature. */
export interface RecrutementCtx {
  // Poste
  posteRef?: string | null;
  posteTitre: string;
  departement?: string | null;
  service?: string | null;
  lieu?: string | null;
  typeContrat?: string | null;
  description?: string | null;
  exigences?: string | null;
  experienceMin?: number | null;
  dateLimite?: Date | null;
  salaireMini?: number | null;
  salaireMaxi?: number | null;
  // Candidat (présent pour les documents de scope « candidature »)
  candidatNom?: string | null;
  candidatPrenom?: string | null;
  email?: string | null;
  telephone?: string | null;
  dateEntretien?: Date | null;
  today: Date;
}

export interface RecrutementDocTemplate {
  type: string;
  label: string;
  /** Cible du document : le poste ou la candidature. */
  scope: "poste" | "candidature";
  refSuffix: string;
  fields: FieldSpec[];
  render: (ctx: RecrutementCtx, payload: DocPayload) => string;
}

/** Référence normalisée, basée sur la référence du poste si disponible. */
function rc(ctx: RecrutementCtx, suffix: string): string {
  return `${ctx.posteRef ?? "REC"}-${suffix}-${new Date().getFullYear()}`;
}

function fmtFcfa(n?: number | null): string | null {
  if (n == null) return null;
  return `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;
}

function candidat(ctx: RecrutementCtx): string {
  return `${ctx.candidatPrenom ?? ""} ${ctx.candidatNom ?? ""}`.trim();
}

// ── Avis de recrutement (poste) ───────────────────────────────────────────────
const avisRecrutement: RecrutementDocTemplate = {
  type: "AVIS_RECRUTEMENT",
  label: "Avis de recrutement",
  scope: "poste",
  refSuffix: "AVIS",
  fields: [
    { name: "modalites", label: "Modalités de candidature", type: "textarea", placeholder: "Pièces à fournir, procédure…" },
    { name: "contact", label: "Contact / dépôt des candidatures", type: "text", placeholder: `ex : recrutement@${SOCIETE.siteWeb.replace("www.", "")}` },
  ],
  render: (c, p) => {
    const fourchette =
      c.salaireMini != null || c.salaireMaxi != null
        ? [fmtFcfa(c.salaireMini), fmtFcfa(c.salaireMaxi)].filter(Boolean).join(" – ")
        : null;
    return docShell({
      titre: "Avis de Recrutement",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "AVIS"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Dans le cadre du renforcement de ses équipes, <strong>${SOCIETE.nom}</strong> recrute :
  </p>
  <h2 style="text-align:center; font-size:18px; margin:16px 0;">${c.posteTitre}</h2>
  ${blocInfos(
    ligne("Poste", c.posteTitre) +
    ligne("Département", c.departement) +
    ligne("Lieu", c.lieu) +
    ligne("Type de contrat", c.typeContrat) +
    ligne("Expérience minimale", c.experienceMin != null ? `${c.experienceMin} an(s)` : null) +
    ligne("Rémunération", fourchette) +
    ligne("Date limite de candidature", c.dateLimite ? formatDateFr(c.dateLimite) : null),
  )}
  ${c.description ? `<p style="line-height:1.8; text-align:justify;"><strong>Missions.</strong> ${c.description}</p>` : ""}
  ${c.exigences ? `<p style="line-height:1.8; text-align:justify;"><strong>Profil recherché.</strong> ${c.exigences}</p>` : ""}
  ${p.modalites ? `<p style="line-height:1.8; text-align:justify;"><strong>Modalités.</strong> ${p.modalites}</p>` : ""}
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">
    Les candidatures${p.contact ? ` sont à adresser à <strong>${p.contact}</strong>` : ""}
    ${c.dateLimite ? ` au plus tard le <strong>${formatDateFr(c.dateLimite)}</strong>` : ""}.
  </p>
  <div style="margin-top:40px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:48px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction des Ressources Humaines</p></div>
  </div>`,
    });
  },
};

// ── Convocation à l'entretien (candidature) ───────────────────────────────────
const convocationEntretien: RecrutementDocTemplate = {
  type: "CONVOCATION_ENTRETIEN",
  label: "Convocation à l'entretien",
  scope: "candidature",
  refSuffix: "CONV",
  fields: [
    { name: "dateEntretien", label: "Date de l'entretien", type: "date", required: true },
    { name: "heure", label: "Heure", type: "text", placeholder: "ex : 10h00" },
    { name: "lieuEntretien", label: "Lieu de l'entretien", type: "text", placeholder: "ex : Siège, Lomé" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Convocation à un Entretien",
      refCode: rc(c, "CONV"),
      body: `
  <div style="margin-bottom:20px;">
    ${ligne("À l'attention de", candidat(c))}
    ${ligne("Poste concerné", c.posteTitre)}
  </div>
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Suite à votre candidature au poste de <strong>${c.posteTitre}</strong>, nous avons le plaisir de vous convier
    à un entretien qui se tiendra :
  </p>
  ${blocInfos(
    ligne("Date", formatDateFr(p.dateEntretien)) +
    ligne("Heure", p.heure) +
    ligne("Lieu", p.lieuEntretien || c.lieu),
  )}
  <p style="line-height:1.8; text-align:justify;">
    Nous vous remercions de bien vouloir vous munir des pièces justificatives utiles (CV, diplômes, attestations).
    En cas d'empêchement, merci de nous en informer dans les meilleurs délais.
  </p>
  <p style="line-height:1.8; margin-top:16px;">Dans l'attente de vous rencontrer, veuillez agréer nos salutations distinguées.</p>
  <div style="margin-top:40px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:48px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction des Ressources Humaines</p></div>
  </div>`,
    }),
};

// ── Lettre d'offre d'emploi (candidature) ─────────────────────────────────────
const lettreOffre: RecrutementDocTemplate = {
  type: "LETTRE_OFFRE",
  label: "Lettre d'offre d'emploi",
  scope: "candidature",
  refSuffix: "OFF",
  fields: [
    { name: "salaire", label: "Rémunération proposée", type: "text", required: true, placeholder: "ex : 250 000 FCFA brut / mois" },
    { name: "datePrisePoste", label: "Date de prise de poste", type: "date", required: true },
    { name: "typeContratOffre", label: "Type de contrat (si différent)", type: "text", placeholder: "ex : CDI, CDD 12 mois" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Lettre d'Offre d'Emploi",
      refCode: rc(c, "OFF"),
      body: `
  <div style="margin-bottom:20px;">${ligne("À l'attention de", candidat(c))}</div>
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    À l'issue de notre processus de recrutement, nous avons le plaisir de vous proposer le poste de
    <strong>${c.posteTitre}</strong> au sein de <strong>${SOCIETE.nom}</strong>, aux conditions suivantes :
  </p>
  ${blocInfos(
    ligne("Poste", c.posteTitre) +
    ligne("Département", c.departement) +
    ligne("Lieu d'affectation", c.lieu) +
    ligne("Type de contrat", p.typeContratOffre || c.typeContrat) +
    ligne("Rémunération", p.salaire) +
    ligne("Date de prise de poste", formatDateFr(p.datePrisePoste)),
  )}
  <p style="line-height:1.8; text-align:justify;">
    Cette offre est valable sous réserve de la production des pièces administratives requises et de la signature
    du contrat de travail correspondant. Nous vous saurions gré de bien vouloir nous faire part de votre accord.
  </p>
  <p style="line-height:1.8; margin-top:16px;">Dans l'attente de votre réponse, veuillez agréer nos salutations distinguées.</p>
  ${signatures({ role: "Le/la Candidat(e)", sousTitre: "(Bon pour accord)", nom: candidat(c) }, { role: "La Direction des Ressources Humaines" })}`,
    }),
};

// ── Lettre de refus de candidature (candidature) ──────────────────────────────
const lettreRefus: RecrutementDocTemplate = {
  type: "LETTRE_REFUS",
  label: "Lettre de refus de candidature",
  scope: "candidature",
  refSuffix: "REF",
  fields: [
    { name: "motif", label: "Motif (facultatif, interne)", type: "textarea", placeholder: "Non affiché si vide" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Réponse à votre Candidature",
      refCode: rc(c, "REF"),
      body: `
  <div style="margin-bottom:20px;">${ligne("À l'attention de", candidat(c))}</div>
  <p style="line-height:1.8;">Madame, Monsieur,</p>
  <p style="line-height:1.8; text-align:justify;">
    Nous vous remercions de l'intérêt que vous avez porté à <strong>${SOCIETE.nom}</strong> en postulant
    au poste de <strong>${c.posteTitre}</strong>, ainsi que du temps que vous nous avez consacré.
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Après un examen attentif de votre candidature, nous sommes au regret de ne pouvoir y donner une suite favorable.
    ${p.motif ? `<br/><em>${p.motif}</em>` : ""}
  </p>
  <p style="line-height:1.8; text-align:justify;">
    Nous conservons néanmoins vos coordonnées et ne manquerons pas de vous recontacter si une opportunité
    correspondant à votre profil venait à se présenter. Nous vous souhaitons plein succès dans vos recherches.
  </p>
  <p style="line-height:1.8; margin-top:16px;">Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>
  <div style="margin-top:40px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:48px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">La Direction des Ressources Humaines</p></div>
  </div>`,
    }),
};

// ── Promesse d'embauche (candidature) ─────────────────────────────────────────
const promesseEmbauche: RecrutementDocTemplate = {
  type: "PROMESSE_EMBAUCHE",
  label: "Promesse d'embauche",
  scope: "candidature",
  refSuffix: "PROM",
  fields: [
    { name: "salaire", label: "Rémunération convenue", type: "text", required: true, placeholder: "ex : 250 000 FCFA brut / mois" },
    { name: "datePrisePoste", label: "Date d'embauche prévue", type: "date", required: true },
    { name: "dateReponse", label: "Date limite de réponse", type: "date" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Promesse d'Embauche",
      refCode: rc(c, "PROM"),
      body: `
  <div style="margin-bottom:20px;">${ligne("Bénéficiaire", candidat(c))}</div>
  <p style="line-height:1.8; text-align:justify;">
    Par la présente, <strong>${SOCIETE.nom}</strong> s'engage à recruter <strong>${candidat(c)}</strong>
    au poste de <strong>${c.posteTitre}</strong>, aux conditions suivantes :
  </p>
  ${blocInfos(
    ligne("Poste", c.posteTitre) +
    ligne("Type de contrat", c.typeContrat) +
    ligne("Rémunération convenue", p.salaire) +
    ligne("Date d'embauche prévue", formatDateFr(p.datePrisePoste)),
  )}
  <p style="line-height:1.8; text-align:justify;">
    La présente promesse vaut engagement des deux parties, sous réserve de la production des pièces requises et
    de la signature du contrat définitif.
    ${p.dateReponse ? `Le/la bénéficiaire est invité(e) à confirmer son accord au plus tard le <strong>${formatDateFr(p.dateReponse)}</strong>.` : ""}
  </p>
  ${signatures({ role: "Le/la Bénéficiaire", sousTitre: "(Bon pour accord)", nom: candidat(c) }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

// ── Procès-verbal de sélection (poste) ────────────────────────────────────────
const pvSelection: RecrutementDocTemplate = {
  type: "PV_SELECTION",
  label: "Procès-verbal de sélection",
  scope: "poste",
  refSuffix: "PVS",
  fields: [
    { name: "candidatRetenu", label: "Candidat(e) retenu(e)", type: "text", required: true, placeholder: "Nom du candidat sélectionné" },
    { name: "membresJury", label: "Membres du comité de sélection", type: "textarea", placeholder: "Un par ligne" },
    { name: "motivation", label: "Motivation de la décision", type: "textarea", placeholder: "Justification du choix" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Procès-Verbal de Sélection",
      sousTitre: c.posteRef ? `Recrutement Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "PVS"),
      confidentiel: true,
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Le comité de sélection s'est réuni le <strong>${formatDateFr(c.today)}</strong> en vue de pourvoir le poste de
    <strong>${c.posteTitre}</strong>${c.departement ? ` (${c.departement})` : ""}.
  </p>
  ${p.membresJury ? blocInfos(`<p style="margin:0;"><strong>Membres du comité :</strong></p><p style="margin:6px 0 0; white-space:pre-line;">${p.membresJury}</p>`) : ""}
  <p style="line-height:1.8; text-align:justify;">
    Après examen des candidatures et délibération, le comité décide de retenir la candidature de
    <strong>${p.candidatRetenu}</strong>.
  </p>
  ${p.motivation ? `<p style="line-height:1.8; text-align:justify;"><strong>Motivation.</strong> ${p.motivation}</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">
    En foi de quoi, le présent procès-verbal est dressé pour servir et valoir ce que de droit.
  </p>
  <div style="margin-top:40px; text-align:right;">
    <p style="margin:0;">Fait le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:48px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">Le Comité de Sélection</p></div>
  </div>`,
    }),
};

// ── Fiche de création de poste (poste) ────────────────────────────────────────
const ficheCreationPoste: RecrutementDocTemplate = {
  type: "FICHE_CREATION_POSTE",
  label: "Fiche de création de poste",
  scope: "poste",
  refSuffix: "FCP",
  fields: [
    { name: "justification", label: "Justification de la création", type: "textarea", placeholder: "ex : surcroît d'activité, remplacement, nouveau projet…" },
    { name: "rattachementHierarchique", label: "Rattachement hiérarchique", type: "text", placeholder: "ex : rapporte au Chef d'agence" },
    { name: "budgetPrevu", label: "Budget prévu", type: "text", placeholder: "facultatif" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Fiche de Création de Poste",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "FCP"),
      body: `
  ${blocInfos(
    ligne("Intitulé du poste", c.posteTitre) +
    ligne("Département", c.departement) +
    ligne("Service", c.service) +
    ligne("Lieu", c.lieu) +
    ligne("Type de contrat envisagé", c.typeContrat) +
    ligne("Rattachement hiérarchique", p.rattachementHierarchique),
  )}
  ${p.justification ? `<p style="line-height:1.8; text-align:justify;"><strong>Justification.</strong> ${p.justification}</p>` : ""}
  ${p.budgetPrevu ? `<p style="line-height:1.8; text-align:justify;"><strong>Budget prévu.</strong> ${p.budgetPrevu}</p>` : ""}
  ${signatures({ role: "Demandeur", sousTitre: "Responsable de service" }, { role: "Validation", sousTitre: "Direction Générale / RH" })}`,
    }),
};

// ── Description de poste (poste) ──────────────────────────────────────────────
const descriptionPoste: RecrutementDocTemplate = {
  type: "DESCRIPTION_POSTE",
  label: "Description de poste",
  scope: "poste",
  refSuffix: "DES",
  fields: [
    { name: "missionPrincipale", label: "Mission principale", type: "textarea" },
    { name: "activitesPrincipales", label: "Activités principales (une par ligne)", type: "textarea", placeholder: "ex : Gérer la caisse\nSuperviser l'équipe…" },
    { name: "liaisonsFonctionnelles", label: "Liaisons fonctionnelles", type: "text", placeholder: "ex : en lien avec le service Comptabilité" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Description de Poste",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "DES"),
      body: `
  <h2 style="text-align:center; font-size:18px; margin:16px 0;">${c.posteTitre}</h2>
  ${blocInfos(
    ligne("Département", c.departement) +
    ligne("Service", c.service) +
    ligne("Lieu", c.lieu) +
    ligne("Type de contrat", c.typeContrat),
  )}
  ${p.missionPrincipale ? `<p style="line-height:1.8; text-align:justify;"><strong>Mission principale.</strong> ${p.missionPrincipale}</p>` : (c.description ? `<p style="line-height:1.8; text-align:justify;"><strong>Mission principale.</strong> ${c.description}</p>` : "")}
  ${p.activitesPrincipales ? `<p style="line-height:1.8; text-align:justify;"><strong>Activités principales :</strong></p><p style="white-space:pre-line; line-height:1.8;">${p.activitesPrincipales}</p>` : ""}
  ${p.liaisonsFonctionnelles ? `<p style="line-height:1.8; text-align:justify;"><strong>Liaisons fonctionnelles.</strong> ${p.liaisonsFonctionnelles}</p>` : ""}
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

// ── Profil de poste (poste) ───────────────────────────────────────────────────
const profilPoste: RecrutementDocTemplate = {
  type: "PROFIL_POSTE",
  label: "Profil de poste",
  scope: "poste",
  refSuffix: "PRO",
  fields: [
    { name: "diplomeRequis", label: "Diplôme / niveau requis", type: "text" },
    { name: "competencesTechniques", label: "Compétences techniques requises", type: "textarea" },
    { name: "qualitesPersonnelles", label: "Qualités personnelles attendues", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Profil de Poste",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "PRO"),
      body: `
  <h2 style="text-align:center; font-size:18px; margin:16px 0;">${c.posteTitre}</h2>
  ${blocInfos(
    ligne("Diplôme / niveau requis", p.diplomeRequis) +
    ligne("Expérience minimale", c.experienceMin != null ? `${c.experienceMin} an(s)` : null),
  )}
  ${p.competencesTechniques ? `<p style="line-height:1.8; text-align:justify;"><strong>Compétences techniques.</strong> ${p.competencesTechniques}</p>` : (c.exigences ? `<p style="line-height:1.8; text-align:justify;"><strong>Compétences techniques.</strong> ${c.exigences}</p>` : "")}
  ${p.qualitesPersonnelles ? `<p style="line-height:1.8; text-align:justify;"><strong>Qualités personnelles.</strong> ${p.qualitesPersonnelles}</p>` : ""}
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

// ── Demande de recrutement (poste) ────────────────────────────────────────────
const demandeRecrutement: RecrutementDocTemplate = {
  type: "DEMANDE_RECRUTEMENT",
  label: "Demande de recrutement",
  scope: "poste",
  refSuffix: "DMD",
  fields: [
    { name: "demandeur", label: "Nom du demandeur", type: "text", required: true },
    { name: "motifDemande", label: "Motif de la demande", type: "textarea", placeholder: "ex : remplacement, création, surcroît d'activité" },
    { name: "dateSouhaitee", label: "Date d'entrée en fonction souhaitée", type: "date" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Demande de Recrutement",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef}` : undefined,
      refCode: rc(c, "DMD"),
      body: `
  ${blocInfos(
    ligne("Poste demandé", c.posteTitre) +
    ligne("Département", c.departement) +
    ligne("Service", c.service) +
    ligne("Demandeur", p.demandeur) +
    ligne("Date d'entrée en fonction souhaitée", p.dateSouhaitee ? formatDateFr(p.dateSouhaitee) : null),
  )}
  ${p.motifDemande ? `<p style="line-height:1.8; text-align:justify;"><strong>Motif.</strong> ${p.motifDemande}</p>` : ""}
  ${signatures({ role: "Demandeur", nom: p.demandeur }, { role: "Validation Direction Générale / RH" })}`,
    }),
};

// ── Grille de présélection des candidatures (poste) ───────────────────────────
const grillePreselection: RecrutementDocTemplate = {
  type: "GRILLE_PRESELECTION",
  label: "Grille de présélection des candidatures",
  scope: "poste",
  refSuffix: "GPS",
  fields: [
    { name: "criteres", label: "Critères de présélection (un par ligne)", type: "textarea", placeholder: "ex : Diplôme requis\nExpérience minimale\nMaîtrise de l'outil X" },
  ],
  render: (c, p) => {
    const criteresListe = (p.criteres || "Diplôme requis\nExpérience\nCompétences techniques\nDisponibilité")
      .split("\n")
      .filter((l) => l.trim())
      .map(
        (crit) => `
    <tr>
      <td style="border:1px solid #ccc; padding:8px;">${crit}</td>
      <td style="border:1px solid #ccc; padding:8px; text-align:center;">☐ Oui&nbsp;&nbsp;☐ Non</td>
      <td style="border:1px solid #ccc; padding:8px;"></td>
    </tr>`,
      )
      .join("");
    return docShell({
      titre: "Grille de Présélection des Candidatures",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef} — ${c.posteTitre}` : c.posteTitre,
      refCode: rc(c, "GPS"),
      body: `
  <table style="width:100%; border-collapse:collapse; margin-top:12px;">
    <thead>
      <tr>
        <th style="border:1px solid #ccc; padding:8px; background:#f0f0f0; text-align:left;">Critère</th>
        <th style="border:1px solid #ccc; padding:8px; background:#f0f0f0;">Satisfait</th>
        <th style="border:1px solid #ccc; padding:8px; background:#f0f0f0; text-align:left;">Observations</th>
      </tr>
    </thead>
    <tbody>${criteresListe}</tbody>
  </table>
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    });
  },
};

// ── Guide d'entretien (poste) ─────────────────────────────────────────────────
const guideEntretien: RecrutementDocTemplate = {
  type: "GUIDE_ENTRETIEN",
  label: "Guide d'entretien",
  scope: "poste",
  refSuffix: "GDE",
  fields: [
    { name: "questions", label: "Questions à poser (une par ligne)", type: "textarea", placeholder: "ex : Parlez-nous de votre parcours…\nPourquoi ce poste ?" },
    { name: "pointsEvaluation", label: "Points clés à évaluer (une par ligne)", type: "textarea", placeholder: "ex : Communication\nMotivation\nCompétences techniques" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Guide d'Entretien",
      sousTitre: c.posteRef ? `Réf. ${c.posteRef} — ${c.posteTitre}` : c.posteTitre,
      refCode: rc(c, "GDE"),
      body: `
  ${blocInfos(ligne("Poste", c.posteTitre) + ligne("Département", c.departement))}
  ${p.questions ? `<p style="line-height:1.8;"><strong>Questions suggérées :</strong></p><p style="white-space:pre-line; line-height:1.8;">${p.questions}</p>` : ""}
  ${p.pointsEvaluation ? `<p style="line-height:1.8;"><strong>Points clés à évaluer :</strong></p><p style="white-space:pre-line; line-height:1.8;">${p.pointsEvaluation}</p>` : ""}
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

// ── Grille d'évaluation des candidats (candidature) ───────────────────────────
const grilleEvaluationCandidats: RecrutementDocTemplate = {
  type: "GRILLE_EVALUATION_CANDIDATS",
  label: "Grille d'évaluation des candidats",
  scope: "candidature",
  refSuffix: "GEC",
  fields: [
    { name: "evaluateur", label: "Évaluateur", type: "text" },
    { name: "noteCompetences", label: "Note - Compétences techniques (/5)", type: "text", placeholder: "ex : 4" },
    { name: "noteExperience", label: "Note - Expérience (/5)", type: "text", placeholder: "ex : 3" },
    { name: "noteCommunication", label: "Note - Communication (/5)", type: "text", placeholder: "ex : 5" },
    { name: "noteMotivation", label: "Note - Motivation (/5)", type: "text", placeholder: "ex : 4" },
    { name: "appreciationGlobale", label: "Appréciation globale", type: "textarea" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Grille d'Évaluation du Candidat",
      refCode: rc(c, "GEC"),
      confidentiel: true,
      body: `
  ${blocInfos(
    ligne("Candidat(e)", candidat(c)) +
    ligne("Poste", c.posteTitre) +
    ligne("Évaluateur", p.evaluateur),
  )}
  <table style="width:100%; border-collapse:collapse; margin-top:12px;">
    <thead>
      <tr>
        <th style="border:1px solid #ccc; padding:8px; background:#f0f0f0; text-align:left;">Critère</th>
        <th style="border:1px solid #ccc; padding:8px; background:#f0f0f0;">Note / 5</th>
      </tr>
    </thead>
    <tbody>
      <tr><td style="border:1px solid #ccc; padding:8px;">Compétences techniques</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${p.noteCompetences || "-"}</td></tr>
      <tr><td style="border:1px solid #ccc; padding:8px;">Expérience</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${p.noteExperience || "-"}</td></tr>
      <tr><td style="border:1px solid #ccc; padding:8px;">Communication</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${p.noteCommunication || "-"}</td></tr>
      <tr><td style="border:1px solid #ccc; padding:8px;">Motivation</td><td style="border:1px solid #ccc; padding:8px; text-align:center;">${p.noteMotivation || "-"}</td></tr>
    </tbody>
  </table>
  ${p.appreciationGlobale ? `<p style="line-height:1.8; text-align:justify; margin-top:16px;"><strong>Appréciation globale.</strong> ${p.appreciationGlobale}</p>` : ""}
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

// ── Rapport d'entretien (candidature) ─────────────────────────────────────────
const rapportEntretien: RecrutementDocTemplate = {
  type: "RAPPORT_ENTRETIEN",
  label: "Rapport d'entretien",
  scope: "candidature",
  refSuffix: "RAE",
  fields: [
    { name: "dateEntretienRealise", label: "Date de l'entretien réalisé", type: "date", required: true },
    { name: "interlocuteurs", label: "Interlocuteurs présents", type: "text" },
    { name: "synthese", label: "Synthèse de l'entretien", type: "textarea" },
    { name: "recommandation", label: "Recommandation", type: "text", placeholder: "ex : Favorable, à retenir pour la suite du processus" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Rapport d'Entretien",
      refCode: rc(c, "RAE"),
      confidentiel: true,
      body: `
  ${blocInfos(
    ligne("Candidat(e)", candidat(c)) +
    ligne("Poste", c.posteTitre) +
    ligne("Date de l'entretien", formatDateFr(p.dateEntretienRealise)) +
    ligne("Interlocuteurs présents", p.interlocuteurs),
  )}
  ${p.synthese ? `<p style="line-height:1.8; text-align:justify;"><strong>Synthèse.</strong> ${p.synthese}</p>` : ""}
  ${p.recommandation ? `<p style="line-height:1.8; text-align:justify;"><strong>Recommandation.</strong> ${p.recommandation}</p>` : ""}
  <div style="margin-top:40px; text-align:right;"><p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

const ALL: RecrutementDocTemplate[] = [
  avisRecrutement,
  convocationEntretien,
  lettreOffre,
  lettreRefus,
  promesseEmbauche,
  pvSelection,
  ficheCreationPoste,
  descriptionPoste,
  profilPoste,
  demandeRecrutement,
  grillePreselection,
  guideEntretien,
  grilleEvaluationCandidats,
  rapportEntretien,
];

const BY_TYPE = new Map<string, RecrutementDocTemplate>(ALL.map((t) => [t.type, t]));

export function getRecrutementTemplate(type: string): RecrutementDocTemplate | undefined {
  return BY_TYPE.get(type);
}

/** Métadonnées (type + libellé + scope + champs) pour les formulaires côté UI. */
export function listRecrutementMeta(): { type: string; label: string; scope: "poste" | "candidature"; fields: FieldSpec[] }[] {
  return ALL.map((t) => ({ type: t.type, label: t.label, scope: t.scope, fields: t.fields }));
}
