"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/**
 * Reçu de remboursement (CDC digitalisation §5.4, Phase 3) — un reçu par
 * versement encaissé, complémentaire au Bordereau de remboursement (qui
 * couvre l'échéancier complet A→J). Généré à la volée depuis un
 * RemboursementCredit déjà chargé côté client (pas de nouvel endpoint).
 */

const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  VIREMENT: "Virement bancaire",
  CHEQUE: "Chèque",
  WALLET_GENERAL: "Compte courant — solde général",
  WALLET_TONTINE: "Compte courant — épargne tontine",
  WALLET_CREDIT: "Compte courant — réservé crédit",
  EXTERNE: "Paiement externe",
};

export interface RecuRemboursementData {
  id: number;
  montant: number | string;
  dateRemboursement: string;
  modePaiement: string;
  notes?: string | null;
  numeroJour: number | null;
  enregistrePar: { nom: string; prenom: string };
  agentCollecteur: { nom: string; prenom: string } | null;
}

interface Props {
  remboursement: RecuRemboursementData;
  creditReference: string;
  soldeRestant: number | string;
  client: { codeClient: string | null; nom: string; prenom: string; telephone: string | null };
  onClose: () => void;
}

function buildHtml(p: Omit<Props, "onClose">, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const noRecu = `REC-${p.creditReference}-${p.remboursement.id}`;
  const today = new Date();

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:42%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(noRecu)}${mono ? " (N/B)" : ""}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,"DM Sans",sans-serif; font-size:13px; color:${c.text}; background:#fff; padding:32px; max-width:640px; margin:0 auto; }
  @page { margin:1cm; size:A4 portrait; }
  @media print { body { padding:0; } }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double ${c.rule};padding-bottom:14px">
    <div>
      <img src="${logoUrl}" alt="${SOCIETE.nom}" style="height:48px;width:auto;display:block;margin-bottom:8px;${c.logoFilter}"/>
      <h1 style="font-size:17px;font-weight:900;color:${c.accent}">REÇU DE REMBOURSEMENT DE CRÉDIT</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Solutions de Crédit Alimentaire</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi du crédit</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de reçu", esc(noRecu))}
    ${kv("N° du crédit", esc(p.creditReference))}
    ${kv("Date d'émission", fmtDate(today.toISOString()))}
  </table>

  <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">Client</h2>
  ${table(
    kv("Code Client", dash(p.client.codeClient)) +
    kv("Nom & Prénoms", esc(`${p.client.prenom} ${p.client.nom}`)) +
    kv("Téléphone", dash(p.client.telephone)),
  )}

  <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">Versement encaissé</h2>
  ${table(
    kv("Montant reçu", `<span style="font-size:15px;color:${c.accent}">${fmtMoney(p.remboursement.montant)}</span>`) +
    kv("Date de collecte", fmtDate(p.remboursement.dateRemboursement)) +
    kv("Mode de paiement", MODE_LABEL[p.remboursement.modePaiement] ?? p.remboursement.modePaiement) +
    (p.remboursement.numeroJour ? kv("Jour de l'échéancier", `Jour ${p.remboursement.numeroJour}`) : "") +
    kv("Collecté par", esc(p.remboursement.agentCollecteur ? `${p.remboursement.agentCollecteur.prenom} ${p.remboursement.agentCollecteur.nom}` : `${p.remboursement.enregistrePar.prenom} ${p.remboursement.enregistrePar.nom}`)) +
    (p.remboursement.notes ? kv("Observation", esc(p.remboursement.notes)) : ""),
  )}

  <h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">Solde du crédit</h2>
  ${table(kv("Solde restant dû (à ce jour)", fmtMoney(p.soldeRestant)))}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Client", "Agent / Caissier"].map((r) => `
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

export default function RecuRemboursement({ remboursement, creditReference, soldeRestant, client, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const dossierUrl = `${origin}/suivi/${creditReference}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(dossierUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [dossierUrl]);

  const data = useMemo(() => ({ remboursement, creditReference, soldeRestant, client }), [remboursement, creditReference, soldeRestant, client]);

  return (
    <DocumentPrintShell
      title="Reçu de remboursement"
      reference={`REC-${creditReference}-${remboursement.id}`}
      filename={`recu-${creditReference}-${remboursement.id}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
