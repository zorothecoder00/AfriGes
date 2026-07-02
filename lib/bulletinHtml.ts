/**
 * lib/bulletinHtml.ts — Gabarit HTML serveur du bulletin de paie.
 *
 * Reproduit la mise en page de la page React `paie/[id]/bulletin` en HTML
 * autonome (CSS inline) pour être rendu en PDF par `lib/pdf.ts` (Chromium).
 */

import { escapeHtml } from "@/lib/pdf";
import { grouperComposantsPaie } from "@/lib/composantsPaie";

const MOIS = [
  "", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

const formatDate = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

export interface BulletinComposant {
  type: string;
  libelle: string;
  montant: number;
  isRetenue: boolean;
}

export interface BulletinData {
  id: number;
  mois: number;
  annee: number;
  salaireBase: number;
  totalBrut: number;
  totalRetenues: number;
  netAPayer: number;
  notes: string | null;
  modePaiement: string | null;
  composants: BulletinComposant[];
  profilRH: {
    matricule: string;
    fonction: string | null;
    departement: string | null;
    dateEmbauche: string | Date | null;
    gestionnaire: { member: { nom: string; prenom: string } };
  };
}

export function genBulletinHtml(f: BulletinData): string {
  const m = f.profilRH.gestionnaire.member;
  const { fixe, variable, deductions, totalFixe, totalVariable, totalDeductions } =
    grouperComposantsPaie(f.composants, Number(f.salaireBase));

  const ligne = (libelle: string, montant: string, color: string) => `
    <tr>
      <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;">${escapeHtml(libelle)}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:600;text-align:right;color:${color};font-variant-numeric:tabular-nums;">${montant}</td>
    </tr>`;

  const ligneTotal = (libelle: string, montant: string, color: string) => `
    <tr style="background:#f8fafc;">
      <td style="padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:#475569;">${escapeHtml(libelle)}</td>
      <td style="padding:8px 12px;font-size:13px;font-weight:700;text-align:right;color:${color};font-variant-numeric:tabular-nums;">${montant}</td>
    </tr>`;

  /** Bloc titré : en-tête + lignes + ligne de sous-total. */
  const bloc = (titre: string, color: string, rows: string, totalLabel: string, totalStr: string) => rows ? `
    <table style="border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;overflow:hidden;margin-top:16px;">
      <tr style="background:#f8fafc;">
        <td style="padding:7px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};">${titre}</td>
        <td style="padding:7px 12px;font-size:11px;font-weight:600;text-transform:uppercase;text-align:right;color:#64748b;">Montant (FCFA)</td>
      </tr>
      ${rows}
      ${ligneTotal(totalLabel, totalStr, color)}
    </table>` : "";

  // Bloc « Salaire fixe » : salaire de base + composants fixes.
  const rowsFixe =
    ligne("Salaire de base", fmt(f.salaireBase), "#0f172a") +
    fixe.map((c) => ligne(c.libelle, "+ " + fmt(c.montant), "#047857")).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Bulletin de paie ${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1e293b; margin: 0; }
  table { border-collapse: collapse; width: 100%; }
</style></head>
<body>
  <div style="max-width:680px;margin:0 auto;padding:8px 4px;">

    <!-- En-tête société -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #059669;padding-bottom:16px;margin-bottom:20px;">
      <div>
        <div style="font-size:24px;font-weight:bold;color:#047857;">AfriGes</div>
        <div style="font-size:11px;color:#64748b;">Gestion RH &amp; Paie</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:bold;text-transform:uppercase;letter-spacing:.15em;color:#1e293b;">Bulletin de Paie</div>
        <div style="font-size:13px;color:#475569;margin-top:2px;">${MOIS[f.mois] ?? ""} ${f.annee}</div>
        <div style="font-size:11px;color:#94a3b8;">Fiche n° ${f.id}</div>
      </div>
    </div>

    <!-- Infos employé -->
    <table style="margin-bottom:20px;"><tr>
      <td style="vertical-align:top;width:50%;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px;">Employé</p>
        <p style="font-size:17px;font-weight:bold;color:#0f172a;margin:0;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</p>
        <p style="font-size:13px;color:#64748b;margin:3px 0 0;">Matricule : <span style="font-family:monospace;font-weight:600;color:#334155;">${escapeHtml(f.profilRH.matricule)}</span></p>
        ${f.profilRH.fonction ? `<p style="font-size:13px;color:#64748b;margin:3px 0 0;">Poste : <span style="font-weight:600;color:#334155;">${escapeHtml(f.profilRH.fonction)}</span></p>` : ""}
        ${f.profilRH.departement ? `<p style="font-size:13px;color:#64748b;margin:3px 0 0;">Département : <span style="font-weight:600;color:#334155;">${escapeHtml(f.profilRH.departement)}</span></p>` : ""}
      </td>
      <td style="vertical-align:top;width:50%;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;margin:0 0 6px;">Période</p>
        <p style="font-size:13px;color:#334155;margin:0;"><b>Période de paie :</b> ${MOIS[f.mois] ?? ""} ${f.annee}</p>
        ${f.profilRH.dateEmbauche ? `<p style="font-size:13px;color:#334155;margin:3px 0 0;"><b>Date d'embauche :</b> ${formatDate(f.profilRH.dateEmbauche)}</p>` : ""}
        ${f.modePaiement ? `<p style="font-size:13px;color:#334155;margin:3px 0 0;"><b>Mode de paiement :</b> ${escapeHtml(f.modePaiement.replace("_", " "))}</p>` : ""}
        <p style="font-size:13px;color:#334155;margin:3px 0 0;"><b>Date d'émission :</b> ${formatDate(new Date().toISOString())}</p>
      </td>
    </tr></table>

    <!-- Salaire fixe -->
    ${bloc("Salaire fixe", "#047857", rowsFixe, "Total salaire fixe", fmt(totalFixe))}

    <!-- Salaire variable -->
    ${bloc("Salaire variable", "#047857", variable.map((c) => ligne(c.libelle, "+ " + fmt(c.montant), "#047857")).join(""), "Total salaire variable", "+ " + fmt(totalVariable))}

    <!-- Déductions -->
    ${bloc("Déductions", "#dc2626", deductions.map((c) => ligne(c.libelle, "- " + fmt(c.montant), "#dc2626")).join(""), "Total déductions", "- " + fmt(totalDeductions))}

    <!-- Récapitulatif -->
    <table style="border:1px solid #cbd5e1;border-radius:10px;border-collapse:separate;overflow:hidden;margin-top:18px;">
      <tr style="background:#f8fafc;">
        <td style="padding:9px 16px;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Salaire brut total</td>
        <td style="padding:9px 16px;font-size:13px;font-weight:600;text-align:right;color:#1e293b;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">${fmt(f.totalBrut)} FCFA</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:9px 16px;font-size:13px;color:#475569;border-bottom:1px solid #e2e8f0;">Total des retenues</td>
        <td style="padding:9px 16px;font-size:13px;font-weight:600;text-align:right;color:#dc2626;border-bottom:1px solid #e2e8f0;font-variant-numeric:tabular-nums;">- ${fmt(f.totalRetenues)} FCFA</td>
      </tr>
      <tr style="background:#059669;">
        <td style="padding:13px 16px;font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:.03em;color:#ffffff;">Net à payer</td>
        <td style="padding:13px 16px;font-size:20px;font-weight:bold;text-align:right;color:#ffffff;font-variant-numeric:tabular-nums;">${fmt(f.netAPayer)} FCFA</td>
      </tr>
    </table>

    ${f.notes ? `<div style="margin-top:16px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;"><p style="font-size:11px;font-weight:600;color:#b45309;margin:0 0 2px;">Note</p><p style="font-size:13px;color:#92400e;margin:0;">${escapeHtml(f.notes)}</p></div>` : ""}

    <!-- Signatures -->
    <table style="margin-top:40px;border-top:1px solid #e2e8f0;padding-top:24px;"><tr>
      <td style="width:50%;padding-right:24px;vertical-align:top;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 40px;">Signature RH / Direction</p>
        <div style="border-bottom:2px solid #cbd5e1;"></div>
        <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;text-align:center;">Cachet et signature</p>
      </td>
      <td style="width:50%;padding-left:24px;vertical-align:top;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 40px;">Signature de l'employé</p>
        <div style="border-bottom:2px solid #cbd5e1;"></div>
        <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;text-align:center;">Lu et approuvé</p>
      </td>
    </tr></table>

    <p style="margin-top:28px;padding-top:14px;border-top:1px solid #f1f5f9;text-align:center;font-size:11px;color:#94a3b8;">
      Bulletin généré le ${formatDate(new Date().toISOString())} · Confidentiel · AfriGes RH
    </p>
  </div>
</body></html>`;
}
