"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtMoney, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";
import { LABEL_TYPE_ACTION } from "@/lib/recouvrementCredit";

/**
 * Impression d'une ActionRecouvrementCredit (CDC digitalisation §5.4, Phase 3).
 * Couvre les deux documents formels du CDC :
 *  - MISE_EN_DEMEURE  → lettre de mise en demeure (sommation de payer)
 *  - VISITE_TERRAIN   → fiche de visite de recouvrement
 * Les autres types (appel, note, accord, saisie) s'impriment comme un simple
 * compte-rendu — pas de mise en page dédiée, le CDC ne l'exige pas pour eux.
 */

export interface ActionRecouvrement {
  id: number;
  type: string;
  statut: string;
  notes: string | null;
  resultat: string | null;
  delaiRegularisationJours: number | null;
  lieuVisite: string | null;
  personneRencontree: string | null;
  effectuePar: { nom: string; prenom: string } | null;
  dateAction: string;
  dateRelance: string | null;
}

interface Props {
  action: ActionRecouvrement;
  creditReference: string;
  soldeRestant: number | string;
  client: { codeClient: string | null; nom: string; prenom: string; telephone: string | null; adresse?: string | null };
  onClose: () => void;
}

const STATUT_LABEL: Record<string, string> = { EN_COURS: "En cours", RESOLU: "Résolu", SANS_SUITE: "Sans suite" };

function buildHtml(p: Omit<Props, "onClose">, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();
  const isMED = p.action.type === "MISE_EN_DEMEURE";
  const isVisite = p.action.type === "VISITE_TERRAIN";
  const prefixe = isMED ? "MED" : isVisite ? "FVR" : "REC";
  const noDoc = `${prefixe}-${p.creditReference}-${p.action.id}`;
  const titre = isMED ? "MISE EN DEMEURE" : isVisite ? "FICHE DE VISITE DE RECOUVREMENT" : LABEL_TYPE_ACTION[p.action.type as keyof typeof LABEL_TYPE_ACTION] ?? p.action.type;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const clientNomComplet = `${p.client.prenom} ${p.client.nom}`;
  const delai = p.action.delaiRegularisationJours ?? 8;
  const dateLimite = new Date(new Date(p.action.dateAction).getTime() + delai * 86_400_000);

  const corpsMED = `
    <p style="margin:14px 0;line-height:1.6;text-align:justify;font-size:11.5px">
      Madame, Monsieur <strong>${esc(clientNomComplet)}</strong>,
    </p>
    <p style="margin:0 0 10px;line-height:1.6;text-align:justify;font-size:11.5px">
      Malgré nos relances, votre compte crédit <strong>${esc(p.creditReference)}</strong> présente à ce jour un
      solde impayé de <strong>${fmtMoney(p.soldeRestant)}</strong>. Par la présente, nous vous mettons en demeure
      de régulariser l'intégralité de cette somme dans un délai de <strong>${delai} jour(s)</strong>, soit au plus
      tard le <strong>${fmtDate(dateLimite.toISOString())}</strong>.
    </p>
    <p style="margin:0 0 10px;line-height:1.6;text-align:justify;font-size:11.5px">
      À défaut de règlement dans ce délai, ${SOCIETE.nom} se réserve le droit d'engager toute action de
      recouvrement complémentaire, y compris la mobilisation des garanties associées à ce crédit et/ou une
      procédure contentieuse, sans préjudice des pénalités de retard déjà applicables.
    </p>
    ${p.action.notes ? `<p style="margin:0 0 10px;line-height:1.6;text-align:justify;font-size:11.5px;font-style:italic">${esc(p.action.notes)}</p>` : ""}
  `;

  const corpsVisite = `
    ${sectionTitle("Constat de la visite")}
    ${table(
      kv("Lieu de la visite", esc(p.action.lieuVisite ?? "—")) +
      kv("Personne rencontrée", dash(p.action.personneRencontree)) +
      kv("Date / heure", fmtDateHeure(p.action.dateAction)),
    )}
    ${p.action.notes ? `<p style="margin:10px 0;line-height:1.5;text-align:justify;font-size:11px"><strong>Constat :</strong> ${esc(p.action.notes)}</p>` : ""}
    ${p.action.resultat ? `<p style="margin:0 0 10px;line-height:1.5;text-align:justify;font-size:11px"><strong>Engagement / résultat :</strong> ${esc(p.action.resultat)}</p>` : ""}
    ${p.action.dateRelance ? table(kv("Prochaine relance prévue", fmtDate(p.action.dateRelance))) : ""}
  `;

  const corpsGenerique = `
    ${sectionTitle("Compte-rendu")}
    ${table(
      kv("Statut", STATUT_LABEL[p.action.statut] ?? p.action.statut) +
      (p.action.notes ? kv("Notes", esc(p.action.notes)) : "") +
      (p.action.resultat ? kv("Résultat", esc(p.action.resultat)) : "") +
      (p.action.dateRelance ? kv("Relance prévue", fmtDate(p.action.dateRelance)) : ""),
    )}
  `;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(noDoc)}${mono ? " (N/B)" : ""}</title>
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
      <h1 style="font-size:16px;font-weight:900;color:${isMED ? c.danger : c.accent}">${titre}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Solutions de Crédit Alimentaire</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi du crédit</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(noDoc))}
    ${kv("N° du crédit", esc(p.creditReference))}
    ${kv("Date", fmtDate(today.toISOString()))}
    ${kv("Émis par", esc(p.action.effectuePar ? `${p.action.effectuePar.prenom} ${p.action.effectuePar.nom}` : "—"))}
  </table>

  ${sectionTitle("Client")}
  ${table(
    kv("Nom & Prénoms", esc(clientNomComplet) + (p.client.codeClient ? ` (${esc(p.client.codeClient)})` : "")) +
    kv("Téléphone", dash(p.client.telephone)) +
    kv("Adresse", dash(p.client.adresse)),
  )}

  ${isMED ? corpsMED : isVisite ? corpsVisite : corpsGenerique}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${(isMED ? ["Responsable Vente Crédit", "Direction"] : ["Agent recouvrement", "Client (le cas échéant)"]).map((r) => `
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

export default function FicheActionRecouvrement({ action, creditReference, soldeRestant, client, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const dossierUrl = `${origin}/suivi/${creditReference}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(dossierUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [dossierUrl]);

  const data = useMemo(() => ({ action, creditReference, soldeRestant, client }), [action, creditReference, soldeRestant, client]);
  const isMED = action.type === "MISE_EN_DEMEURE";
  const isVisite = action.type === "VISITE_TERRAIN";
  const title = isMED ? "Mise en demeure" : isVisite ? "Fiche de visite de recouvrement" : (LABEL_TYPE_ACTION[action.type as keyof typeof LABEL_TYPE_ACTION] ?? action.type);

  return (
    <DocumentPrintShell
      title={title}
      reference={creditReference}
      filename={`recouvrement-${action.type.toLowerCase()}-${creditReference}-${action.id}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
