// lib/ficheRevendeurHtml.ts
// Documents du profil revendeur (CDC digitalisation §5.6) — une fonction à
// variantes plutôt que 4 fichiers séparés, même contenu source
// (ProfilRevendeur) : OUVERTURE / CARTE / GRILLE / CONVENTION / ATTESTATION.
// Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

export type VarianteRevendeur = "OUVERTURE" | "CARTE" | "GRILLE" | "CONVENTION" | "ATTESTATION";

const TITRES: Record<VarianteRevendeur, string> = {
  OUVERTURE: "FICHE D'OUVERTURE DE COMPTE REVENDEUR",
  CARTE: "CARTE PROFESSIONNELLE REVENDEUR",
  GRILLE: "GRILLE TARIFAIRE REVENDEUR",
  CONVENTION: "CONVENTION COMMERCIALE REVENDEUR",
  ATTESTATION: "ATTESTATION DE PARTENARIAT",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function dash(v: string | null | undefined): string { return v ? esc(v) : "—"; }
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
function fmtMoney(n: number): string { return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA"; }

export interface ProfilRevendeurHtmlData {
  id: number;
  raisonSociale: string;
  nomCommercial: string | null;
  nif: string | null;
  rccm: string | null;
  adresse: string | null;
  ville: string | null;
  contactTelephone: string | null;
  contactEmail: string | null;
  conditionsParticulieres: string | null;
  statut: string;
  dateOuverture: Date | string;
  user: { nom: string; prenom: string; email: string | null; telephone: string | null };
  pointDeVente: { nom: string; code: string } | null;
  ouvertPar: { nom: string; prenom: string };
}

export interface GrilleLigne { nom: string; prixDetail: number; prixGros: number }

export function genFicheRevendeurHtml(
  variante: VarianteRevendeur,
  p: ProfilRevendeurHtmlData,
  extra: { stats?: { nbFactures: number; totalFacture: number }; grille?: GrilleLigne[]; qrDataUrl?: string | null } = {},
): string {
  const noDoc = `${variante.slice(0, 3)}-REV-${p.id}`;
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:40%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;
  const table = (rows: string) => `<table style="width:100%;border-collapse:collapse;font-size:11.5px">${rows}</table>`;
  const sectionTitle = (t: string) => `<h2 style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#065f46;background:#ecfdf5;padding:5px 10px;border-left:3px solid #047857;margin:16px 0 6px">${t}</h2>`;

  const identite = `
    ${sectionTitle("Identité de l'entreprise")}
    ${table(
      kv("Raison sociale", esc(p.raisonSociale)) +
      (p.nomCommercial ? kv("Nom commercial", esc(p.nomCommercial)) : "") +
      kv("NIF", dash(p.nif)) +
      kv("RCCM", dash(p.rccm)) +
      kv("Adresse", dash(p.adresse)) +
      kv("Ville", dash(p.ville)),
    )}
    ${sectionTitle("Contact")}
    ${table(
      kv("Représentant", esc(`${p.user.prenom} ${p.user.nom}`)) +
      kv("Téléphone", dash(p.contactTelephone ?? p.user.telephone)) +
      kv("Email", dash(p.contactEmail ?? p.user.email)) +
      kv("Point de vente de rattachement", dash(p.pointDeVente?.nom)),
    )}
  `;

  let corps = "";
  if (variante === "OUVERTURE") {
    corps = identite + `
      ${sectionTitle("Ouverture du compte")}
      ${table(
        kv("Date d'ouverture", fmtDate(p.dateOuverture)) +
        kv("Ouvert par", esc(`${p.ouvertPar.prenom} ${p.ouvertPar.nom}`)) +
        kv("Statut", esc(p.statut)),
      )}
      <p style="margin:14px 0;line-height:1.5;text-align:justify;font-size:11px;background:#ecfdf5;border:1px solid #e2e8f0;padding:8px 12px;border-radius:4px">
        Ce document atteste l'ouverture du compte revendeur ci-dessus auprès de ${esc(SOCIETE.nom)}, donnant accès à la
        grille tarifaire de gros et au circuit de commande dédié (Espace Revendeur).
      </p>`;
  } else if (variante === "CARTE") {
    corps = identite + `
      ${sectionTitle("Statut du partenariat")}
      ${table(kv("Statut", esc(p.statut)) + kv("Partenaire depuis", fmtDate(p.dateOuverture)))}`;
  } else if (variante === "GRILLE") {
    const rows = (extra.grille ?? []).map((g) => `<tr>
      <td style="padding:4px 8px;border:1px solid #e2e8f0">${esc(g.nom)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right">${fmtMoney(g.prixDetail)}</td>
      <td style="padding:4px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:700;color:#047857">${fmtMoney(g.prixGros)}</td>
    </tr>`).join("");
    corps = `
      ${sectionTitle("Conditions tarifaires")}
      <p style="font-size:11px;color:#64748b;margin-bottom:8px">Prix grille GROS applicables au point de vente de rattachement (résolus automatiquement, mis à jour en temps réel dans le catalogue).</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#ecfdf5;color:#065f46">
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Prix détail</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Prix revendeur (gros)</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="3" style="padding:10px;border:1px solid #e2e8f0;text-align:center;color:#94a3b8">Aucun produit sélectionné</td></tr>`}</tbody>
      </table>
      ${p.conditionsParticulieres ? `<p style="margin-top:12px;font-size:11px"><strong>Conditions particulières :</strong> ${esc(p.conditionsParticulieres)}</p>` : ""}`;
  } else if (variante === "CONVENTION") {
    corps = identite + `
      ${sectionTitle("Objet de la convention")}
      <p style="margin:8px 0;line-height:1.6;text-align:justify;font-size:11px">
        La présente convention formalise les conditions commerciales entre ${esc(SOCIETE.nom)} et
        <strong>${esc(p.raisonSociale)}</strong> pour l'approvisionnement en gros des produits du
        catalogue ${esc(SOCIETE.nom)}, aux conditions tarifaires de la grille revendeur en vigueur.
      </p>
      ${p.conditionsParticulieres ? `
        ${sectionTitle("Conditions particulières accordées")}
        <p style="margin:8px 0;line-height:1.6;text-align:justify;font-size:11px">${esc(p.conditionsParticulieres)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:28px">
        <tr>
          ${["Pour AFRISIME", "Pour le revendeur"].map((r) => `
            <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
              <div style="border-top:1px solid #333;margin-top:34px;padding-top:6px;color:#555">${r}</div>
            </td>`).join("")}
        </tr>
      </table>`;
  } else {
    const anciennete = Math.floor((Date.now() - new Date(p.dateOuverture).getTime()) / (86_400_000 * 30));
    corps = `
      <div style="text-align:center;margin:24px 0">
        <p style="font-size:12px;color:#64748b">${esc(SOCIETE.nom)} certifie par la présente que</p>
        <p style="font-size:20px;font-weight:900;color:#047857;margin:8px 0">${esc(p.raisonSociale)}</p>
        <p style="font-size:11.5px;line-height:1.6;max-width:560px;margin:0 auto">
          est partenaire revendeur agréé depuis le <strong>${fmtDate(p.dateOuverture)}</strong>
          (${anciennete} mois), avec un volume d'achat cumulé de
          <strong>${fmtMoney(extra.stats?.totalFacture ?? 0)}</strong> sur ${extra.stats?.nbFactures ?? 0} facture(s).
        </p>
      </div>`;
  }

  const today = new Date();
  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:720px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">${esc(TITRES[variante])}</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Ventes en gros / B2B</p>
    </div>
    <div style="text-align:right">
      ${extra.qrDataUrl ? `<img src="${extra.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}
      <p style="font-size:8px;color:#94a3b8;margin-top:2px">Compte revendeur</p>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:12px">
    ${kv("N° de document", esc(noDoc))}
    ${kv("Date", fmtDate(today))}
  </table>

  ${corps}

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDate(today)} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
