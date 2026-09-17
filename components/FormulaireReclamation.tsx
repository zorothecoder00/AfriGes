"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";
import { LABEL_TYPE_RECLAMATION } from "@/lib/reclamationClient";

/** "Formulaire de réclamation client" (CDC digitalisation §5.8). */

export interface ReclamationDoc {
  id: number;
  numero: string;
  type: string;
  objet: string;
  description: string;
  statut: string;
  sourceReference: string | null;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string | null; codeClient?: string | null };
  pointDeVente: { nom: string; code: string } | null;
  creePar: { nom: string; prenom: string } | null;
  lignes: { produit: { nom: string; codeProduit?: string | null }; quantite: number; motif: string | null }[];
}

interface Props {
  reclamation: ReclamationDoc;
  onClose: () => void;
}

const STATUT_LABEL: Record<string, string> = {
  ENREGISTREE: "Enregistrée", EN_TRAITEMENT: "En traitement", RESOLUE: "Résolue", CLOTUREE: "Clôturée", REJETEE: "Rejetée",
};

function buildHtml(r: ReclamationDoc, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const clientNomComplet = `${r.client.prenom} ${r.client.nom}`;

  const lignesHtml = r.lignes.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <tr style="background:${c.headBg}"><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th><th style="padding:5px 8px;border:1px solid ${c.line}">Quantité</th><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Motif</th></tr>
        ${r.lignes.map((l) => `<tr>
          <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(l.produit.nom)}</td>
          <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${l.quantite}</td>
          <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(l.motif)}</td>
        </tr>`).join("")}
      </table>`
    : `<p style="font-size:11px;color:${c.muted}">Aucun produit spécifique rattaché à cette réclamation.</p>`;

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
      <h1 style="font-size:16px;font-weight:900;color:${c.accent}">FORMULAIRE DE RÉCLAMATION CLIENT</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Service Commercial</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi de la réclamation</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de réclamation", esc(r.numero))}
    ${kv("Date d'enregistrement", fmtDateHeure(r.createdAt))}
    ${kv("Statut", STATUT_LABEL[r.statut] ?? r.statut)}
    ${kv("Point de vente", r.pointDeVente ? esc(`${r.pointDeVente.nom} (${r.pointDeVente.code})`) : "—")}
    ${kv("Enregistrée par", esc(r.creePar ? `${r.creePar.prenom} ${r.creePar.nom}` : "—"))}
  </table>

  ${sectionTitle("Client")}
  ${table(
    kv("Nom & Prénoms", esc(clientNomComplet) + (r.client.codeClient ? ` (${esc(r.client.codeClient)})` : "")) +
    kv("Téléphone", dash(r.client.telephone)),
  )}

  ${sectionTitle("Objet de la réclamation")}
  ${table(
    kv("Type", LABEL_TYPE_RECLAMATION[r.type as keyof typeof LABEL_TYPE_RECLAMATION] ?? r.type) +
    kv("Objet", esc(r.objet)) +
    kv("Référence document source", dash(r.sourceReference)),
  )}
  <p style="margin:10px 0;line-height:1.6;text-align:justify;font-size:11.5px">${esc(r.description)}</p>

  ${sectionTitle("Produits concernés")}
  ${lignesHtml}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Client", "Agent / Service Commercial"].map((rLabel) => `
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

export default function FormulaireReclamation({ reclamation, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Document interne (Service Commercial/RPV/Chef d'agence connectés) — lien vers
  // le dossier dans le back-office, pas une page publique sans authentification.
  const suiviUrl = `${origin}/dashboard/admin/reclamations?detail=${reclamation.id}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(suiviUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [suiviUrl]);

  const data = useMemo(() => reclamation, [reclamation]);

  return (
    <DocumentPrintShell
      title="Formulaire de réclamation client"
      reference={reclamation.numero}
      filename={`reclamation-${reclamation.numero}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
