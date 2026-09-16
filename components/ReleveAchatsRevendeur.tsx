"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/** Relevé de compte revendeur + État des achats (CDC §5.6) — une facture par ligne. */

export interface FactureRevendeurLigne {
  id: number;
  numero: string;
  statut: string;
  dateEmission: string;
  montantTTC: number | string;
  montantPaye: number | string;
}

interface Props {
  raisonSociale: string;
  factures: FactureRevendeurLigne[];
  stats: { nbFactures: number; totalFacture: number; totalPaye: number; soldeDu: number; premierAchat: string | null };
  onClose: () => void;
}

function buildHtml(p: Omit<Props, "onClose">, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:45%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;

  const rows = p.factures.map((f) => {
    const solde = Number(f.montantTTC) - Number(f.montantPaye);
    return `<tr>
      <td style="padding:4px 8px;border:1px solid ${c.line}">${esc(f.numero)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line}">${fmtDate(f.dateEmission)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(f.montantTTC)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(f.montantPaye)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right;${solde > 0 ? `color:${c.danger};font-weight:600` : ""}">${fmtMoney(solde)}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Relevé ${esc(p.raisonSociale)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:17px;font-weight:900;color:${c.accent}">RELEVÉ DE COMPTE REVENDEUR</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — État des achats</p>
    </div>
    <div style="text-align:right">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("Revendeur", esc(p.raisonSociale))}
    ${kv("Date d'émission", fmtDate(today.toISOString()))}
    ${p.stats.premierAchat ? kv("Premier achat", fmtDate(p.stats.premierAchat)) : ""}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:14px">
    ${kv("Nombre de factures", String(p.stats.nbFactures))}
    ${kv("Total facturé", fmtMoney(p.stats.totalFacture))}
    ${kv("Total payé", fmtMoney(p.stats.totalPaye))}
    ${kv("Solde dû", `<span style="color:${p.stats.soldeDu > 0 ? c.danger : c.accent}">${fmtMoney(p.stats.soldeDu)}</span>`)}
  </table>

  <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">Détail des factures</h2>
  <table style="width:100%;border-collapse:collapse;font-size:10.5px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:4px 8px;border:1px solid ${c.line}">N° facture</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Date</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Montant TTC</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Payé</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Solde</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="padding:10px;border:1px solid ${c.line};text-align:center;color:${c.faint}">Aucune facture</td></tr>`}</tbody>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function ReleveAchatsRevendeur({ raisonSociale, factures, stats, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/user/revendeurs`, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin]);

  const data = useMemo(() => ({ raisonSociale, factures, stats }), [raisonSociale, factures, stats]);

  return (
    <DocumentPrintShell
      title="Relevé de compte revendeur"
      reference={raisonSociale}
      filename={`releve-revendeur-${raisonSociale.replace(/\s+/g, "-")}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
