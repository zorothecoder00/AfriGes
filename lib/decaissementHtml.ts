// lib/decaissementHtml.ts
// Fiche de Décaissement — document imprimable (CDC digitalisation §3.6).
// Reproduit le formulaire papier AfriSime : A4 portrait, 2 pages.
//   Page 1 — en-tête (logos, titre, coordonnées AFRISIME SARL), champs d'identification,
//            1. Objet du décaissement (motif, type de dépense), 2. Détails financiers (montants, mode).
//   Page 2 — référence de paiement, 3. Pièces justificatives, 4. Visa d'approbation,
//            5. Décaissement effectué par, 6. Réception par le bénéficiaire.
// Mentions légales en pied des deux pages. Chaque signataire : tracé imprimé s'il existe,
// et mention « Signé électroniquement par … » dès que son étape est validée dans AfriGes.

import { SOCIETE_FORMULAIRES, MENTIONS_LEGALES_FORMULAIRES } from "@/lib/societe";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\u202f|\u00a0/g, " ");
}

const p2 = (n: number) => String(n).padStart(2, "0");

function enDate(date?: Date | string | null): Date | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? null : d;
}

/** « 24 / 09 / 2026 », ou le gabarit vierge « ___ / ___ / ____ ». */
function dateCourte(date?: Date | string | null): string {
  const d = enDate(date);
  if (!d) return `<span class="vide"></span> / <span class="vide"></span> / <span class="vide"></span>`;
  return `<span class="rempli">${p2(d.getDate())} / ${p2(d.getMonth() + 1)} / ${d.getFullYear()}</span>`;
}

/** Date pointillée des visas : « ……… / ……… / ……… » ou la date remplie. */
function datePointillee(date?: Date | string | null): string {
  const d = enDate(date);
  if (!d) return `<span class="pointilles">…………… / ………………… / ……………</span>`;
  return `<span class="rempli">${p2(d.getDate())} / ${p2(d.getMonth() + 1)} / ${d.getFullYear()}</span>`;
}

function champ(valeur: string | null | undefined, largeur = "auto"): string {
  const v = valeur == null ? "" : String(valeur).trim();
  return `<span class="ligne" style="min-width:${largeur}">${v ? `<span class="rempli">${esc(v)}</span>` : ""}</span>`;
}

function case_(cochee: boolean): string {
  return `<span class="case">${cochee ? "X" : ""}</span>`;
}

function signature(trace: string | null | undefined, largeur: string): string {
  return `<span class="ligne sig-ligne" style="min-width:${largeur}">${trace ? `<img class="sig" src="${trace}" alt="Signature" />` : ""}</span>`;
}

function mentionElectronique(signataire: string | null, date: Date | string | null | undefined): string {
  const d = enDate(date);
  if (!signataire || !d) return "";
  return `<span class="sig-mention">Signé électroniquement par ${esc(signataire)} le ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} à ${p2(d.getHours())}:${p2(d.getMinutes())}</span>`;
}

function nomPersonne(p: { nom: string; prenom: string } | null): string | null {
  return p ? `${p.prenom} ${p.nom}`.trim() : null;
}

// ── Correspondance données → cases du formulaire ──────────────────────────────

const TYPES_FORMULAIRE: { cle: string; libelle: string }[] = [
  { cle: "ACHAT_MARCHANDISES", libelle: "Achat de marchandises" },
  { cle: "FOURNITURES", libelle: "Fournitures / consommables" },
  { cle: "PAIEMENT_FOURNISSEUR", libelle: "Paiement fournisseur" },
  { cle: "AVANCE_CAISSE", libelle: "Avance de caisse" },
  { cle: "FRAIS_FONCTIONNEMENT", libelle: "Frais de fonctionnement" },
  { cle: "TRANSPORT", libelle: "Transport / Logistique" },
];
/** Types sans case dédiée sur le papier : cochés « Autres » avec leur libellé. */
const TYPES_AUTRES_LIBELLE: Record<string, string> = { SALAIRE: "Salaire", CARBURANT: "Carburant" };

const MODES_FORMULAIRE: { cle: string; libelle: string }[] = [
  { cle: "ESPECES", libelle: "Espèces" },
  { cle: "MOBILE_MONEY", libelle: "Mobile Money (Flooz / TMoney / Mix / Coris)" },
  { cle: "CHEQUE", libelle: "Chèque" },
  { cle: "VIREMENT", libelle: "Virement bancaire" },
];

/** Cases « 3. Pièces justificatives », dans l'ordre du formulaire. */
export const PIECES_FORMULAIRE = ["Pro-forma jointe", "Facture jointe", "Bon de commande", "Bon de livraison", "Contrat / Devis"] as const;

/** Rattache une pièce déclarée (libellé du formulaire ou ancienne saisie libre) à sa case, ou null (→ « Autres »). */
export function caseDePiece(piece: string): (typeof PIECES_FORMULAIRE)[number] | null {
  const p = piece.toLowerCase();
  if (p.includes("pro-forma") || p.includes("proforma") || p.includes("pro forma")) return "Pro-forma jointe";
  if (p.includes("factur")) return "Facture jointe";
  if (p.includes("livraison") || p === "bl") return "Bon de livraison";
  if (p.includes("commande") || p === "bc") return "Bon de commande";
  if (p.includes("contrat") || p.includes("devis")) return "Contrat / Devis";
  return null;
}

export interface DecaissementHtmlData {
  reference: string;
  date: Date | string;
  serviceDepartement: string | null;
  demandeur: { nom: string; prenom: string };
  beneficiaireNom: string; beneficiaireContact: string | null;
  motif: string; typeDepense: string; typeDepenseAutre: string | null;
  montantDemande: number; montantApprouve: number | null;
  modePaiement: string | null; referencePaiement: string | null;
  piecesJustificatives: string[];
  approbateurN1: { nom: string; prenom: string } | null; dateApprobationN1: Date | string | null;
  approbateurN2: { nom: string; prenom: string } | null; dateApprobationN2: Date | string | null;
  executePar: { nom: string; prenom: string } | null; dateExecution: Date | string | null;
  beneficiaireConfirmationNom: string | null; beneficiaireConfirmationPiece: string | null;
  dateConfirmationBeneficiaire: Date | string | null;
  signatureDemandeur: string | null; signatureN1: string | null; signatureN2: string | null;
  signatureExecutant: string | null; signatureBeneficiaire: string | null;
  logoGaucheDataUrl?: string | null;
  logoDroitDataUrl?: string | null;
}

const STYLE = `
  @page { size: A4 portrait; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Cambria, Georgia, "Times New Roman", serif; color: #111; font-size: 12pt; line-height: 1.4; }
  .page { position: relative; height: 268mm; padding: 1px 0 20mm; page-break-after: always; break-after: page; overflow: hidden; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .logo-droit { position: absolute; top: 0; right: 0; height: 34px; width: auto; }
  .entete { display: flex; align-items: flex-end; gap: 14px; padding-top: 34px; }
  .entete img { height: 58px; width: auto; }
  h1 { font-size: 18pt; font-weight: bold; margin: 0 0 4px; flex: 1; text-align: center; }
  .societe { margin: 12px 0 18px; font-size: 12pt; line-height: 1.35; }
  .societe b { font-weight: bold; }
  .societe a { color: #1a4fb4; text-decoration: underline; }
  ul { margin: 0; padding-left: 30px; }
  ul.champs li { margin-bottom: 5px; font-weight: bold; }
  ul.cases { list-style: disc; padding-left: 40px; }
  ul.cases li { margin-bottom: 3px; }
  h2 { font-size: 12.5pt; font-weight: bold; margin: 16px 0 8px; }
  .sous { font-weight: bold; margin: 10px 0 6px; }
  .ligne { display: inline-block; border-bottom: 1px solid #222; min-height: 1.1em; vertical-align: bottom; padding: 0 3px; }
  .ligne-pleine { display: block; border-bottom: 1px solid #222; min-height: 1.35em; margin: 4px 0; padding: 0 3px; }
  .rempli { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10.5pt; color: #0b3d91; font-weight: normal; }
  .vide { display: inline-block; width: 26px; border-bottom: 1px solid #222; }
  .pointilles { letter-spacing: -0.5px; font-size: 10pt; }
  .case { display: inline-block; width: 12px; height: 12px; border: 1px solid #222; text-align: center; line-height: 11px; font-size: 10px; font-weight: bold; font-family: Arial, sans-serif; color: #0b3d91; vertical-align: middle; margin-right: 5px; }
  hr.sep { border: none; border-top: 1px solid #333; margin: 16px 0 14px; }
  .visa { margin-bottom: 14px; }
  .visa .titre { font-weight: bold; margin-bottom: 6px; }
  .visa .rangee { display: flex; align-items: flex-end; gap: 18px; font-size: 11pt; font-style: italic; }
  .visa .rangee > span { white-space: nowrap; }
  .sig-ligne { height: 36px; }
  img.sig { height: 34px; width: auto; display: block; }
  .sig-mention { display: block; font-style: normal; font-weight: normal; font-size: 7.5pt; color: #0b3d91; font-family: "Helvetica Neue", Arial, sans-serif; margin-top: 2px; }
  .bloc p { margin: 0 0 9px; font-weight: bold; }
  .bloc p .normal { font-weight: normal; }
  .mentions { position: absolute; left: 0; right: 0; bottom: 0; font-size: 12pt; }
  .mentions i { display: block; font-size: 9pt; line-height: 1.3; }
`;

export function genDecaissementHtml(d: DecaissementHtmlData): string {
  const typeAutre = !TYPES_FORMULAIRE.some((t) => t.cle === d.typeDepense);
  const precisionAutre = d.typeDepenseAutre?.trim() || TYPES_AUTRES_LIBELLE[d.typeDepense] || null;
  const casesPieces = new Set(d.piecesJustificatives.map(caseDePiece).filter(Boolean));
  const autresPieces = d.piecesJustificatives.filter((p) => !caseDePiece(p));
  const montantApprouve = d.montantApprouve ?? (d.approbateurN1 ? d.montantDemande : null);

  const mentions = `
  <div class="mentions">Mentions légales<i>${esc(MENTIONS_LEGALES_FORMULAIRES)}</i></div>`;

  const page1 = `
<section class="page">
  ${d.logoDroitDataUrl ? `<img class="logo-droit" src="${d.logoDroitDataUrl}" alt="AfriSime Communauté" />` : ""}
  <div class="entete">
    ${d.logoGaucheDataUrl ? `<img src="${d.logoGaucheDataUrl}" alt="AfriSime" />` : ""}
    <h1>FICHE DE DÉCAISSEMENT– AFRISIME</h1>
  </div>
  <div class="societe">
    <b>${esc(SOCIETE_FORMULAIRES.raisonSociale)}</b><br/>
    <b>Adresse :</b> ${esc(SOCIETE_FORMULAIRES.adresse)}<br/>
    <b>Tél. :</b> ${esc(SOCIETE_FORMULAIRES.telephone)}<br/>
    <b>Email :</b> <a>${esc(SOCIETE_FORMULAIRES.email)}</a>
  </div>

  <ul class="champs">
    <li>N° de décaissement : ${champ(d.reference, "120px")}</li>
    <li>Date : ${dateCourte(d.date)}</li>
    <li>Service/Département : ${champ(d.serviceDepartement, "180px")}</li>
    <li>Bénéficiaire : ${champ(d.beneficiaireNom, "220px")}</li>
    <li>Contact du bénéficiaire : ${champ(d.beneficiaireContact, "150px")}</li>
  </ul>

  <h2>1. Objet du décaissement</h2>
  <p class="sous">Motif / Description détaillée :</p>
  <span class="ligne-pleine"><span class="rempli">${esc(d.motif)}</span></span>
  <span class="ligne-pleine"></span>

  <p class="sous">Type de dépense :</p>
  <ul class="cases">
    ${TYPES_FORMULAIRE.map((t) => `<li>${case_(d.typeDepense === t.cle)}${t.libelle}</li>`).join("")}
    <li>${case_(typeAutre)}Autres : ${champ(typeAutre ? precisionAutre : null, "190px")}</li>
  </ul>

  <h2 style="margin-bottom:2px">2. Détails financiers</h2>
  <p style="margin:0 0 2px; font-weight:bold">Montant demandé (FCFA) : ${champ(fmtMontant(d.montantDemande), "140px")}</p>
  <p style="margin:0; font-weight:bold">Montant approuver (FCFA) : ${champ(montantApprouve != null ? fmtMontant(montantApprouve) : null, "140px")}</p>

  <p class="sous" style="margin-top:14px">Mode de paiement :</p>
  <ul class="cases">
    ${MODES_FORMULAIRE.map((m) => `<li>${case_(d.modePaiement === m.cle)}${m.libelle}</li>`).join("")}
  </ul>
  ${mentions}
</section>`;

  const page2 = `
<section class="page">
  <p style="margin:6px 0 0; font-weight:bold">Référence de paiement : ${champ(d.referencePaiement, "170px")}</p>
  <hr class="sep" />

  <h2 style="margin-top:0">3. Pièces justificatives</h2>
  <ul class="cases">
    ${PIECES_FORMULAIRE.map((p) => `<li>${case_(casesPieces.has(p))}${p}</li>`).join("")}
    <li>${case_(autresPieces.length > 0)}Autres documents : ${champ(autresPieces.join(", ") || null, "160px")}</li>
  </ul>

  <h2>4. Visa d&apos;approbation</h2>
  ${[
    { titre: "Demandeur", nom: nomPersonne(d.demandeur), trace: d.signatureDemandeur, date: d.date, signe: true },
    { titre: "Responsable hiérarchique", nom: nomPersonne(d.approbateurN1), trace: d.signatureN1, date: d.dateApprobationN1, signe: !!d.approbateurN1 },
    { titre: "Directeur Général / Finance", nom: nomPersonne(d.approbateurN2), trace: d.signatureN2, date: d.dateApprobationN2, signe: !!d.approbateurN2 },
  ].map((v) => `
  <div class="visa">
    <div class="titre">${v.titre} :</div>
    <div class="rangee">
      <span>Nom : ${champ(v.signe ? v.nom : null, "150px")}</span>
      <span>Signature : ${signature(v.trace, "100px")}</span>
      <span>Date : ${datePointillee(v.signe ? v.date : null)}</span>
    </div>
    ${v.signe ? mentionElectronique(v.nom, v.date) : ""}
  </div>`).join("")}

  <h2>5. Décaissement effectué par</h2>
  <div class="bloc">
    <p>Caissier / Comptable : ${champ(nomPersonne(d.executePar), "160px")}</p>
    <p>Signature : ${signature(d.signatureExecutant, "140px")}${mentionElectronique(nomPersonne(d.executePar), d.dateExecution)}</p>
    <p>Date &amp; Heure : ${d.dateExecution ? (() => { const x = enDate(d.dateExecution)!; return `<span class="rempli">${p2(x.getDate())} / ${p2(x.getMonth() + 1)} / ${x.getFullYear()} à ${p2(x.getHours())}:${p2(x.getMinutes())}</span>`; })() : `${dateCourte(null)} à <span class="vide"></span>`}</p>
  </div>

  <h2>6. Réception par le bénéficiaire</h2>
  <div class="bloc">
    <p>Nom : ${champ(d.beneficiaireConfirmationNom, "200px")}</p>
    <p>Pièce d&apos;identité (type &amp; N°) : ${champ(d.beneficiaireConfirmationPiece, "150px")}</p>
    <p>Signature : ${signature(d.signatureBeneficiaire, "140px")}${mentionElectronique(d.beneficiaireConfirmationNom, d.dateConfirmationBeneficiaire)}</p>
    <p>Date : ${dateCourte(d.dateConfirmationBeneficiaire)}</p>
  </div>
  ${mentions}
</section>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(d.reference)} — Fiche de décaissement</title>
<style>${STYLE}</style>
</head>
<body>${page1}${page2}</body>
</html>`;
}
