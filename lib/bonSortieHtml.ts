// lib/bonSortieHtml.ts
// Bon de sortie de marchandises — accusé imprimable (CDC digitalisation §3.4).
// Même convention que lib/bonCommandeHtml.ts : fragment HTML autonome, en-tête/pied
// société (lib/societe.ts), QR d'instance, signature électronique (nom + horodatage).

import { SOCIETE, SOCIETE_LEGAL } from "@/lib/societe";

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon / en attente",
  VALIDE: "Validé — sortie exécutée",
  ANNULE: "Annulé",
};

const TYPE_LABEL: Record<string, string> = {
  VENTE_DIRECTE: "Vente directe",
  LIVRAISON_PACK: "Livraison pack",
  LIVRAISON_CLIENT: "Livraison client",
  RETOUR_FOURNISSEUR: "Retour fournisseur",
  CONSOMMATION_INTERNE: "Consommation interne",
  TRANSFERT_SORTANT: "Transfert sortant",
  AJUSTEMENT_NEGATIF: "Ajustement négatif",
  PERTE: "Perte",
  CASSE: "Casse",
  VOL: "Vol",
  DON: "Don",
};

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDateFr(date?: Date | string | null): string {
  if (!date) return "___________";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "___________";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

export interface BonSortieLigneHtml {
  produitNom: string;
  quantiteDemandee: number | null;
  quantite: number;
  prixUnit: number | null;
}

export interface BonSortieHtmlData {
  reference: string; statut: string; typeSortie: string; motif: string; notes: string | null;
  commentaireEcart: string | null;
  pointDeVente: { nom: string; code: string };
  /** Client destinataire (livraison client : via la commande / le bon de livraison) */
  client?: { nom: string; telephone: string | null } | null;
  commandeReference?: string | null;
  lignes: BonSortieLigneHtml[];
  montantTotal: number | null;
  creePar: { nom: string; prenom: string };
  validePar: { nom: string; prenom: string } | null;
  dateValidation: Date | string | null;
  visePar: { nom: string; prenom: string } | null;
  dateVisa: Date | string | null;
  qrDataUrl?: string | null;
}

export function genBonSortieHtml(d: BonSortieHtmlData): string {
  // Pertes/casses/vols… : pas de "demande" préalable → colonne masquée si aucune ligne n'en a une.
  const aDemande = d.lignes.some((l) => l.quantiteDemandee != null);
  const lignesHtml = d.lignes.map((l) => {
    const ecart = l.quantiteDemandee != null && l.quantiteDemandee !== l.quantite;
    return `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">${esc(l.produitNom)}</td>
      ${aDemande ? `<td style="padding:8px; border-bottom:1px solid #eee; text-align:center;">${l.quantiteDemandee ?? "—"}</td>` : ""}
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:center; ${ecart ? "color:#b45309; font-weight:bold;" : ""}">${l.quantite}</td>
      <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${l.prixUnit != null ? fmtMontant(l.quantite * l.prixUnit) : "—"}</td>
    </tr>`;
  }).join("");

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:720px; margin:0 auto; padding:40px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:16px; margin-bottom:24px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de sortie</h2>
      <p style="font-size:13px; margin:4px 0 0;"><strong>${esc(d.reference)}</strong></p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${TYPE_LABEL[d.typeSortie] ?? d.typeSortie} · ${STATUT_LABEL[d.statut] ?? d.statut}</p>
      ${d.qrDataUrl ? `<img src="${d.qrDataUrl}" alt="QR de vérification" style="width:72px; height:72px; margin-top:8px;" />` : ""}
    </div>
  </div>

  <div style="padding:14px 18px; background:#f8fafc; border-radius:8px; margin-bottom:20px;">
    <p style="font-size:11px; color:#64748b; text-transform:uppercase; margin:0 0 6px;">Point de vente / Dépôt</p>
    <p style="margin:0; font-weight:bold;">${esc(d.pointDeVente.nom)} (${esc(d.pointDeVente.code)})</p>
    ${d.client ? `<p style="margin:8px 0 0; font-size:12px;"><strong>Client :</strong> ${esc(d.client.nom)}${d.client.telephone ? ` · ${esc(d.client.telephone)}` : ""}${d.commandeReference ? ` <span style="color:#64748b;">(commande ${esc(d.commandeReference)})</span>` : ""}</p>` : ""}
    <p style="margin:6px 0 0; font-size:12px;"><strong>Motif :</strong> ${esc(d.motif)}</p>
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:8px; text-align:left;">Produit</th>
        ${aDemande ? `<th style="padding:8px; text-align:center;">Qté demandée</th>` : ""}
        <th style="padding:8px; text-align:center;">Qté sortie</th>
        <th style="padding:8px; text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${lignesHtml}</tbody>
  </table>
  ${d.montantTotal != null ? `
  <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
    <div style="width:260px; padding:12px 18px; background:#0f172a; color:#fff; border-radius:8px; display:flex; justify-content:space-between;">
      <span style="font-weight:bold;">Valorisation</span>
      <span style="font-weight:bold;">${fmtMontant(d.montantTotal)} XOF</span>
    </div>
  </div>` : ""}

  ${d.commentaireEcart ? `<p style="font-size:12px; color:#b45309; margin-bottom:16px;"><strong>Écart quantité :</strong> ${esc(d.commentaireEcart)}</p>` : ""}
  ${d.notes ? `<p style="font-size:12px; color:#475569; margin-bottom:16px;"><strong>Notes :</strong> ${esc(d.notes)}</p>` : ""}

  ${d.visePar ? `
  <div style="padding:10px 16px; background:#fef9c3; border:1px solid #fde68a; border-radius:8px; margin-bottom:16px; font-size:12px; color:#854d0e;">
    <strong>Visa</strong> — accordé par ${esc(d.visePar.prenom)} ${esc(d.visePar.nom)} le ${formatDateFr(d.dateVisa)} (seuil de validation dépassé).
  </div>` : ""}

  <div style="margin-top:40px; display:flex; justify-content:space-between;">
    <div>
      <p style="margin:0; font-weight:bold;">Émis par</p>
      <p style="font-size:12px; margin-top:6px;">${esc(d.creePar.prenom)} ${esc(d.creePar.nom)}</p>
    </div>
    <div style="text-align:right;">
      <p style="margin:0; font-weight:bold; text-transform:uppercase;">Validation magasinier</p>
      ${d.validePar
        ? `<p style="font-size:12px; color:#059669; margin-top:6px;">Validé électroniquement par ${esc(d.validePar.prenom)} ${esc(d.validePar.nom)}<br/>le ${formatDateFr(d.dateValidation)}</p>`
        : `<div style="margin-top:40px; border-top:1px solid #aaa; width:200px; margin-left:auto;"></div>`}
    </div>
  </div>

  <hr style="margin-top:40px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">
    ${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)} · Réf. ${esc(d.reference)}
  </p>
</div>`.trim();
}

/**
 * Bon de sortie VIERGE — à imprimer et remplir à la main (terrain, coupure réseau), puis à
 * ressaisir dans AfriGes. Mêmes rubriques que le bon numérique : nature, demandeur, motif,
 * quantités demandée / sortie, écart, signatures demandeur + magasinier + visa (au-delà du seuil).
 */
export function genBonSortieViergeHtml(opts: { seuilVisa: number; pointDeVente?: { nom: string; code: string } | null }): string {
  // Sans largeur : le champ occupe l'espace restant ; avec : largeur fixe (Date, Fonction).
  const champ = (label: string, largeur?: string) =>
    `<div style="${largeur ? `flex:0 0 ${largeur}` : "flex:1; min-width:0"};"><span style="font-size:11px; color:#475569;">${label}</span><div style="border-bottom:1px solid #94a3b8; height:22px;"></div></div>`;
  const caseACocher = (label: string) =>
    `<span style="display:inline-flex; align-items:center; gap:6px; margin-right:18px; font-size:12px;"><span style="display:inline-block; width:12px; height:12px; border:1.5px solid #0f172a;"></span>${label}</span>`;
  const lignesVides = Array.from({ length: 14 }, (_, i) => `
    <tr>
      <td style="padding:0 6px; height:24px; border:1px solid #cbd5e1; text-align:center; color:#94a3b8;">${i + 1}</td>
      <td style="border:1px solid #cbd5e1;"></td>
      <td style="border:1px solid #cbd5e1;"></td>
      <td style="border:1px solid #cbd5e1;"></td>
      <td style="border:1px solid #cbd5e1;"></td>
      <td style="border:1px solid #cbd5e1;"></td>
    </tr>`).join("");
  const signature = (titre: string, sousTitre: string) => `
    <div style="flex:1; border:1px solid #cbd5e1; border-radius:6px; padding:8px 10px; min-height:78px;">
      <p style="margin:0; font-weight:bold; font-size:12px;">${titre}</p>
      <p style="margin:2px 0 0; font-size:10px; color:#64748b;">${sousTitre}</p>
      <p style="margin:28px 0 0; font-size:10px; color:#64748b;">Nom, date et signature</p>
    </div>`;

  return `
<div style="font-family:'Helvetica Neue', Arial, sans-serif; max-width:760px; margin:0 auto; padding:8px 24px; color:#1a1a1a; font-size:13px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:12px; margin-bottom:16px;">
    <div>
      <h1 style="font-size:20px; font-weight:bold; margin:0;">${esc(SOCIETE.nom)}</h1>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">${esc(SOCIETE.adresse)}</p>
      <p style="font-size:11px; color:#555; margin:2px 0 0;">${esc(SOCIETE.telephone)} · ${esc(SOCIETE.email)}</p>
    </div>
    <div style="text-align:right;">
      <h2 style="font-size:18px; font-weight:bold; margin:0; text-transform:uppercase;">Bon de sortie</h2>
      <p style="font-size:11px; color:#555; margin:4px 0 0;">de marchandises</p>
      <p style="font-size:12px; margin:10px 0 0;">N° ______________________</p>
    </div>
  </div>

  <div style="display:flex; gap:16px; margin-bottom:10px;">
    ${opts.pointDeVente
      ? `<div style="flex:1;"><span style="font-size:11px; color:#475569;">Point de vente / Dépôt</span><div style="border-bottom:1px solid #94a3b8; height:22px; font-weight:bold;">${esc(opts.pointDeVente.nom)} (${esc(opts.pointDeVente.code)})</div></div>`
      : champ("Point de vente / Dépôt")}
    ${champ("Date", "160px")}
  </div>

  <div style="margin:12px 0;">
    <p style="font-size:11px; color:#475569; margin:0 0 6px;">Nature de la sortie</p>
    ${caseACocher("Don / échantillon")}${caseACocher("Usage terrain / interne")}${caseACocher("Perte")}${caseACocher("Casse")}${caseACocher("Autre : ____________")}
  </div>

  <div style="display:flex; gap:16px; margin-bottom:10px;">
    ${champ("Demandeur (nom et prénom)")}
    ${champ("Fonction", "200px")}
  </div>
  <div style="margin-bottom:6px;">${champ("Motif")}</div>
  <div style="margin-bottom:16px;"><div style="border-bottom:1px solid #94a3b8; height:22px;"></div></div>

  <table style="width:100%; border-collapse:collapse; font-size:12px;">
    <thead>
      <tr style="background:#0f172a; color:#fff;">
        <th style="padding:6px; width:28px;">N°</th>
        <th style="padding:6px; text-align:left;">Produit (désignation)</th>
        <th style="padding:6px; width:90px;">Référence</th>
        <th style="padding:6px; width:80px;">Qté demandée</th>
        <th style="padding:6px; width:80px;">Qté sortie</th>
        <th style="padding:6px; width:130px;">Observations</th>
      </tr>
    </thead>
    <tbody>${lignesVides}</tbody>
  </table>

  <div style="margin-top:12px;">
    <span style="font-size:11px; color:#475569;">Écart quantité (obligatoire si la quantité sortie est inférieure à la demande)</span>
    <div style="border-bottom:1px solid #94a3b8; height:22px;"></div>
    <div style="border-bottom:1px solid #94a3b8; height:22px;"></div>
  </div>

  <div style="display:flex; gap:12px; margin-top:16px;">
    ${signature("Demandeur", "Agent / service demandeur")}
    ${signature("Magasinier", "Sortie exécutée — quantités vérifiées")}
    ${signature("Visa RPV / Chef d'agence", `Obligatoire au-delà de ${fmtMontant(opts.seuilVisa)} XOF`)}
  </div>

  <p style="font-size:10px; color:#64748b; margin:14px 0 0;">
    Aucune marchandise ne sort du stock sans la signature du magasinier. Ce bon papier doit être ressaisi dans AfriGes le jour même.
  </p>
  <hr style="margin-top:14px; border:none; border-top:1px solid #ddd;">
  <p style="font-size:10px; color:#999; text-align:center; margin:6px 0 0;">${esc(SOCIETE.nom)} · ${esc(SOCIETE_LEGAL)}</p>
</div>`.trim();
}
