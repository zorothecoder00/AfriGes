// lib/feuillePointageHtml.ts
// Feuille de pointage mensuelle imprimable pour UN collaborateur (PDF serveur).
// Réutilise l'enveloppe société de lib/rhDocTemplates/shell.ts.

import { docShell, ligne, blocInfos, signatures } from "@/lib/rhDocTemplates/shell";

const STATUT_LABEL: Record<string, string> = {
  PRESENT: "Présent", ABSENT: "Absent", RETARD: "Retard",
  DEMI_JOURNEE: "Demi-journée", CONGE: "Congé", MISSION: "Mission", FERIE: "Férié",
};

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export interface FeuillePointageEntry {
  date: string | Date;
  statut: string;
  heureArrivee: string | Date | null;
  heureDepart: string | Date | null;
  tempsTotal: number | null;
  retardMinutes: number | null;
  heuresSup: number | null;
  justificatif: string | null;
  notes: string | null;
}

export interface FeuillePointageData {
  profilRH: { matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
  mois: number; annee: number;
  pointages: FeuillePointageEntry[];
}

function fmtHeure(v: string | Date | null): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmtMinutes(min: number | null): string {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function genFeuillePointageHtml(data: FeuillePointageData): string {
  const { profilRH, mois, annee, pointages } = data;

  const rows = pointages.map((p) => {
    const d = typeof p.date === "string" ? new Date(p.date) : p.date;
    const dateStr = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
    return `
      <tr>
        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${dateStr}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${STATUT_LABEL[p.statut] ?? p.statut}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${fmtHeure(p.heureArrivee)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${fmtHeure(p.heureDepart)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${fmtMinutes(p.tempsTotal)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee; text-align:center;">${p.retardMinutes ? fmtMinutes(p.retardMinutes) : "—"}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #eee;">${p.notes ?? ""}</td>
      </tr>`;
  }).join("");

  const totalPresents = pointages.filter((p) => p.statut === "PRESENT").length;
  const totalAbsents  = pointages.filter((p) => p.statut === "ABSENT").length;
  const totalRetards  = pointages.filter((p) => p.statut === "RETARD").length;
  const totalConges   = pointages.filter((p) => p.statut === "CONGE").length;

  const body = `
    ${blocInfos([
      ligne("Collaborateur", `${profilRH.prenom} ${profilRH.nom}`),
      ligne("Matricule", profilRH.matricule),
      ligne("Fonction", profilRH.fonction),
      ligne("Département", profilRH.departement),
      ligne("Période", `${MOIS_LABELS[mois - 1]} ${annee}`),
    ].join(""))}

    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:16px;">
      <thead>
        <tr style="background:#f1f1f1;">
          <th style="padding:6px 8px; text-align:left;">Date</th>
          <th style="padding:6px 8px; text-align:left;">Statut</th>
          <th style="padding:6px 8px; text-align:center;">Arrivée</th>
          <th style="padding:6px 8px; text-align:center;">Départ</th>
          <th style="padding:6px 8px; text-align:center;">Temps travaillé</th>
          <th style="padding:6px 8px; text-align:center;">Retard</th>
          <th style="padding:6px 8px; text-align:left;">Notes</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7" style="padding:12px; text-align:center; color:#999;">Aucun pointage sur la période</td></tr>`}</tbody>
    </table>

    <div style="margin-top:20px; display:flex; gap:24px; font-size:12px;">
      <span><strong>${totalPresents}</strong> présent(s)</span>
      <span><strong>${totalAbsents}</strong> absent(s)</span>
      <span><strong>${totalRetards}</strong> retard(s)</span>
      <span><strong>${totalConges}</strong> congé(s)</span>
    </div>

    ${signatures({ role: "Le collaborateur", nom: `${profilRH.prenom} ${profilRH.nom}` }, { role: "Le responsable RH" })}
  `;

  return docShell({
    titre: "Feuille de pointage",
    sousTitre: `${MOIS_LABELS[mois - 1]} ${annee}`,
    refCode: `PTG-${profilRH.matricule}-${annee}${String(mois).padStart(2, "0")}`,
    body,
  });
}
