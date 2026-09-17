// lib/ficheTourneeHtml.ts
// Documents de tournée (CDC digitalisation §5.7) — une fonction à variantes :
//  - MISSION    → "Fiche de tournée" / "Fiche de mission du livreur" (avant départ)
//  - CHARGEMENT → "Fiche de chargement" (agrégée depuis les bons de livraison des arrêts)
//  - BORDEREAU  → "Bordereau de livraison" (récap après déroulement)
// Même convention que lib/bordereauRemiseHtml.ts.

import { SOCIETE, SOCIETE_PIED } from "@/lib/societe";

export type VarianteTournee = "MISSION" | "CHARGEMENT" | "BORDEREAU";

const TITRES: Record<VarianteTournee, string> = {
  MISSION: "FICHE DE TOURNÉE / MISSION LIVREUR",
  CHARGEMENT: "FICHE DE CHARGEMENT",
  BORDEREAU: "BORDEREAU DE LIVRAISON",
};
const STATUT_ARRET_LABEL: Record<string, { label: string; color: string }> = {
  PLANIFIE: { label: "Planifié", color: "#64748b" },
  EFFECTUE: { label: "Effectué", color: "#047857" },
  NON_EFFECTUE: { label: "Non effectué", color: "#dc2626" },
  INCIDENT: { label: "Incident", color: "#dc2626" },
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
function fmtDateHeure(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export interface ArretTourneeHtml {
  ordre: number; statut: string;
  clientNom: string; clientTelephone: string | null; adresseLivraison: string | null;
  heureArrivee: Date | string | null; motifNonEffectue: string | null; incidentDescription: string | null;
  bonLivraison: { lignes: { quantite: number; produit: { nom: string; codeProduit: string | null } }[] } | null;
}

export interface TourneeHtmlData {
  reference: string; statut: string; dateTournee: Date | string;
  moyenTransport: string | null; heureDepart: Date | string | null; heureRetour: Date | string | null;
  notes: string | null;
  livreur: { nom: string; prenom: string };
  pointDeVente: { nom: string; code: string };
  arrets: ArretTourneeHtml[];
  qrDataUrl?: string | null;
}

export function genFicheTourneeHtml(variante: VarianteTournee, t: TourneeHtmlData): string {
  const kv = (k: string, v: string) => `<tr>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;color:#64748b;width:38%">${k}</td>
    <td style="padding:4px 10px;border:1px solid #e2e8f0;font-weight:600;color:#1a1a1a">${v}</td></tr>`;

  let corps = "";
  if (variante === "MISSION") {
    const rows = t.arrets.map((a) => `<tr>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${a.ordre}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(a.clientNom)}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${dash(a.clientTelephone)}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${dash(a.adresseLivraison)}</td>
    </tr>`).join("");
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:#ecfdf5;color:#065f46">
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Ordre</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Client</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Téléphone</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Adresse</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${t.notes ? `<p style="margin-top:12px;font-size:11px"><strong>Instructions :</strong> ${esc(t.notes)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:32px">
        <tr>
          ${["Livreur", "Responsable logistique"].map((r) => `
            <td style="width:50%;text-align:center;padding:0 12px;vertical-align:top">
              <div style="border-top:1px solid #333;margin-top:34px;padding-top:6px;color:#555">${r}</div>
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
      <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(p.nom)}${p.code ? ` <span style="color:#94a3b8">(${esc(p.code)})</span>` : ""}</td>
      <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:700">${p.quantite}</td>
    </tr>`).join("");
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:#ecfdf5;color:#065f46">
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Produit</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Quantité chargée</th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="2" style="padding:10px;border:1px solid #e2e8f0;text-align:center;color:#94a3b8">Aucun produit rattaché (arrêts sans bon de livraison)</td></tr>`}</tbody>
      </table>`;
  } else {
    const rows = t.arrets.map((a) => {
      const s = STATUT_ARRET_LABEL[a.statut] ?? { label: a.statut, color: "#64748b" };
      const detail = a.statut === "NON_EFFECTUE" ? a.motifNonEffectue : a.statut === "INCIDENT" ? a.incidentDescription : "";
      return `<tr>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center">${a.ordre}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0">${esc(a.clientNom)}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:center;color:${s.color};font-weight:600">${s.label}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0">${a.heureArrivee ? fmtDateHeure(a.heureArrivee) : "—"}</td>
        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:10px">${detail ? esc(detail) : "—"}</td>
      </tr>`;
    }).join("");
    const nbEffectues = t.arrets.filter((a) => a.statut === "EFFECTUE").length;
    corps = `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;margin-top:14px">
        <thead><tr style="background:#ecfdf5;color:#065f46">
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Ordre</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Client</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Statut</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0">Heure</th>
          <th style="padding:5px 8px;border:1px solid #e2e8f0;text-align:left">Détail</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:10px;font-size:11px;font-weight:600">Bilan : ${nbEffectues} / ${t.arrets.length} livraisons effectuées.</p>`;
  }

  return `
<div style="font-family:Arial,'DM Sans',sans-serif; max-width:780px; margin:0 auto; padding:32px; color:#1a1a1a; font-size:12.5px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:3px double #047857;padding-bottom:14px">
    <div>
      <h1 style="font-size:16px;font-weight:900;color:#047857;margin:0">${esc(TITRES[variante])}</h1>
      <p style="font-size:11px;color:#64748b;margin:4px 0 0">${esc(SOCIETE.nom)} — Logistique &amp; livraison</p>
    </div>
    <div style="text-align:right">${t.qrDataUrl ? `<img src="${t.qrDataUrl}" alt="QR de vérification" style="width:72px;height:72px"/>` : ""}</div>
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

  <p style="text-align:center;font-size:9px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px">
    Document généré le ${fmtDate(new Date())} · ${esc(SOCIETE_PIED)}
  </p>
</div>`.trim();
}
