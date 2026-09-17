"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";

/**
 * "Fiche de retour marchandise" tant que non validée, devient le "Bon de
 * retour" une fois le statut VALIDE (CDC digitalisation §5.8).
 */

export interface RetourMarchandiseDoc {
  id: number;
  numero: string;
  statut: string;
  dateReception: string | null;
  motifRejet: string | null;
  createdAt: string;
  pointDeVente: { nom: string; code: string };
  reclamation: { numero: string; objet: string; client: { nom: string; prenom: string } };
  magasinier: { nom: string; prenom: string } | null;
  lignes: { produit: { nom: string; codeProduit?: string | null }; quantite: number; etatProduit: string | null }[];
}

interface Props {
  retour: RetourMarchandiseDoc;
  onClose: () => void;
}

const STATUT_LABEL: Record<string, string> = { DECLARE: "Déclaré", RECEPTIONNE: "Réceptionné", VALIDE: "Validé", REJETE: "Rejeté" };

function buildHtml(r: RetourMarchandiseDoc, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();
  const estBonDeRetour = r.statut === "VALIDE";
  const titre = estBonDeRetour ? "BON DE RETOUR" : "FICHE DE RETOUR MARCHANDISE";
  const clientNom = `${r.reclamation.client.prenom} ${r.reclamation.client.nom}`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const lignesHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
      <tr style="background:${c.headBg}"><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th><th style="padding:5px 8px;border:1px solid ${c.line}">Quantité</th><th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">État constaté</th></tr>
      ${r.lignes.map((l) => `<tr>
        <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(l.produit.nom)}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${l.quantite}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(l.etatProduit)}</td>
      </tr>`).join("")}
    </table>`;

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
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Suivi du retour</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(r.numero))}
    ${kv("Réclamation liée", esc(r.reclamation.numero) + " — " + esc(r.reclamation.objet))}
    ${kv("Point de vente / dépôt", esc(`${r.pointDeVente.nom} (${r.pointDeVente.code})`))}
    ${kv("Statut", STATUT_LABEL[r.statut] ?? r.statut)}
    ${kv("Date de réception", fmtDateHeure(r.dateReception))}
    ${kv("Réceptionné / validé par", esc(r.magasinier ? `${r.magasinier.prenom} ${r.magasinier.nom}` : "—"))}
  </table>

  ${sectionTitle("Client")}
  ${table(kv("Nom & Prénoms", esc(clientNom)))}

  ${sectionTitle("Marchandises retournées")}
  ${lignesHtml}

  ${r.motifRejet ? `${sectionTitle("Motif de rejet")}<p style="font-size:11px;color:${c.danger}">${esc(r.motifRejet)}</p>` : ""}

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
    <tr>
      ${["Magasinier", "Client / Agent"].map((rLabel) => `
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

export default function FicheRetourMarchandise({ retour, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Document interne (magasinier) — lien vers la file d'attente des retours (pas de page publique).
  const suiviUrl = `${origin}/dashboard/user/magasiniers/retours-client?detail=${retour.id}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(suiviUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [suiviUrl]);

  const data = useMemo(() => retour, [retour]);
  const title = retour.statut === "VALIDE" ? "Bon de retour" : "Fiche de retour marchandise";

  return (
    <DocumentPrintShell
      title={title}
      reference={retour.numero}
      filename={`retour-marchandise-${retour.numero}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
