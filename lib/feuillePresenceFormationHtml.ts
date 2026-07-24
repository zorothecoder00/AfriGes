// lib/feuillePresenceFormationHtml.ts
// Feuille de présence imprimable pour UNE session de formation (multi-collaborateurs).
// Hors moteur RhDocTemplate (pensé "1 template = 1 collaborateur") — gabarit ad hoc.

import { docShell, ligne, blocInfos, formatDateFr } from "@/lib/rhDocTemplates/shell";

export interface FeuillePresenceFormationData {
  id: number; titre: string; lieu: string | null; formateur: string | null;
  dateDebut: Date | string; dateFin: Date | string | null; dureeHeures: number | null;
  participants: { matricule: string; fonction: string | null; nom: string; prenom: string }[];
}

export function genFeuillePresenceFormationHtml(f: FeuillePresenceFormationData): string {
  const rows = f.participants.map((p, i) => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #ddd; text-align:center;">${i + 1}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${p.prenom} ${p.nom}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; font-family:monospace;">${p.matricule}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd;">${p.fonction ?? ""}</td>
      <td style="padding:8px; border-bottom:1px solid #ddd; width:160px;"></td>
    </tr>`).join("");

  const body = `
    ${blocInfos([
      ligne("Formation", f.titre),
      ligne("Formateur / organisme", f.formateur),
      ligne("Lieu", f.lieu),
      ligne("Dates", f.dateFin ? `du ${formatDateFr(f.dateDebut)} au ${formatDateFr(f.dateFin)}` : formatDateFr(f.dateDebut)),
      ligne("Durée", f.dureeHeures ? `${f.dureeHeures} heures` : null),
    ].join(""))}

    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:16px;">
      <thead>
        <tr style="background:#f1f1f1;">
          <th style="padding:8px; text-align:center; width:36px;">#</th>
          <th style="padding:8px; text-align:left;">Nom et prénom</th>
          <th style="padding:8px; text-align:left;">Matricule</th>
          <th style="padding:8px; text-align:left;">Fonction</th>
          <th style="padding:8px; text-align:left;">Signature</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" style="padding:12px; text-align:center; color:#999;">Aucun participant inscrit</td></tr>`}</tbody>
    </table>
  `;

  return docShell({
    titre: "Feuille de présence",
    sousTitre: f.titre,
    refCode: `FPF-${f.id}`,
    body,
  });
}
