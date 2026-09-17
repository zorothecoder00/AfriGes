"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";
import { LABEL_TYPE_ACTION_RECLAMATION, LABEL_TYPE_RECLAMATION } from "@/lib/reclamationClient";

/**
 * "Fiche de traitement de réclamation" — journal des actions menées.
 * Devient la "Fiche de clôture de réclamation" une fois statut CLOTUREE
 * (CDC digitalisation §5.8).
 */

export interface ActionReclamationDoc {
  id: number;
  type: string;
  description: string | null;
  dateAction: string;
  auteur: { nom: string; prenom: string };
}

export interface ReclamationTraitementDoc {
  id: number;
  numero: string;
  type: string;
  objet: string;
  statut: string;
  resumeCloture: string | null;
  clotureLe: string | null;
  createdAt: string;
  client: { nom: string; prenom: string };
  actions: ActionReclamationDoc[];
}

interface Props {
  reclamation: ReclamationTraitementDoc;
  onClose: () => void;
}

function buildHtml(r: ReclamationTraitementDoc, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();
  const estCloture = r.statut === "CLOTUREE";
  const titre = estCloture ? "FICHE DE CLÔTURE DE RÉCLAMATION" : "FICHE DE TRAITEMENT DE RÉCLAMATION";
  const clientNom = `${r.client.prenom} ${r.client.nom}`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const journalHtml = r.actions.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <tr style="background:${c.headBg}"><th style="padding:5px 8px;border:1px solid ${c.line}">Date</th><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Action</th><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Description</th><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Auteur</th></tr>
        ${r.actions.map((a) => `<tr>
          <td style="padding:5px 8px;border:1px solid ${c.line};white-space:nowrap">${fmtDateHeure(a.dateAction)}</td>
          <td style="padding:5px 8px;border:1px solid ${c.line}">${LABEL_TYPE_ACTION_RECLAMATION[a.type as keyof typeof LABEL_TYPE_ACTION_RECLAMATION] ?? a.type}</td>
          <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(a.description)}</td>
          <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(`${a.auteur.prenom} ${a.auteur.nom}`)}</td>
        </tr>`).join("")}
      </table>`
    : `<p style="font-size:11px;color:${c.muted}">Aucune action enregistrée.</p>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(r.numero)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:16px;font-weight:900;color:${c.accent}">${titre}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Retours et réclamations</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi de la réclamation</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de réclamation", esc(r.numero))}
    ${kv("Type", LABEL_TYPE_RECLAMATION[r.type as keyof typeof LABEL_TYPE_RECLAMATION] ?? r.type)}
    ${kv("Objet", esc(r.objet))}
    ${kv("Client", esc(clientNom))}
    ${estCloture ? kv("Date de clôture", fmtDateHeure(r.clotureLe)) : ""}
  </table>

  ${sectionTitle("Journal des actions de traitement")}
  ${journalHtml}

  ${estCloture ? `${sectionTitle("Résumé de clôture")}<p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(r.resumeCloture ?? "")}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Responsable du traitement", "Client (accusé de clôture)"].map((rLabel) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${rLabel}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function FicheTraitementReclamation({ reclamation, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Document interne — lien vers le dossier dans le back-office (pas de page publique).
  const suiviUrl = `${origin}/dashboard/admin/reclamations?detail=${reclamation.id}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(suiviUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [suiviUrl]);

  const data = useMemo(() => reclamation, [reclamation]);
  const title = reclamation.statut === "CLOTUREE" ? "Fiche de clôture de réclamation" : "Fiche de traitement de réclamation";

  return (
    <DocumentPrintShell
      title={title}
      reference={reclamation.numero}
      filename={`traitement-reclamation-${reclamation.numero}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
