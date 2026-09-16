"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtDate, fmtDateHeure, palette } from "@/components/DocumentPrintShell";

/**
 * Documents de tournée (CDC digitalisation §5.7) — une vue à variantes :
 *  - MISSION    → "Fiche de tournée" / "Fiche de mission du livreur" (avant départ)
 *  - CHARGEMENT → "Fiche de chargement" (agrégée depuis les bons de livraison des arrêts)
 *  - BORDEREAU  → "Bordereau de livraison" (récap après déroulement)
 */

export type VarianteTournee = "MISSION" | "CHARGEMENT" | "BORDEREAU";

export interface ArretTourneeData {
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
  bonLivraison: { reference: string; lignes: { quantite: number; produit: { nom: string; codeProduit: string | null } }[] } | null;
}

export interface TourneeData {
  id: number;
  reference: string;
  statut: string;
  dateTournee: string;
  moyenTransport: string | null;
  heureDepart: string | null;
  heureRetour: string | null;
  notes: string | null;
  livreur: { nom: string; prenom: string };
  pointDeVente: { nom: string; code: string };
  arrets: ArretTourneeData[];
}

const TITRES: Record<VarianteTournee, string> = {
  MISSION: "FICHE DE TOURNÉE / MISSION LIVREUR",
  CHARGEMENT: "FICHE DE CHARGEMENT",
  BORDEREAU: "BORDEREAU DE LIVRAISON",
};

const STATUT_ARRET_LABEL: Record<string, { label: string; color: string }> = {
  PLANIFIE: { label: "Planifié", color: "muted" },
  EFFECTUE: { label: "Effectué", color: "accent" },
  NON_EFFECTUE: { label: "Non effectué", color: "danger" },
  INCIDENT: { label: "Incident", color: "danger" },
};

function buildHtml(t: TourneeData, variante: VarianteTournee, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:38%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;

  let corps = "";
  if (variante === "MISSION") {
    const rows = t.arrets.map((a) => `<tr>
      <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${a.ordre}</td>
      <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(a.clientNom)}</td>
      <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(a.clientTelephone)}</td>
      <td style="padding:5px 8px;border:1px solid ${c.line}">${dash(a.adresseLivraison)}</td>
    </tr>`).join("");
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:${c.headBg};color:${c.headText}">
          <th style="padding:5px 8px;border:1px solid ${c.line}">Ordre</th>
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Client</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Téléphone</th>
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Adresse</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${t.notes ? `<p style="margin-top:12px;font-size:11px"><strong>Instructions :</strong> ${esc(t.notes)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
        <tr>
          ${["Livreur", "Responsable logistique"].map((r) => `
            <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
              <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${r}</div>
            </td>`).join("")}
        </tr>
      </table>`;
  } else if (variante === "CHARGEMENT") {
    const cumul = new Map<string, { nom: string; code: string | null; quantite: number }>();
    for (const a of t.arrets) {
      for (const l of a.bonLivraison?.lignes ?? []) {
        const key = `${l.produit.nom}-${l.produit.codeProduit ?? ""}`;
        const cur = cumul.get(key) ?? { nom: l.produit.nom, code: l.produit.codeProduit, quantite: 0 };
        cur.quantite += l.quantite;
        cumul.set(key, cur);
      }
    }
    const rows = Array.from(cumul.values()).map((p) => `<tr>
      <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(p.nom)}${p.code ? ` <span style="color:${c.faint}">(${esc(p.code)})</span>` : ""}</td>
      <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center;font-weight:700">${p.quantite}</td>
    </tr>`).join("");
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:${c.headBg};color:${c.headText}">
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Quantité chargée</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="2" style="padding:10px;border:1px solid ${c.line};text-align:center;color:${c.faint}">Aucun produit rattaché (arrêts sans bon de livraison)</td></tr>`}</tbody>
      </table>`;
  } else {
    const rows = t.arrets.map((a) => {
      const s = STATUT_ARRET_LABEL[a.statut] ?? { label: a.statut, color: "muted" };
      const color = s.color === "accent" ? c.accent : s.color === "danger" ? c.danger : c.muted;
      const detail = a.statut === "NON_EFFECTUE" ? a.motifNonEffectue : a.statut === "INCIDENT" ? a.incidentDescription : "";
      return `<tr>
        <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center">${a.ordre}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line}">${esc(a.clientNom)}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line};text-align:center;color:${color};font-weight:600">${s.label}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line}">${a.heureArrivee ? fmtDateHeure(a.heureArrivee) : "—"}</td>
        <td style="padding:5px 8px;border:1px solid ${c.line};font-size:10px">${detail ? esc(detail) : "—"}</td>
      </tr>`;
    }).join("");
    const nbEffectues = t.arrets.filter((a) => a.statut === "EFFECTUE").length;
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:${c.headBg};color:${c.headText}">
          <th style="padding:5px 8px;border:1px solid ${c.line}">Ordre</th>
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Client</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Statut</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Heure</th>
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Détail</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:10px;font-size:11px;font-weight:600">Bilan : ${nbEffectues} / ${t.arrets.length} livraisons effectuées.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>${esc(t.reference)} — ${TITRES[variante]}${mono ? " (N/B)" : ""}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,"DM Sans",sans-serif; font-size:12.5px; color:${c.text}; background:#fff; padding:32px; max-width:780px; margin:0 auto; }
  @page { margin:1cm; size:A4 portrait; }
  @media print { body { padding:0; } }
</style></head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double ${c.rule};padding-bottom:14px">
    <div>
      <img src="${logoUrl}" alt="${SOCIETE.nom}" style="height:48px;width:auto;display:block;margin-bottom:8px;${c.logoFilter}"/>
      <h1 style="font-size:16px;font-weight:900;color:${c.accent}">${TITRES[variante]}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Logistique & livraison</p>
    </div>
    <div style="text-align:right">${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de tournée", esc(t.reference))}
    ${kv("Date", fmtDate(t.dateTournee))}
    ${kv("Livreur", esc(`${t.livreur.prenom} ${t.livreur.nom}`))}
    ${kv("Point de vente", esc(`${t.pointDeVente.nom} (${t.pointDeVente.code})`))}
    ${kv("Moyen de transport", dash(t.moyenTransport))}
    ${t.heureDepart ? kv("Heure de départ", fmtDateHeure(t.heureDepart)) : ""}
    ${t.heureRetour ? kv("Heure de retour", fmtDateHeure(t.heureRetour)) : ""}
    ${kv("Nombre d'arrêts", String(t.arrets.length))}
  </table>

  ${corps}

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(new Date().toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function FicheTournee({ variante, tournee, onClose }: { variante: VarianteTournee; tournee: TourneeData; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(`${origin}/dashboard/user/logistiquesApprovisionnements/tournees?tournee=${tournee.id}`, { margin: 1, width: 200 })
      .then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [origin, tournee.id]);

  const data = useMemo(() => tournee, [tournee]);

  return (
    <DocumentPrintShell
      title={TITRES[variante]}
      reference={tournee.reference}
      filename={`${variante.toLowerCase()}-${tournee.reference}.html`}
      buildHtml={(mono) => buildHtml(data, variante, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
