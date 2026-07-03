"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Printer } from "lucide-react";
import QRCode from "qrcode";
import { toCanvas as barcodeToCanvas } from "bwip-js/browser";
import { buildCalendrier } from "@/lib/calendrierRemboursement";

// ─── Types (sous-ensembles de CreditItem / Client de ClientDetails) ────────────

export interface BordereauCredit {
  reference: string;
  statut: string;
  montantTotal: number | string;
  montantRembourse: number | string;
  soldeRestant: number | string;
  dureeJours: number;
  dateDebut: string;
  dateEcheanceFin: string;
  montantJournalier: number | string;
  fraisDossier: number | string;
  assurance: number | string;
  autresFrais: number | string;
  tauxInteret: number | string;
  montantInteret: number | string;
  tauxPenalite: number | string;
  delaiGraceJours: number;
  garantie: string | null;
  garantNom: string | null;
  garantTelephone: string | null;
  garantAdresse: string | null;
  garantTypeGarantie: string | null;
  garantValeurEstimee: number | string;
  observations: string | null;
  gestionnaireCredit?: { nom: string; prenom: string } | null;
  rvcPdv?: { nom: string; prenom: string } | null;
  createdAt: string;
  lignes: { id: number; produitNom: string; quantite: number; prixUnitaire: number | string; montantLigne: number | string }[];
  echeances: { id: number; numeroEcheance: number; dateEcheance: string; montantDu: number | string; montantPaye: number | string; statut: string; penalite: number | string }[];
  remboursements: { id: number; montant: number | string; dateRemboursement: string; modePaiement: string; notes: string | null; statut: string; numeroJour: number | null; enregistrePar: { nom: string; prenom: string }; agentCollecteur: { nom: string; prenom: string } | null }[];
  creePar: { nom: string; prenom: string };
  validePar: { nom: string; prenom: string } | null;
}

export interface BordereauClient {
  id: number;
  codeClient: string | null;
  nom: string; prenom: string;
  sexe: string | null;
  telephone: string;
  adresse: string | null;
  quartier: string | null;
  activite: string | null;
  nomCommerce: string | null;
  numeroCNI: string | null;
  numeroCarteAfrisime: string | null;
  agentTerrain?: { nom: string; prenom: string; telephone?: string | null } | null;
  pointDeVente?: { nom: string; code: string } | null;
  pointsDeVente?: { pointDeVente: { nom: string; code: string } }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const N = (v: number | string | null | undefined) => Number(v ?? 0);
const fmt = (v: number | string | null | undefined) => new Intl.NumberFormat("fr-FR").format(Math.round(N(v))) + " FCFA";
const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));

const SEXE_LABEL: Record<string, string> = { MASCULIN: "Masculin", FEMININ: "Féminin", AUTRE: "Autre" };

/** Code-barres décoratif (SVG) dérivé de la référence — non scannable. */
function barcodeSvg(text: string, color: string): string {
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (let b = 0; b < 4; b++) {
      const w = ((code >> b) & 1) ? 3 : 1;
      if ((i + b) % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="38" fill="${color}"/>`);
      x += w + 1;
    }
  }
  return `<svg width="100%" height="38" viewBox="0 0 ${x} 38" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars.join("")}</svg>`;
}

interface Palette {
  text: string; muted: string; faint: string; rule: string; line: string;
  headBg: string; headText: string; accent: string; danger: string;
  logoFilter: string; barColor: string;
}

function buildBordereauHtml(credit: BordereauCredit, client: BordereauClient, origin: string, mono: boolean, qrDataUrl: string, barcodeUrl: string): string {
  const c: Palette = mono
    ? { text: "#000", muted: "#333", faint: "#555", rule: "#000", line: "#999", headBg: "#eee", headText: "#000", accent: "#000", danger: "#000", logoFilter: "filter:grayscale(1);", barColor: "#000" }
    : { text: "#0f172a", muted: "#475569", faint: "#94a3b8", rule: "#047857", line: "#e2e8f0", headBg: "#ecfdf5", headText: "#065f46", accent: "#047857", danger: "#dc2626", logoFilter: "", barColor: "#0f172a" };

  const logoUrl  = `${origin}/afrisime-logo.svg`;
  const dossierUrl = `${origin}/suivi/${credit.reference}`;
  const noBordereau = `BR-${credit.reference}`;
  const today = new Date();

  const pdv = client.pointDeVente?.nom ?? client.pointsDeVente?.[0]?.pointDeVente.nom ?? "—";
  const agent = client.agentTerrain ? `${client.agentTerrain.prenom} ${client.agentTerrain.nom}` : "—";
  const nomUser = (u?: { nom: string; prenom: string } | null) => (u ? `${u.prenom} ${u.nom}` : null);
  const gestionnaire =
    nomUser(credit.gestionnaireCredit) ??
    nomUser(credit.rvcPdv) ??
    nomUser(credit.validePar) ??
    nomUser(credit.creePar) ??
    "—";

  // ── D. Résumé financier ──
  const valeurProduits = credit.lignes.reduce((s, l) => s + N(l.montantLigne), 0);
  const montantTotal   = N(credit.montantTotal);

  // ── F. Pénalités ──
  const retards       = credit.echeances.filter((e) => e.statut !== "PAYE" && new Date(e.dateEcheance) < today);
  const nombreRetards = retards.length;
  const tauxPen       = N(credit.tauxPenalite);
  const grace         = credit.delaiGraceJours ?? 0;
  const joursRetardFactures = Math.max(0, nombreRetards - grace);
  const penalitesStored = credit.echeances.reduce((s, e) => s + N(e.penalite), 0);
  const totalPenalites  = penalitesStored > 0 ? penalitesStored : Math.round(N(credit.montantJournalier) * (tauxPen / 100) * joursRetardFactures);

  // ── E. Calendrier journalier — TOUTES les lignes jusqu'à la fin du crédit ──
  // On génère 1..dureeJours ; on utilise l'échéance réelle si elle existe (crédit validé),
  // sinon on synthétise (date = dateDebut + n, montant prévu = journalier, dernier jour = résiduel).
  const STATUT_CAL_LABEL: Record<string, string> = { PAYE: "Payé", EN_RETARD: "En retard", A_VENIR: "" };
  const calendrierRows = buildCalendrier({
    dureeJours:        credit.dureeJours,
    dateDebut:         credit.dateDebut,
    montantTotal:      credit.montantTotal,
    montantJournalier: credit.montantJournalier,
    echeances:         credit.echeances,
  }, today).map((r) => {
    const enRetard = r.statut === "EN_RETARD";
    const estPaye  = r.statut === "PAYE";
    return `<tr>
      <td style="padding:5px 6px;border:1px solid ${c.line};text-align:center">${r.jour}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line}">${fmtDate(r.date)}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line};text-align:right">${fmt(r.montantPrevu)}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line};text-align:right">${fmt(r.montantPaye)}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line};text-align:right">${fmt(r.soldeRestant)}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line};text-align:center;${enRetard ? `color:${c.danger};font-weight:600` : estPaye ? `color:${c.accent};font-weight:600` : ""}">${STATUT_CAL_LABEL[r.statut]}</td>
      <td style="padding:5px 6px;border:1px solid ${c.line}"></td>
    </tr>`;
  }).join("");

  // ── Helpers de rendu ──
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:5px 8px;border:1px solid ${c.line};color:${c.muted};width:45%">${k}</td>
    <td style="padding:5px 8px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:6px 10px;border-left:3px solid ${c.accent};margin:22px 0 8px">${t}</h2>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:12px">${rows}</table>`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Bordereau ${esc(credit.reference)}${mono ? " (N/B)" : ""}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,"DM Sans",sans-serif; font-size:12px; color:${c.text}; background:#fff; padding:32px; max-width:800px; margin:0 auto; }
  h1 { line-height:1.1; }
  @page { margin:1cm; size:A4 portrait; }
  @media print { body { padding:0; } * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; } tr { break-inside:avoid; } }
</style></head>
<body>

  <!-- A. En-tête -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double ${c.rule};padding-bottom:14px">
    <div style="flex:1">
      <img src="${logoUrl}" alt="AFRISIME" style="height:52px;width:auto;display:block;margin-bottom:8px;${c.logoFilter}"/>
      <h1 style="font-size:18px;font-weight:900;color:${c.accent}">BORDEREAU DE REMBOURSEMENT DE CRÉDIT</h1>
      <p style="font-size:12px;color:${c.muted}">AFRISIME — Solutions de Crédit Alimentaire</p>
    </div>
    <div style="text-align:right;min-width:220px">
      <table style="font-size:11px;border-collapse:collapse;margin-left:auto">
        ${kv("N° du Bordereau", esc(noBordereau))}
        ${kv("N° du Crédit", esc(credit.reference))}
        ${kv("Date d'émission", fmtDate(today.toISOString()))}
        ${kv("Version", "v1.0")}
      </table>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;align-items:flex-end">
        <div style="text-align:center">
          ${qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR dossier client" style="width:78px;height:78px;${c.logoFilter}"/>`
            : `<div style="width:78px;height:78px;border:1px solid ${c.line};display:flex;align-items:center;justify-content:center;font-size:9px;color:${c.faint}">QR</div>`}
          <p style="font-size:8px;color:${c.faint};margin-top:1px">Suivi remboursement</p>
        </div>
      </div>
      <div style="margin-top:6px">${barcodeUrl
        ? `<img src="${barcodeUrl}" alt="code-barres" style="width:100%;height:40px;object-fit:contain;${c.logoFilter}"/>`
        : barcodeSvg(credit.reference, c.barColor)}</div>
      <p style="font-size:9px;color:${c.faint};text-align:center;letter-spacing:2px">${esc(credit.reference)}</p>
      <p style="font-size:8px;color:${c.faint};text-align:right;word-break:break-all">${esc(dossierUrl)}</p>
    </div>
  </div>

  <!-- B. Informations du client -->
  ${sectionTitle("B. Informations du client")}
  ${table(
    kv("Code Client", dash(client.codeClient)) +
    kv("Nom & Prénoms", esc(`${client.prenom} ${client.nom}`)) +
    kv("Sexe", client.sexe ? (SEXE_LABEL[client.sexe] ?? client.sexe) : "—") +
    kv("Téléphone", dash(client.telephone)) +
    kv("Adresse", dash(client.adresse)) +
    kv("N° Carte Client AfriSime", dash(client.numeroCarteAfrisime)),
  )}

  <!-- C. Informations du crédit -->
  ${sectionTitle("C. Informations du crédit")}
  ${table(
    kv("Type de crédit", "Crédit alimentaire journalier") +
    kv("Date d'octroi", fmtDate(credit.createdAt)) +
    kv("Agent affecté", esc(agent)) +
    kv("Numéro de l'agent", dash(client.agentTerrain?.telephone)) +
    kv("Point de vente", esc(pdv)) +
    kv("Gestionnaire du crédit", esc(gestionnaire)),
  )}

  <!-- D. Résumé financier -->
  ${sectionTitle("D. Résumé financier du crédit")}
  ${table(
    kv("Valeur des produits achetés", fmt(valeurProduits)) +
    kv("Frais de dossier", fmt(credit.fraisDossier)) +
    kv("Assurance (si applicable)", fmt(credit.assurance)) +
    kv("Autres frais", fmt(credit.autresFrais)) +
    kv("Taux d'intérêt appliqué", `${N(credit.tauxInteret)} %`) +
    kv("Intérêt total", fmt(credit.montantInteret)) +
    kv("Montant total du crédit accordé", fmt(montantTotal)) +
    kv("Taux de pénalité appliqué", `${tauxPen} % / jour`) +
    kv("Montant total à rembourser", fmt(montantTotal)) +
    kv("Durée du remboursement", `${credit.dureeJours} jour(s)`) +
    kv("Nombre total de jours", String(credit.dureeJours)) +
    kv("Montant journalier", fmt(credit.montantJournalier)) +
    kv("Date du premier remboursement", fmtDate(credit.dateDebut)) +
    kv("Date de fin prévue", fmtDate(credit.dateEcheanceFin)),
  )}

  <!-- E. Calendrier de remboursement journalier -->
  ${sectionTitle("E. Calendrier de remboursement journalier")}
  <table style="width:100%;border-collapse:collapse;font-size:11px">
    <thead><tr style="background:${c.headBg};color:${c.headText}">
      <th style="padding:6px;border:1px solid ${c.line}">Jour</th>
      <th style="padding:6px;border:1px solid ${c.line}">Date échéance</th>
      <th style="padding:6px;border:1px solid ${c.line}">Montant prévu</th>
      <th style="padding:6px;border:1px solid ${c.line}">Montant payé</th>
      <th style="padding:6px;border:1px solid ${c.line}">Solde restant</th>
      <th style="padding:6px;border:1px solid ${c.line}">Statut</th>
      <th style="padding:6px;border:1px solid ${c.line}">Signature agent</th>
    </tr></thead>
    <tbody>${calendrierRows || `<tr><td colspan="7" style="padding:10px;border:1px solid ${c.line};text-align:center;color:${c.faint}">Durée du crédit non définie</td></tr>`}</tbody>
  </table>

  <!-- F. Gestion des pénalités -->
  ${sectionTitle("F. Gestion des pénalités")}
  ${table(
    kv("Délai de grâce", `${grace} jour(s)`) +
    kv("Début des pénalités", grace > 0 ? `Après ${grace} jour(s) de retard` : "Dès le 1er jour de retard") +
    kv("Type de pénalité", "Pourcentage") +
    kv("Valeur de la pénalité", `${tauxPen} % / jour`) +
    kv("Nombre de jours de retard facturables", String(joursRetardFactures)) +
    kv("Total des pénalités", fmt(totalPenalites)),
  )}
  <p style="font-size:10px;color:${c.faint};margin-top:4px;font-style:italic">Calcul auto : montant journalier × taux × jours de retard = ${fmt(credit.montantJournalier)} × ${tauxPen}% × ${joursRetardFactures} = ${fmt(totalPenalites)}.</p>

  <!-- G. Consentement -->
  ${sectionTitle("G. Consentement du client")}
  <p style="font-size:11px;line-height:1.6;color:${c.text};text-align:justify;border:1px solid ${c.line};background:${c.headBg};padding:10px 12px;border-radius:4px">
    Par la présente, je reconnais avoir bénéficié d'un crédit accordé par AFRISIME et m'engage
    irrévocablement à rembourser le montant total indiqué sur ce bordereau selon le calendrier
    convenu. Je reconnais avoir pris connaissance des conditions de remboursement, des pénalités
    applicables en cas de retard et des dispositions prévues en cas de non-respect de mes engagements.
  </p>

  <!-- H. Signatures -->
  ${sectionTitle("H. Signatures")}
  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:24px">
    <tr>
      ${["Client", "Agent affecté", "Responsable crédit"].map((r) => `
        <td style="width:33%;text-align:center;padding:0 12px;vertical-align:top">
          <div style="border-top:1px solid ${c.text};margin-top:44px;padding-top:6px;color:${c.muted}">${r}</div>
        </td>`).join("")}
    </tr>
  </table>

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:26px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · AFRISIME — Réinventer la distribution pour une Afrique plus prospère · RCCM : TG-LFW-01-2026-B12-00649 | NIF : 1002122728
  </p>

</body></html>`;
}

function openPrint(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  } else {
    win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
    setTimeout(() => { try { win.print(); } catch { /* ignoré */ } URL.revokeObjectURL(url); }, 1500);
  }
}

// ─── Composant ─────────────────────────────────────────────────────────────────

export default function BordereauRemboursement({ credit, client, onClose }: {
  credit: BordereauCredit;
  client: BordereauClient;
  onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const dossierUrl = `${origin}/suivi/${credit.reference}`;

  // QR code (data URL) pointant vers la page publique de suivi — généré côté navigateur.
  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(dossierUrl, { margin: 1, width: 220 })
      .then((url) => { if (alive) setQr(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [dossierUrl]);

  // Code-barres Code128 (data URL) de la référence du crédit — généré côté navigateur.
  const [barcode, setBarcode] = useState("");
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      barcodeToCanvas(canvas, { bcid: "code128", text: credit.reference, scale: 2, height: 9, includetext: false });
      setBarcode(canvas.toDataURL("image/png"));
    } catch { /* lib indispo → repli SVG décoratif */ }
  }, [credit.reference]);

  const previewHtml = useMemo(
    () => buildBordereauHtml(credit, client, origin, false, qr, barcode),
    [credit, client, origin, qr, barcode],
  );
  const filename = `bordereau-${credit.reference}.html`;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">Bordereau de remboursement</h3>
            <p className="text-xs text-slate-400 font-mono">{credit.reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openPrint(buildBordereauHtml(credit, client, origin, true, qr, barcode), filename)}
              title="Impression noir & blanc, économe en encre"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Printer size={14} /> Imprimer en N/B
            </button>
            <button
              onClick={() => openPrint(previewHtml, filename)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Aperçu (iframe = même HTML que l'impression) */}
        <div className="flex-1 overflow-hidden bg-slate-100 p-4">
          <iframe title="Aperçu bordereau" srcDoc={previewHtml} className="w-full h-full bg-white rounded-lg border border-slate-200" />
        </div>
      </div>
    </div>
  );
}
