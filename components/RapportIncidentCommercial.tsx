"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";

/**
 * "Rapport d'incident" commercial (vente/livraison) — CDC digitalisation
 * §5.8. Distinct du RapportIncident SST (accidents de travail).
 */

export interface IncidentCommercialDoc {
  id: number;
  numero: string;
  dateIncident: string;
  lieu: string;
  type: string;
  description: string;
  personnesImpliquees: string | null;
  actionsCorrectives: string | null;
  statut: string;
  createdAt: string;
  declarePar: { nom: string; prenom: string } | null;
  reclamation?: { numero: string } | null;
}

interface Props {
  incident: IncidentCommercialDoc;
  onClose: () => void;
}

const LABEL_TYPE: Record<string, string> = {
  LIVRAISON: "Livraison", PRODUIT: "Produit", COMPORTEMENT_CLIENT: "Comportement client", COMPORTEMENT_AGENT: "Comportement agent", AUTRE: "Autre",
};
const STATUT_LABEL: Record<string, string> = { OUVERT: "Ouvert", EN_COURS: "En cours", CLOTURE: "Clôturé", ANNULE: "Annulé" };

function buildHtml(inc: IncidentCommercialDoc, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(inc.numero)}${mono ? " (N/B)" : ""}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,"DM Sans",sans-serif; font-size:12.5px; color:${c.text}; background:#fff; padding:32px; max-width:720px; margin:0 auto; }
  @page { margin:1cm; size:A4 portrait; }
  @media print { body { padding:0; } }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double ${c.rule};padding-bottom:14px">
    <div>
      <img src="${logoUrl}" alt="${SOCIETE.nom}" style="height:48px;width:auto;display:block;margin-bottom:8px;${c.logoFilter}"/>
      <h1 style="font-size:16px;font-weight:900;color:${c.accent}">RAPPORT D'INCIDENT</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Incident commercial (vente/livraison)</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi de l'incident</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(inc.numero))}
    ${kv("Date de l'incident", fmtDateHeure(inc.dateIncident))}
    ${kv("Lieu", esc(inc.lieu))}
    ${kv("Type", LABEL_TYPE[inc.type] ?? inc.type)}
    ${kv("Statut", STATUT_LABEL[inc.statut] ?? inc.statut)}
    ${inc.reclamation ? kv("Réclamation liée", esc(inc.reclamation.numero)) : ""}
    ${kv("Déclaré par", esc(inc.declarePar ? `${inc.declarePar.prenom} ${inc.declarePar.nom}` : "—"))}
  </table>

  ${sectionTitle("Description de l'incident")}
  <p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(inc.description)}</p>

  ${sectionTitle("Personnes impliquées")}
  <p style="font-size:11px">${dash(inc.personnesImpliquees)}</p>

  ${sectionTitle("Actions correctives")}
  <p style="font-size:11px">${dash(inc.actionsCorrectives)}</p>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Déclarant", "Responsable Point de Vente / Chef d'agence"].map((r) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function RapportIncidentCommercial({ incident, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const suiviUrl = `${origin}/suivi/${incident.numero}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(suiviUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [suiviUrl]);

  const data = useMemo(() => incident, [incident]);

  return (
    <DocumentPrintShell
      title="Rapport d'incident"
      reference={incident.numero}
      filename={`rapport-incident-${incident.numero}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
