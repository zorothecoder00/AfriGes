"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/** Bon de commande revendeur (CDC §5.6) — imprimé depuis une CommandeRevendeur. */

export interface LigneCommandeRevendeurData {
  id: number;
  quantite: number;
  prixUnitaire: number | string;
  montantLigne: number | string;
  produit: { nom: string; codeProduit: string | null };
}

export interface CommandeRevendeurData {
  id: number;
  reference: string;
  statut: string;
  revendeur: { nom: string; prenom: string };
  pointDeVente: { nom: string; code: string };
  lignes: LigneCommandeRevendeurData[];
  totalTTC: number | string;
  dateLivraisonSouhaitee: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", CONFIRMEE: "Confirmée", LIVREE: "Livrée", FACTUREE: "Facturée", ANNULEE: "Annulée" };

function buildHtml(commande: CommandeRevendeurData, raisonSociale: string, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;

  const rows = commande.lignes.map((l) => `<tr>
    <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(l.produit.nom)}${l.produit.codeProduit ? ` <span style="color:${c.faint}">(${esc(l.produit.codeProduit)})</span>` : ""}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${l.quantite}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(l.prixUnitaire)}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};text-align:right;font-weight:600">${fmtMoney(l.montantLigne)}</td>
  </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(commande.reference)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:17px;font-weight:900;color:${c.accent}">BON DE COMMANDE REVENDEUR</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:9px;color:${c.faint};text-align:center;letter-spacing:1px;margin-top:4px">${esc(commande.reference)}</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de commande", esc(commande.reference))}
    ${kv("Revendeur", esc(raisonSociale))}
    ${kv("Point de vente", esc(`${commande.pointDeVente.nom} (${commande.pointDeVente.code})`))}
    ${kv("Date", fmtDate(commande.createdAt))}
    ${commande.dateLivraisonSouhaitee ? kv("Livraison souhaitée", fmtDate(commande.dateLivraisonSouhaitee)) : ""}
    ${kv("Statut", STATUT_LABEL[commande.statut] ?? commande.statut)}
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:14px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Qté</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Prix unit.</th>
      <th style="padding:5px 8px;border:1px solid ${c.line}">Montant</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td colspan="3" style="padding:6px 8px;border:1px solid ${c.line};text-align:right;font-weight:700">Total</td>
      <td style="padding:6px 8px;border:1px solid ${c.line};text-align:right;font-weight:900;color:${c.accent}">${fmtMoney(commande.totalTTC)}</td>
    </tr></tfoot>
  </table>

  ${commande.notes ? `<p style="margin-top:10px;font-size:11px"><strong>Notes :</strong> ${esc(commande.notes)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Revendeur", "AFRISIME"].map((r) => `
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

export default function BonCommandeRevendeur({ commande, raisonSociale, onClose }: {
  commande: CommandeRevendeurData; raisonSociale: string; onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/admin/revendeurs?commande=${commande.id}`, { margin: 1, width: 200 })
      .then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin, commande.id]);

  const data = useMemo(() => commande, [commande]);

  return (
    <DocumentPrintShell
      title="Bon de commande revendeur"
      reference={commande.reference}
      filename={`${commande.reference}.html`}
      buildHtml={(mono) => buildHtml(data, raisonSociale, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
