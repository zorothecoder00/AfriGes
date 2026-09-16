"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";
import { DocumentPrintShell, esc, dash, fmtMoney, fmtDate, palette } from "@/components/DocumentPrintShell";

/**
 * Documents du profil revendeur (CDC digitalisation §5.6) — un composant à
 * variantes plutôt que 4 fichiers séparés, même contenu source (ProfilRevendeur) :
 *  - OUVERTURE   → "Fiche d'ouverture de compte revendeur"
 *  - CARTE       → "Carte / fiche client professionnel"
 *  - GRILLE      → "Grille tarifaire revendeur" (résolue via TypePrix.GROS)
 *  - CONVENTION  → "Convention commerciale revendeur" (+ conditions particulières)
 *  - ATTESTATION → "Attestation de fidélité / partenariat"
 */

export type VarianteRevendeur = "OUVERTURE" | "CARTE" | "GRILLE" | "CONVENTION" | "ATTESTATION";

export interface ProfilRevendeurData {
  id: number;
  raisonSociale: string;
  nomCommercial: string | null;
  nif: string | null;
  rccm: string | null;
  adresse: string | null;
  ville: string | null;
  contactNom: string | null;
  contactTelephone: string | null;
  contactEmail: string | null;
  conditionsParticulieres: string | null;
  statut: string;
  dateOuverture: string;
  user: { nom: string; prenom: string; email: string | null; telephone: string | null };
  pointDeVente: { id: number; nom: string; code: string } | null;
  ouvertPar: { nom: string; prenom: string };
}

export interface GrilleLigne { nom: string; prixDetail: number; prixGros: number }

interface Props {
  variante: VarianteRevendeur;
  profil: ProfilRevendeurData;
  stats?: { nbFactures: number; totalFacture: number };
  grille?: GrilleLigne[];
  onClose: () => void;
}

const TITRES: Record<VarianteRevendeur, string> = {
  OUVERTURE: "FICHE D'OUVERTURE DE COMPTE REVENDEUR",
  CARTE: "CARTE PROFESSIONNELLE REVENDEUR",
  GRILLE: "GRILLE TARIFAIRE REVENDEUR",
  CONVENTION: "CONVENTION COMMERCIALE REVENDEUR",
  ATTESTATION: "ATTESTATION DE PARTENARIAT",
};

function buildHtml(p: Omit<Props, "onClose">, origin: string, mono: boolean, qrDataUrl: string): string {
  const c = palette(mono);
  const logoUrl = `${origin}/nouveaulogo.jpeg`;
  const today = new Date();
  const noDoc = `${p.variante.slice(0, 3)}-REV-${p.profil.id}`;

  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid ${c.line};color:${c.muted};width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid ${c.line};font-weight:600;color:${c.text}">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${c.headText};background:${c.headBg};padding:5px 10px;border-left:3px solid ${c.accent};margin:16px 0 6px">${t}</h2>`;

  const identite = `
    ${sectionTitle("Identité de l'entreprise")}
    ${table(
      kv("Raison sociale", esc(p.profil.raisonSociale)) +
      (p.profil.nomCommercial ? kv("Nom commercial", esc(p.profil.nomCommercial)) : "") +
      kv("NIF", dash(p.profil.nif)) +
      kv("RCCM", dash(p.profil.rccm)) +
      kv("Adresse", dash(p.profil.adresse)) +
      kv("Ville", dash(p.profil.ville)),
    )}
    ${sectionTitle("Contact")}
    ${table(
      kv("Représentant", esc(`${p.profil.user.prenom} ${p.profil.user.nom}`)) +
      kv("Téléphone", dash(p.profil.contactTelephone ?? p.profil.user.telephone)) +
      kv("Email", dash(p.profil.contactEmail ?? p.profil.user.email)) +
      kv("Point de vente de rattachement", dash(p.profil.pointDeVente?.nom)),
    )}
  `;

  let corps = "";
  if (p.variante === "OUVERTURE") {
    corps = identite + `
      ${sectionTitle("Ouverture du compte")}
      ${table(
        kv("Date d'ouverture", fmtDate(p.profil.dateOuverture)) +
        kv("Ouvert par", esc(`${p.profil.ouvertPar.prenom} ${p.profil.ouvertPar.nom}`)) +
        kv("Statut", p.profil.statut),
      )}
      <p style="margin:14px 0;line-height:1.5;text-align:justify;font-size:11px;background:${c.headBg};border:1px solid ${c.line};padding:8px 12px;border-radius:4px">
        Ce document atteste l'ouverture du compte revendeur ci-dessus auprès de ${SOCIETE.nom}, donnant accès à la
        grille tarifaire de gros et au circuit de commande dédié (Espace Revendeur).
      </p>`;
  } else if (p.variante === "CARTE") {
    corps = identite + `
      ${sectionTitle("Statut du partenariat")}
      ${table(kv("Statut", p.profil.statut) + kv("Partenaire depuis", fmtDate(p.profil.dateOuverture)))}`;
  } else if (p.variante === "GRILLE") {
    const rows = (p.grille ?? []).map((g) => `<tr>
      <td style="padding:4px 8px;border:1px solid ${c.line}">${esc(g.nom)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right">${fmtMoney(g.prixDetail)}</td>
      <td style="padding:4px 8px;border:1px solid ${c.line};text-align:right;font-weight:700;color:${c.accent}">${fmtMoney(g.prixGros)}</td>
    </tr>`).join("");
    corps = `
      ${sectionTitle("Conditions tarifaires")}
      <p style="font-size:11px;color:${c.muted};margin-bottom:8px">Prix grille GROS applicables au point de vente de rattachement (résolus automatiquement, mis à jour en temps réel dans le catalogue).</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:${c.headBg};color:${c.headText}">
          <th style="padding:5px 8px;border:1px solid ${c.line};text-align:left">Produit</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Prix détail</th>
          <th style="padding:5px 8px;border:1px solid ${c.line}">Prix revendeur (gros)</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="3" style="padding:10px;border:1px solid ${c.line};text-align:center;color:${c.faint}">Aucun produit sélectionné</td></tr>`}</tbody>
      </table>
      ${p.profil.conditionsParticulieres ? `<p style="margin-top:12px;font-size:11px"><strong>Conditions particulières :</strong> ${esc(p.profil.conditionsParticulieres)}</p>` : ""}`;
  } else if (p.variante === "CONVENTION") {
    corps = identite + `
      ${sectionTitle("Objet de la convention")}
      <p style="margin:8px 0;line-height:1.6;text-align:justify;font-size:11px">
        La présente convention formalise les conditions commerciales entre ${SOCIETE.nom} et
        <strong>${esc(p.profil.raisonSociale)}</strong> pour l'approvisionnement en gros des produits du
        catalogue ${SOCIETE.nom}, aux conditions tarifaires de la grille revendeur en vigueur.
      </p>
      ${p.profil.conditionsParticulieres ? `
        ${sectionTitle("Conditions particulières accordées")}
        <p style="margin:8px 0;line-height:1.6;text-align:justify;font-size:11px">${esc(p.profil.conditionsParticulieres)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:28px">
        <tr>
          ${["Pour AFRISIME", "Pour le revendeur"].map((r) => `
            <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
              <div style="border-top:1px solid ${c.text};margin-top:34px;padding-top:6px;color:${c.muted}">${r}</div>
            </td>`).join("")}
        </tr>
      </table>`;
  } else {
    const anciennete = Math.floor((Date.now() - new Date(p.profil.dateOuverture).getTime()) / (86_400_000 * 30));
    corps = `
      <div style="text-align:center;margin:24px 0">
        <p style="font-size:12px;color:${c.muted}">${SOCIETE.nom} certifie par la présente que</p>
        <p style="font-size:20px;font-weight:900;color:${c.accent};margin:8px 0">${esc(p.profil.raisonSociale)}</p>
        <p style="font-size:11.5px;line-height:1.6;max-width:560px;margin:0 auto">
          est partenaire revendeur agréé depuis le <strong>${fmtDate(p.profil.dateOuverture)}</strong>
          (${anciennete} mois), avec un volume d'achat cumulé de
          <strong>${fmtMoney(p.stats?.totalFacture ?? 0)}</strong> sur ${p.stats?.nbFactures ?? 0} facture(s).
        </p>
      </div>`;
  }

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
      <h1 style="font-size:16px;font-weight:900;color:${c.accent}">${TITRES[p.variante]}</h1>
      <p style="font-size:11px;color:${c.muted}">${SOCIETE.nom} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" style="width:72px;height:72px;${c.logoFilter}"/>` : ""}
      <p style="font-size:8px;color:${c.faint};margin-top:2px">Compte revendeur</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(noDoc))}
    ${kv("Date", fmtDate(today.toISOString()))}
  </table>

  ${corps}

  <p style="text-align:center;font-size:9px;color:${c.faint};margin-top:20px;border-top:1px solid ${c.line};padding-top:8px">
    Document généré le ${fmtDate(today.toISOString())} · ${SOCIETE_PIED}
  </p>
</body></html>`;
}

export default function FicheRevendeur({ variante, profil, stats, grille, onClose }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrUrl = `${origin}/dashboard/admin/revendeurs/${profil.id}`;

  const [qr, setQr] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(qrUrl, { margin: 1, width: 200 }).then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [qrUrl]);

  const data = useMemo(() => ({ variante, profil, stats, grille }), [variante, profil, stats, grille]);

  return (
    <DocumentPrintShell
      title={TITRES[variante]}
      reference={profil.raisonSociale}
      filename={`${variante.toLowerCase()}-revendeur-${profil.id}.html`}
      buildHtml={(mono) => buildHtml(data, origin, mono, qr)}
      onClose={onClose}
    />
  );
}
