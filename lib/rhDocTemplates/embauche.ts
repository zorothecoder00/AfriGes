// lib/rhDocTemplates/embauche.ts
// Documents d'embauche (nature A) : contrats CDI / CDD / stage et avenant.
// Gabarits standard éditables (clauses génériques raisonnables, non OHADA-certifiées).

import type { RhDocTemplate } from "./types";
import { refCode } from "./types";
import { docShell, blocInfos, ligne, signatures, formatDateFr } from "./shell";
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

const contratApprentissage: RhDocTemplate = {
  type: "CONTRAT_APPRENTISSAGE",
  label: "Contrat d'apprentissage",
  refSuffix: "APP",
  fields: [
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin", type: "date", required: true },
    { name: "metierAppris", label: "Métier / qualification préparée", type: "text", required: true, placeholder: "ex : Mécanicien, Comptable…" },
    { name: "centreFormation", label: "Centre de formation associé", type: "text", placeholder: "Établissement d'enseignement technique" },
    { name: "maitreApprentissage", label: "Maître d'apprentissage", type: "text", placeholder: "Nom du tuteur désigné" },
    { name: "allocation", label: "Allocation / rémunération d'apprentissage", type: "text", placeholder: "ex : 40 000 FCFA (facultatif)" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Contrat d'Apprentissage",
      refCode: refCode(c.matricule, "APP"),
      body: `
  ${parties(c.prenom, c.nom, c.matricule, "l'Apprenti(e)")}
  ${art(1, "Objet", `Le présent contrat a pour objet de préparer l'Apprenti(e) au métier de <strong>${p.metierAppris}</strong>${p.centreFormation ? `, en liaison avec <strong>${p.centreFormation}</strong>` : ""}.`)}
  ${art(2, "Durée", `Le contrat est conclu du <strong>${formatDateFr(p.dateDebut)}</strong> au <strong>${formatDateFr(p.dateFin)}</strong>.`)}
  ${art(3, "Encadrement", p.maitreApprentissage ? `L'Apprenti(e) est placé(e) sous la responsabilité de <strong>${p.maitreApprentissage}</strong>, maître d'apprentissage.` : "L'Apprenti(e) est placé(e) sous la responsabilité d'un maître d'apprentissage désigné par l'Employeur.")}
  ${art(4, "Allocation", p.allocation ? `L'Apprenti(e) percevra une allocation d'apprentissage de <strong>${p.allocation}</strong>.` : "Les modalités de rémunération, le cas échéant, sont conformes à la réglementation applicable à l'apprentissage.")}
  ${art(5, "Obligations", "L'Apprenti(e) s'engage à suivre assidûment la formation pratique et théorique, et à respecter le règlement intérieur de l'Employeur.")}
  ${faitLe(c.today)}
  ${signatures({ role: "L'Apprenti(e)", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const contratPrestation: RhDocTemplate = {
  type: "CONTRAT_PRESTATION",
  label: "Contrat de prestation",
  refSuffix: "PRE",
  fields: [
    { name: "objetPrestation", label: "Objet de la prestation", type: "textarea", required: true, placeholder: "Nature des services rendus" },
    { name: "dateDebut", label: "Date de début", type: "date", required: true },
    { name: "dateFin", label: "Date de fin (facultatif)", type: "date" },
    { name: "honoraires", label: "Honoraires / rémunération", type: "text", required: true, placeholder: "ex : 150 000 FCFA / mission" },
    { name: "modalitesPaiement", label: "Modalités de paiement", type: "text", placeholder: "ex : à la livraison, mensuel…" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Contrat de Prestation de Services",
      refCode: refCode(c.matricule, "PRE"),
      body: `
  ${parties(c.prenom, c.nom, c.matricule, "le Prestataire")}
  ${art(1, "Objet", `Le Prestataire s'engage à réaliser, en toute indépendance, la prestation suivante : <em>${p.objetPrestation}</em>.`)}
  ${art(2, "Durée", `La prestation débute le <strong>${formatDateFr(p.dateDebut)}</strong>${p.dateFin ? ` et prend fin le <strong>${formatDateFr(p.dateFin)}</strong>` : ", pour une durée déterminée par la mission"}.`)}
  ${art(3, "Rémunération", `En contrepartie, le Prestataire percevra des honoraires de <strong>${p.honoraires}</strong>${p.modalitesPaiement ? `, payables ${p.modalitesPaiement}` : ""}.`)}
  ${art(4, "Statut", "Le Prestataire exerce sa mission en toute indépendance, hors de tout lien de subordination, et demeure responsable de ses obligations sociales et fiscales propres. Le présent contrat ne constitue pas un contrat de travail.")}
  ${art(5, "Confidentialité", "Le Prestataire s'engage à garder confidentielles toutes les informations dont il aurait connaissance à l'occasion de sa mission.")}
  ${faitLe(c.today)}
  ${signatures({ role: "Le Prestataire", sousTitre: "(Lu et approuvé)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const ficheIndividuelleSalarie: RhDocTemplate = {
  type: "FICHE_INDIVIDUELLE_SALARIE",
  label: "Fiche individuelle du salarié",
  refSuffix: "FIS",
  fields: [
    { name: "situationFamiliale", label: "Situation familiale", type: "text", placeholder: "ex : Marié(e), 2 enfants" },
    { name: "adressePersonnelle", label: "Adresse personnelle", type: "text" },
    { name: "telephonePersonnel", label: "Téléphone personnel", type: "text" },
    { name: "diplome", label: "Diplôme le plus élevé", type: "text" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Fiche Individuelle du Salarié",
      refCode: refCode(c.matricule, "FIS"),
      body: `
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Fonction", c.fonction) +
    ligne("Département", c.departement) +
    ligne("Service", c.service) +
    ligne("Type de contrat", c.typeContrat) +
    ligne("Date d'embauche", c.dateEmbauche ? formatDateFr(c.dateEmbauche) : null) +
    ligne("Email professionnel", c.emailPro),
  )}
  ${blocInfos(
    ligne("Situation familiale", p.situationFamiliale) +
    ligne("Adresse personnelle", p.adressePersonnelle) +
    ligne("Téléphone personnel", p.telephonePersonnel) +
    ligne("Diplôme le plus élevé", p.diplome) || ligne("Coordonnées", "Voir dossier administratif"),
  )}
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">Fiche établie et conservée dans le dossier personnel du salarié, à mettre à jour à chaque changement de situation.</p>
  <div style="margin-top:32px; text-align:right;"><p style="margin:0;">Fiche mise à jour le <strong>${formatDateFr(c.today)}</strong></p></div>`,
    }),
};

const ficheRenseignementsPersonnel: RhDocTemplate = {
  type: "FICHE_RENSEIGNEMENTS_PERSONNEL",
  label: "Fiche de renseignements du personnel",
  refSuffix: "FRP",
  fields: [
    { name: "dateNaissance", label: "Date de naissance", type: "date" },
    { name: "lieuNaissance", label: "Lieu de naissance", type: "text" },
    { name: "nationalite", label: "Nationalité", type: "text" },
    { name: "numeroCNI", label: "N° pièce d'identité", type: "text" },
    { name: "contactUrgenceNom", label: "Personne à contacter en cas d'urgence", type: "text" },
    { name: "contactUrgenceTel", label: "Téléphone du contact d'urgence", type: "text" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Fiche de Renseignements du Personnel",
      refCode: refCode(c.matricule, "FRP"),
      body: `
  ${blocInfos(
    ligne("Nom et Prénom", `${c.prenom} ${c.nom}`) +
    ligne("Matricule", c.matricule) +
    ligne("Date de naissance", p.dateNaissance ? formatDateFr(p.dateNaissance) : null) +
    ligne("Lieu de naissance", p.lieuNaissance) +
    ligne("Nationalité", p.nationalite) +
    ligne("N° pièce d'identité", p.numeroCNI),
  )}
  ${blocInfos(
    ligne("Fonction", c.fonction) +
    ligne("Département", c.departement) +
    ligne("Date d'embauche", c.dateEmbauche ? formatDateFr(c.dateEmbauche) : null),
  )}
  ${blocInfos(
    ligne("Personne à contacter en cas d'urgence", p.contactUrgenceNom) +
    ligne("Téléphone", p.contactUrgenceTel),
  )}
  <p style="line-height:1.8; text-align:justify; margin-top:12px;">Le/la salarié(e) s'engage à signaler sans délai toute modification de ces renseignements au service des Ressources Humaines.</p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Renseignements exacts et à jour)", nom: `${c.prenom} ${c.nom}` }, { role: "Ressources Humaines" })}`,
    }),
};

const declarationPriseService: RhDocTemplate = {
  type: "DECLARATION_PRISE_SERVICE",
  label: "Déclaration de prise de service",
  refSuffix: "DPS",
  fields: [
    { name: "dateEffective", label: "Date effective de prise de service", type: "date", required: true },
    { name: "lieuPrise", label: "Lieu de prise de service", type: "text" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Déclaration de Prise de Service",
      refCode: refCode(c.matricule, "DPS"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}${c.fonction ? `, ${c.fonction}` : ""},
    déclare avoir effectivement pris mes fonctions au sein de <strong>${SOCIETE.nom}</strong>
    le <strong>${formatDateFr(p.dateEffective)}</strong>${p.lieuPrise ? `, à ${p.lieuPrise}` : ""}.
  </p>
  ${signatures({ role: "Le/la Salarié(e)", nom: `${c.prenom} ${c.nom}` }, { role: "Responsable hiérarchique / RH" })}`,
    }),
};

const accuseReceptionDocuments: RhDocTemplate = {
  type: "ACCUSE_RECEPTION_DOCUMENTS",
  label: "Accusé de réception des documents d'embauche",
  refSuffix: "ARD",
  fields: [
    { name: "listeDocuments", label: "Documents remis (un par ligne)", type: "textarea", required: true, placeholder: "ex : Contrat de travail\nRèglement intérieur\nFiche de poste" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Accusé de Réception des Documents d'Embauche",
      refCode: refCode(c.matricule, "ARD"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}, reconnais avoir reçu
    de <strong>${SOCIETE.nom}</strong> les documents suivants :
  </p>
  ${blocInfos(`<p style="margin:0; white-space:pre-line;">${p.listeDocuments}</p>`)}
  <p style="line-height:1.8; text-align:justify;">Je déclare en avoir pris connaissance et m'engage à m'y conformer.</p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Documents reçus)", nom: `${c.prenom} ${c.nom}` }, { role: "Ressources Humaines" })}`,
    }),
};

const listePiecesAdministratives: RhDocTemplate = {
  type: "LISTE_PIECES_ADMINISTRATIVES",
  label: "Liste des pièces administratives",
  refSuffix: "LPA",
  fields: [
    { name: "piecesRequises", label: "Pièces requises (une par ligne)", type: "textarea", required: true, placeholder: "ex : CV\nPièce d'identité\nDiplômes\nCasier judiciaire\nCertificat médical\nAttestation CNSS\nCoordonnées bancaires" },
    { name: "dateLimiteDepot", label: "Date limite de dépôt", type: "date" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Liste des Pièces Administratives à Fournir",
      refCode: refCode(c.matricule, "LPA"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Dans le cadre de la constitution du dossier administratif de <strong>${c.prenom} ${c.nom}</strong>
    (Matricule ${c.matricule}), les pièces suivantes sont à fournir au service des Ressources Humaines
    ${p.dateLimiteDepot ? `au plus tard le <strong>${formatDateFr(p.dateLimiteDepot)}</strong>` : ""} :
  </p>
  ${blocInfos(`<p style="margin:0; white-space:pre-line;">${p.piecesRequises}</p>`)}
  <div style="margin-top:40px; text-align:right;">
    <p style="margin:0;">Établi le <strong>${formatDateFr(c.today)}</strong></p>
    <div style="margin-top:48px;"><p style="font-weight:bold; text-transform:uppercase; margin:0;">Ressources Humaines</p></div>
  </div>`,
    }),
};

const charteConfidentialite: RhDocTemplate = {
  type: "CHARTE_CONFIDENTIALITE",
  label: "Charte de confidentialité",
  refSuffix: "CHC",
  fields: [
    { name: "perimetre", label: "Périmètre des informations concernées", type: "textarea", placeholder: "ex : données clients, données financières, secrets commerciaux…" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Charte de Confidentialité",
      refCode: refCode(c.matricule, "CHC"),
      confidentiel: true,
      body: `
  <p style="line-height:1.8; text-align:justify;">
    La présente charte rappelle à <strong>${c.prenom} ${c.nom}</strong> (Matricule ${c.matricule}) les règles de
    confidentialité applicables au sein de <strong>${SOCIETE.nom}</strong>.
  </p>
  ${art(1, "Informations concernées", p.perimetre || "Toute information relative aux clients, aux salariés, aux données financières, techniques ou commerciales de l'Employeur, non publiquement accessible.")}
  ${art(2, "Obligation de confidentialité", "Le/la Salarié(e) s'engage à ne divulguer, ni pendant ni après la relation de travail, aucune information confidentielle à des tiers non autorisés.")}
  ${art(3, "Usage interne", "Les informations confidentielles ne peuvent être utilisées que dans le cadre strict de l'exercice des fonctions du/de la Salarié(e).")}
  ${art(4, "Sanctions", "Tout manquement à la présente charte est susceptible d'engager la responsabilité disciplinaire, civile et/ou pénale de son auteur.")}
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Pris connaissance et engagement à respecter)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const engagementConfidentialite: RhDocTemplate = {
  type: "ENGAGEMENT_CONFIDENTIALITE",
  label: "Engagement de confidentialité",
  refSuffix: "ECO",
  fields: [
    { name: "dureeEngagement", label: "Durée de l'engagement après la fin du contrat", type: "text", placeholder: "ex : 2 ans" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Engagement de Confidentialité",
      refCode: refCode(c.matricule, "ECO"),
      confidentiel: true,
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}${c.fonction ? `, ${c.fonction}` : ""},
    m'engage par la présente à garder strictement confidentielles toutes les informations dont j'aurais
    connaissance dans le cadre de mes fonctions au sein de <strong>${SOCIETE.nom}</strong>,
    ${p.dureeEngagement ? `y compris pendant une durée de <strong>${p.dureeEngagement}</strong> après la cessation de mon contrat de travail` : "y compris après la cessation de mon contrat de travail"}.
  </p>
  <p style="line-height:1.8; text-align:justify;">Je reconnais que tout manquement à cet engagement m'expose à des sanctions disciplinaires et, le cas échéant, à des poursuites judiciaires.</p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Bon pour engagement)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const engagementNonConcurrence: RhDocTemplate = {
  type: "ENGAGEMENT_NON_CONCURRENCE",
  label: "Engagement de non-concurrence",
  refSuffix: "ENC",
  fields: [
    { name: "dureeInterdiction", label: "Durée de l'interdiction après la fin du contrat", type: "text", required: true, placeholder: "ex : 1 an" },
    { name: "zoneGeographique", label: "Zone géographique concernée", type: "text", placeholder: "ex : territoire national" },
    { name: "contrepartie", label: "Contrepartie financière (le cas échéant)", type: "text", placeholder: "facultatif" },
  ],
  render: (c, p) =>
    docShell({
      titre: "Engagement de Non-Concurrence",
      refCode: refCode(c.matricule, "ENC"),
      confidentiel: true,
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}${c.fonction ? `, ${c.fonction}` : ""},
    m'engage à ne pas exercer, directement ou indirectement, une activité concurrente de celle de
    <strong>${SOCIETE.nom}</strong>${p.zoneGeographique ? ` sur ${p.zoneGeographique}` : ""},
    pendant une durée de <strong>${p.dureeInterdiction}</strong> à compter de la cessation de mon contrat de travail.
  </p>
  ${p.contrepartie ? `<p style="line-height:1.8; text-align:justify;">En contrepartie de cette obligation, l'Employeur versera au/à la Salarié(e) : <strong>${p.contrepartie}</strong>.</p>` : ""}
  <p style="line-height:1.8; text-align:justify;">Le non-respect de cet engagement m'expose à réparation du préjudice subi par l'Employeur.</p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Bon pour engagement)", nom: `${c.prenom} ${c.nom}` }, { role: "Pour l'Employeur", sousTitre: "La Direction" })}`,
    }),
};

const engagementReglementInterieur: RhDocTemplate = {
  type: "ENGAGEMENT_REGLEMENT_INTERIEUR",
  label: "Engagement au respect du règlement intérieur",
  refSuffix: "ERI",
  fields: [],
  render: (c) =>
    docShell({
      titre: "Engagement au Respect du Règlement Intérieur",
      refCode: refCode(c.matricule, "ERI"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Je soussigné(e) <strong>${c.prenom} ${c.nom}</strong>, Matricule ${c.matricule}${c.fonction ? `, ${c.fonction}` : ""},
    déclare avoir reçu communication et pris connaissance du règlement intérieur de
    <strong>${SOCIETE.nom}</strong>, et m'engage à en respecter scrupuleusement toutes les dispositions.
  </p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Pris connaissance et engagement à respecter)", nom: `${c.prenom} ${c.nom}` }, { role: "Ressources Humaines" })}`,
    }),
};

const ficheRemiseMateriel: RhDocTemplate = {
  type: "FICHE_REMISE_MATERIEL",
  label: "Fiche de remise du matériel",
  refSuffix: "FRM",
  fields: [
    { name: "materielRemis", label: "Matériel remis (un par ligne, avec référence si possible)", type: "textarea", required: true, placeholder: "ex : Ordinateur portable HP - SN123456\nTéléphone professionnel\nBadge d'accès n°45" },
    { name: "dateRemise", label: "Date de remise", type: "date", required: true },
  ],
  render: (c, p) =>
    docShell({
      titre: "Fiche de Remise du Matériel",
      refCode: refCode(c.matricule, "FRM"),
      body: `
  <p style="line-height:1.8; text-align:justify;">
    Le matériel ci-dessous a été remis à <strong>${c.prenom} ${c.nom}</strong> (Matricule ${c.matricule})
    le <strong>${formatDateFr(p.dateRemise)}</strong> :
  </p>
  ${blocInfos(`<p style="margin:0; white-space:pre-line;">${p.materielRemis}</p>`)}
  <p style="line-height:1.8; text-align:justify;">
    Le/la Salarié(e) s'engage à prendre soin de ce matériel, à en faire un usage strictement professionnel
    et à le restituer en bon état à la fin de son contrat ou sur simple demande de l'Employeur.
  </p>
  ${signatures({ role: "Le/la Salarié(e)", sousTitre: "(Matériel reçu, bon état constaté)", nom: `${c.prenom} ${c.nom}` }, { role: "Service Logistique / RH" })}`,
    }),
};

export const templatesEmbauche: RhDocTemplate[] = [
  contratCDI,
  contratCDD,
  contratStage,
  avenantContrat,
  contratApprentissage,
  contratPrestation,
  ficheIndividuelleSalarie,
  ficheRenseignementsPersonnel,
  declarationPriseService,
  accuseReceptionDocuments,
  listePiecesAdministratives,
  charteConfidentialite,
  engagementConfidentialite,
  engagementNonConcurrence,
  engagementReglementInterieur,
  ficheRemiseMateriel,
];
