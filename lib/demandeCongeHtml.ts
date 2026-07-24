// lib/demandeCongeHtml.ts
// Vue imprimable (demande / autorisation) d'une DemandeConge. Réutilise
// l'enveloppe société de lib/rhDocTemplates/shell.ts.

import { docShell, ligne, blocInfos, signatures, formatDateFr } from "@/lib/rhDocTemplates/shell";

const TYPE_LABEL: Record<string, string> = {
  ANNUEL: "Congé annuel", MALADIE: "Maladie", EXCEPTIONNEL: "Exceptionnel",
  PERMISSION: "Permission", FORMATION: "Formation", MATERNITE: "Maternité",
  PATERNITE: "Paternité", SANS_SOLDE: "Sans solde",
};

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente", VALIDE_MANAGER: "Validé manager", VALIDE_RH: "Validé RH",
  APPROUVE: "Approuvé", REJETE: "Rejeté", ANNULE: "Annulé",
};

export interface DemandeCongeData {
  id: number; type: string; statut: string;
  dateDebut: Date | string; dateFin: Date | string; nbJours: number;
  motif: string | null; commentaireRefus: string | null;
  dateValidationMgr: Date | string | null;
  dateValidationRH: Date | string | null;
  dateDecisionFinale: Date | string | null;
  createdAt: Date | string;
  profilRH: { matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
}

export function genDemandeCongeHtml(d: DemandeCongeData): string {
  const estApprouve = d.statut === "APPROUVE";
  const titre = estApprouve ? "Autorisation de congé" : "Demande de congé";

  const body = `
    ${blocInfos([
      ligne("Collaborateur", `${d.profilRH.prenom} ${d.profilRH.nom}`),
      ligne("Matricule", d.profilRH.matricule),
      ligne("Fonction", d.profilRH.fonction),
      ligne("Département", d.profilRH.departement),
      ligne("Type de congé", TYPE_LABEL[d.type] ?? d.type),
      ligne("Période", `du ${formatDateFr(d.dateDebut)} au ${formatDateFr(d.dateFin)}`),
      ligne("Nombre de jours", String(d.nbJours)),
      ligne("Motif", d.motif),
      ligne("Date de la demande", formatDateFr(d.createdAt)),
    ].join(""))}

    <div style="margin-top:24px;">
      <p style="margin:0 0 8px; font-weight:bold;">Statut : ${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.dateValidationMgr ? `<p style="margin:2px 0; font-size:13px;">Validation manager : ${formatDateFr(d.dateValidationMgr)}</p>` : ""}
      ${d.dateValidationRH  ? `<p style="margin:2px 0; font-size:13px;">Validation RH : ${formatDateFr(d.dateValidationRH)}</p>` : ""}
      ${d.dateDecisionFinale ? `<p style="margin:2px 0; font-size:13px;">Décision finale : ${formatDateFr(d.dateDecisionFinale)}</p>` : ""}
      ${d.statut === "REJETE" && d.commentaireRefus ? `<p style="margin:8px 0; font-size:13px; color:#b91c1c;"><strong>Motif du refus :</strong> ${d.commentaireRefus}</p>` : ""}
    </div>

    ${signatures({ role: "Le collaborateur", nom: `${d.profilRH.prenom} ${d.profilRH.nom}` }, { role: "Le responsable RH" })}
  `;

  return docShell({
    titre,
    sousTitre: TYPE_LABEL[d.type] ?? d.type,
    refCode: `CGE-${d.id}`,
    body,
  });
}
