"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/**
 * Avis d'échéance / Avis de retard (CDC digitalisation §5.4, Phase 3) —
 * jusqu'ici l'alerte n'existait qu'en notification in-app (alertesSystem),
 * jamais comme document imprimable/remettable au client. Même composant pour
 * les deux variantes : "ECHEANCE" (rappel avant la date) et "RETARD" (après),
 * seul le ton du texte et le total affiché changent.
 */

export type VarianteAvis = "ECHEANCE" | "RETARD";

export interface EcheanceAvis {
  numeroEcheance: number;
  dateEcheance: string;
  montantDu: number | string;
  montantPaye: number | string;
  joursRetard?: number;
}

interface Props {
  variante: VarianteAvis;
  creditReference: string;
  client: { codeClient: string | null; nom: string; prenom: string; telephone: string | null };
  echeances: EcheanceAvis[];
  onClose: () => void;
}

function buildHtml(p: Omit<Props, "onClose">, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const retard = p.variante === "RETARD";
  const noAvis = `${retard ? "AVR" : "AVE"}-${p.creditReference}-${Date.now().toString().slice(-6)}`;
  const today = new Date();

  const totalDu = p.echeances.reduce((s, e) => s + (Number(e.montantDu) - Number(e.montantPaye)), 0);
  const plusAncienne = p.echeances.reduce((max, e) => Math.max(max, e.joursRetard ?? 0), 0);

  const rows = p.echeances.map((e) => `<tr>
    <td style="padding:4px 8px;border:1px solid ${c.line};text-align:center">${e.numeroEcheance}</td>
    <td style="padding:4px 8px;border:1px solid ${c.line}">${fmtDate(e.dateEcheance)}</td>
    <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(e.montantDu)}</td>
    <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(Number(e.montantDu) - Number(e.montantPaye))}</td>
    ${retard ? `<td style="padding:4px 8px;border:1px solid ${c.line};text-align:center;color:${c.danger};font-weight:600">${e.joursRetard ?? 0} j</td>` : ""}
  </tr>`).join("");

  const texte = retard
    ? `Nous constatons à ce jour un retard de paiement sur votre crédit ${esc(p.creditReference)}. Le tableau ci-dessous récapitule les échéances actuellement impayées. Nous vous invitons à régulariser votre situation dans les meilleurs délais afin d'éviter l'application de pénalités de retard et l'engagement d'une procédure de recouvrement.`
    : `Nous vous rappelons que la ou les échéances suivantes de votre crédit ${esc(p.creditReference)} arrivent prochainement à échéance. Merci de bien vouloir tenir votre paiement à disposition de votre agent ou du point de vente à la date prévue.`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:42%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(noAvis)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:17px;font-weight:900;color:${retard ? c.danger : c.accent}">${retard ? "AVIS DE RETARD DE PAIEMENT" : "AVIS D'ÉCHÉANCE"}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Solutions de Crédit Alimentaire</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi du crédit</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de l'avis", esc(noAvis))}
    ${kv("N° du crédit", esc(p.creditReference))}
    ${kv("Date d'émission", fmtDate(today.toISOString()))}
  </table>

  ${table(
    kv("Client", esc(`${p.client.prenom} ${p.client.nom}${p.client.codeClient ? ` (${p.client.codeClient})` : ""}`)) +
    kv("Téléphone", dash(p.client.telephone)),
  )}

  <p style="margin:16px 0;line-height:1.5;text-align:justify;font-size:11.5px;${retard ? `background:#fef2f2;border:1px solid #fecaca;padding:10px 12px;border-radius:4px;` : ""}">${texte}</p>

  <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:8px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:4px 8px;border:1px solid ${c.line}">Échéance</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Date</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Montant dû</th>
      <th style="padding:4px 8px;border:1px solid ${c.line}">Restant</th>
      ${retard ? `<th style="padding:4px 8px;border:1px solid ${c.line}">Retard</th>` : ""}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px">
    ${kv("Total dû sur les échéances ci-dessus", `<span style="font-size:14px;color:${retard ? c.danger : c.accent}">${fmtMoney(totalDu)}</span>`)}
    ${retard ? kv("Retard le plus ancien", `${plusAncienne} jour(s)`) : ""}
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:24px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function AvisEcheance({ variante, creditReference, client, echeances, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const dossierUrl = `${origin}/suivi/${creditReference}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(dossierUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [dossierUrl]);

  const data = useMemo(() => ({ variante, creditReference, client, echeances }), [variante, creditReference, client, echeances]);

  return (
    <DocumentPrintShell
      title={variante === "RETARD" ? "Avis de retard" : "Avis d'échéance"}
      reference={creditReference}
      filename={`avis-${variante.toLowerCase()}-${creditReference}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
