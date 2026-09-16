"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED, SOCIETE_LEGAL } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/** Facture revendeur (CDC §5.6) — imprimée depuis une FactureVente (type REVENDEUR). */

export interface FactureRevendeurData {
  id: number;
  numero: string;
  statut: string;
  clientNom: string;
  clientTelephone: string | null;
  montantHT: number | string;
  montantTVA: number | string;
  montantTTC: number | string;
  montantPaye: number | string;
  dateEmission: string;
  emiseParNom: string;
  lignes: { id: number; designation: string; quantite: number; prixUnitaire: number | string; montant: number | string }[];
}

function buildHtml(f: FactureRevendeurData, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const solde = Number(f.montantTTC) - Number(f.montantPaye);

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;

  const rows = f.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(l.designation)}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${l.quantite}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(l.prixUnitaire)}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:right;font-weight:600">${fmtMoney(l.montant)}</td>
  </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(f.numero)}${mono ? " (N/B)" : ""}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,"DM Sans",sans-serif; font-size:12.5px; color:${c.text}; background:#fff; padding:32px; max-width:760px; margin:0 auto; }
  @page { margin:1cm; size:A4 portrait; }
  @media print { body { padding:0; } }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double ${c.rule};padding-bottom:14px">
    <div>
      <img src="${logoUrl}" alt="${SOCIETE.nom}" style="height:48px;width:auto;display:block;margin-bottom:8px;${c.logoFilter}"/>
      <h1 style="font-size:17px;font-weight:900;color:${c.accent}">FACTURE REVENDEUR</h1>
      <p style="font-size:10.5px;color:${c.muted}">${esc(SOCIETE_LEGAL)}</p>
    </div>
    <div style="text-align:right">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de facture", esc(f.numero))}
    ${kv("Client (revendeur)", esc(f.clientNom))}
    ${kv("Téléphone", dash(f.clientTelephone))}
    ${kv("Date d'émission", fmtDate(f.dateEmission))}
    ${kv("Émise par", esc(f.emiseParNom))}
    ${kv("Statut", f.statut === "EMISE" ? "Émise" : f.statut)}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Désignation</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Qté</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Prix unit.</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Montant</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="width:50%;margin-left:auto;border-collapse:collapse;font-size:11.5px;margin-top:10px">
    ${kv("Total HT", fmtMoney(f.montantHT))}
    ${Number(f.montantTVA) > 0 ? kv("TVA", fmtMoney(f.montantTVA)) : ""}
    ${kv("Total TTC", `<span style="font-size:14px;color:${c.accent}">${fmtMoney(f.montantTTC)}</span>`)}
    ${kv("Déjà payé", fmtMoney(f.montantPaye))}
    ${kv("Solde dû", `<span style="color:${solde > 0 ? c.danger : c.accent}">${fmtMoney(solde)}</span>`)}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["AFRISIME", "Revendeur"].map((r) => `
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

export default function FactureRevendeurDoc({ facture, onClose }: { facture: FactureRevendeurData; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/admin/revendeurs?facture=${facture.id}`, { margin: 1, width: 200 })
      .then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin, facture.id]);

  const data = useMemo(() => facture, [facture]);

  return (
    <DocumentPrintShell
      title="Facture revendeur"
      reference={facture.numero}
      filename={`${facture.numero}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
