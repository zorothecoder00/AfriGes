"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, palette } from "@/components/DocumentPrintShell";

/** Bon de livraison revendeur (CDC §5.6) — imprimé depuis une BonLivraisonRevendeur. */

export interface BonLivraisonRevendeurData {
  id: number;
  reference: string;
  dateDepart: string;
  notes: string | null;
  livreur: { nom: string; prenom: string } | null;
  lignes: { id: number; quantite: number; produit: { nom: string; codeProduit: string | null } }[];
}

function buildHtml(bl: BonLivraisonRevendeurData, raisonSociale: string, commandeReference: string, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;

  const rows = bl.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(l.produit.nom)}${l.produit.codeProduit ? ` <span style="color:${c.faint}">(${esc(l.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${l.quantite}</td>
  </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(bl.reference)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:17px;font-weight:900;color:${c.accent}">BON DE LIVRAISON REVENDEUR</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de bon", esc(bl.reference))}
    ${kv("Commande liée", esc(commandeReference))}
    ${kv("Revendeur", esc(raisonSociale))}
    ${kv("Date de départ", fmtDate(bl.dateDepart))}
    ${kv("Livreur", bl.livreur ? esc(`${bl.livreur.prenom} ${bl.livreur.nom}`) : dash(null))}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Qté livrée</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${bl.notes ? `<p style="margin-top:10px;font-size:11px"><strong>Notes :</strong> ${esc(bl.notes)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Livreur", "Revendeur (réception)"].map((r) => `
        <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(new Date().toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function BonLivraisonRevendeurDoc({ bonLivraison, raisonSociale, commandeReference, onClose }: {
  bonLivraison: BonLivraisonRevendeurData; raisonSociale: string; commandeReference: string; onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/admin/revendeurs?bl=${bonLivraison.id}`, { margin: 1, width: 200 })
      .then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin, bonLivraison.id]);

  const data = useMemo(() => bonLivraison, [bonLivraison]);

  return (
    <DocumentPrintShell
      title="Bon de livraison revendeur"
      reference={bonLivraison.reference}
      filename={`${bonLivraison.reference}.html`}
      buildHtml={(mono) => buildHtml(data, raisonSociale, commandeReference, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
