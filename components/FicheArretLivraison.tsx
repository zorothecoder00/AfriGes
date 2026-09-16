"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDateHeure, palette } from "@/components/DocumentPrintShell";

/**
 * Constat d'un arrêt de tournée (CDC digitalisation §5.7) — la mise en page
 * s'adapte au statut constaté :
 *  - NON_EFFECTUE → "Fiche de livraison non effectuée"
 *  - INCIDENT     → "Fiche d'incident livraison"
 *  - EFFECTUE     → constat de livraison (+ section retour si retourLignes)
 * "Fiche de retour marchandises" n'est pas un statut à part : un retour peut
 * accompagner n'importe quel constat (ex. livré avec un article refusé).
 */

export interface ArretConstatData {
  id: number;
  ordre: number;
  statut: string;
  clientNom: string;
  clientTelephone: string | null;
  adresseLivraison: string | null;
  heureArrivee: string | null;
  motifNonEffectue: string | null;
  incidentDescription: string | null;
  signatureClientNom: string | null;
  retourLignes: { id: number; quantite: number; motif: string | null; produit: { nom: string; codeProduit: string | null } }[];
}

const TITRES: Record<string, string> = {
  EFFECTUE: "CONSTAT DE LIVRAISON",
  NON_EFFECTUE: "FICHE DE LIVRAISON NON EFFECTUÉE",
  INCIDENT: "FICHE D'INCIDENT LIVRAISON",
  PLANIFIE: "CONSTAT D'ARRÊT",
};

function buildHtml(a: ArretConstatData, tourneeRef: string, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const titre = TITRES[a.statut] ?? "CONSTAT D'ARRÊT";
  const grave = a.statut === "NON_EFFECTUE" || a.statut === "INCIDENT";

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:38%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const retourRows = a.retourLignes.map((r) => `<tr>
    <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(r.produit.nom)}${r.produit.codeProduit ? ` <span style="color:${c.faint}">(${esc(r.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${r.quantite}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(r.motif)}</td>
  </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(titre)} — ${esc(a.clientNom)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:16px;font-weight:900;color:${grave ? c.danger : c.accent}">${titre}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Logistique & livraison</p>
    </div>
    <div style="text-align:right">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("Tournée", esc(tourneeRef))}
    ${kv("Arrêt n°", String(a.ordre))}
    ${kv("Client", esc(a.clientNom))}
    ${kv("Téléphone", dash(a.clientTelephone))}
    ${kv("Adresse", dash(a.adresseLivraison))}
    ${kv("Heure de passage", a.heureArrivee ? fmtDateHeure(a.heureArrivee) : "—")}
  </table>

  ${a.statut === "NON_EFFECTUE" ? `
    ${sectionTitle("Motif de non-livraison")}
    <p style="margin:8px 0;line-height:1.5;text-align:justify;font-size:11px;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:4px">${esc(a.motifNonEffectue ?? "—")}</p>` : ""}

  ${a.statut === "INCIDENT" ? `
    ${sectionTitle("Description de l'incident")}
    <p style="margin:8px 0;line-height:1.5;text-align:justify;font-size:11px;background:#fef2f2;border:1px solid #fecaca;padding:8px 12px;border-radius:4px">${esc(a.incidentDescription ?? "—")}</p>` : ""}

  ${a.retourLignes.length > 0 ? `
    ${sectionTitle("Marchandises retournées")}
    <table style="width:100%;border-collapse:collapse;font-size:10.5px">
      <thead><tr style="background:${c.headBg};color:${c.headText}">
        <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th>
        <th style="padding:5px 8px;border:1px solid ${c.line}">Qté</th>
        <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Motif</th>
      </tr></thead>
      <tbody>${retourRows}</tbody>
    </table>` : ""}

  ${a.statut === "EFFECTUE" ? table(kv("Réceptionné par", dash(a.signatureClientNom))) : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Livreur", "Client (le cas échéant)"].map((r) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDateHeure(new Date().toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function FicheArretLivraison({ arret, tourneeReference, onClose }: { arret: ArretConstatData; tourneeReference: string; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/user/logistiquesApprovisionnements/tournees`, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin]);

  const data = useMemo(() => arret, [arret]);

  return (
    <DocumentPrintShell
      title={TITRES[arret.statut] ?? "Constat d'arrêt"}
      reference={`${tourneeReference} · arrêt ${arret.ordre}`}
      filename={`arret-${tourneeReference}-${arret.ordre}.html`}
      buildHtml={(mono) => buildHtml(data, tourneeReference, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
