// lib/ficheCollecteHtml.ts
// Fiche journalière de collecte — document imprimable de l'agent terrain (formulaire papier AfriSime).
// A4 paysage, page coupée en deux colonnes :
//   gauche — titre + logo, date / collecteur / zone, cadre VISA CGT, 1 Informations des Membres (tableau) ;
//   droite — 2 Récapitulatif de la journée, 3 Transmission des fonds, signatures, consignes.
// Au-delà de LIGNES_PAR_PAGE membres, des pages de suite reprennent le tableau (sur les deux colonnes).
// Sans données (fiche vierge), toutes les lignes restent à remplir à la main.

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

function dateCourte(date?: Date | string | null): string {
  const d = enDate(date);
  if (!d) return `<span class="vide"></span> / <span class="vide"></span> / <span class="vide"></span>`;
  return `<span class="rempli">${p2(d.getDate())} / ${p2(d.getMonth() + 1)} / ${d.getFullYear()}</span>`;
}

function champ(valeur: string | null | undefined, largeur = "auto"): string {
  const v = valeur == null ? "" : String(valeur).trim();
  return `<span class="ligne" style="min-width:${largeur}">${v ? `<span class="rempli">${esc(v)}</span>` : ""}</span>`;
}

function montant(n: number | null | undefined): string | null {
  return n != null && Math.abs(n) > 0.001 ? fmtMontant(n) : null;
}

function case_(cochee: boolean): string {
  return `<span class="case">${cochee ? "X" : ""}</span>`;
}

function mention(nom: string | null, date: Date | string | null | undefined, verbe = "Signé électroniquement"): string {
  const d = enDate(date);
  if (!nom || !d) return "";
  return `<span class="sig-mention">${verbe} par ${esc(nom)} le ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} à ${p2(d.getHours())}:${p2(d.getMinutes())}</span>`;
}

const LIGNES_PAR_PAGE = 18;

export interface MembreCollecte { nom: string; adhesion: string | null; jours: number | null; montant: number }

export interface FicheCollecteHtmlData {
  reference: string | null;
  date: Date | string | null;
  collecteur: string | null;
  zone: string | null;
  membres: MembreCollecte[];
  montantAttendu: number | null;
  montantCollecte: number | null;
  transmission: {
    montantRemis: number;
    especes: boolean; depotBancaire: boolean; mobileMoney: boolean;
    references: string[];
    signatureCollecteur: string | null; dateSignatureCollecteur: Date | string | null;
  } | null;
  tresorier: { nom: string | null; date: Date | string | null; signature: string | null } | null;
  visaCGT: { nom: string | null; date: Date | string | null; signature: string | null } | null;
  logoDataUrl?: string | null;
}

/** Données d'une fiche vierge (à remplir à la main sur le terrain). */
export function ficheCollecteVierge(logoDataUrl?: string | null): FicheCollecteHtmlData {
  return {
    reference: null, date: null, collecteur: null, zone: null, membres: [],
    montantAttendu: null, montantCollecte: null, transmission: null, tresorier: null, visaCGT: null, logoDataUrl,
  };
}

const STYLE = `
  @page { size: A4 landscape; margin: 9mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Cambria, Georgia, "Times New Roman", serif; color: #111; font-size: 11.5pt; line-height: 1.35; }
  .page { position: relative; height: 190mm; border: 1px solid #333; padding: 7mm 8mm 12mm; display: flex; gap: 10mm; page-break-after: always; break-after: page; overflow: hidden; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .col { flex: 1; min-width: 0; }
  .num-page { position: absolute; bottom: 3mm; left: 8mm; border: 1px solid #333; border-radius: 4px; padding: 1px 10px; font-size: 9pt; }
  .entete { display: flex; align-items: flex-start; gap: 10px; }
  .entete h1 { flex: 1; font-size: 18pt; font-weight: bold; margin: 0; line-height: 1.15; }
  .entete img { height: 56px; width: auto; }
  .identite { display: flex; align-items: flex-start; gap: 10px; margin-top: 8px; }
  .identite .champs { flex: 1; }
  .identite p { margin: 0 0 4px; }
  .visa { width: 115px; height: 58px; border: 1px solid #555; border-radius: 10px; text-align: center; font-size: 8pt; color: #555; padding-top: 3px; position: relative; }
  .visa img { max-height: 30px; max-width: 100px; display: block; margin: 1px auto 0; }
  .visa .sig-mention { font-size: 6pt; margin-top: 0; }
  hr.sep { border: none; border-top: 1px solid #333; margin: 8px 0; }
  h2 { font-size: 13.5pt; font-weight: bold; margin: 6px 0 6px; }
  .ligne { display: inline-block; border-bottom: 1px solid #222; min-height: 1.1em; vertical-align: bottom; padding: 0 3px; }
  .rempli { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10pt; color: #0b3d91; }
  .vide { display: inline-block; width: 22px; border-bottom: 1px solid #222; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 1px solid #333; padding: 1px 4px; }
  th { font-weight: bold; text-align: center; line-height: 1.15; }
  td { height: 19px; }
  td.n { text-align: center; width: 7%; }
  td.adh, td.jrs { text-align: center; }
  td.mt { text-align: right; }
  td.v { font-family: "Helvetica Neue", Arial, sans-serif; color: #0b3d91; font-size: 9pt; }
  ul { margin: 0; padding-left: 18px; }
  li { margin-bottom: 6px; }
  .gras { font-weight: bold; }
  .case { display: inline-block; width: 11px; height: 11px; border: 1px solid #222; text-align: center; line-height: 10px; font-size: 9px; font-weight: bold; font-family: Arial, sans-serif; color: #0b3d91; vertical-align: middle; margin: 0 2px; }
  .sig-ligne { display: inline-block; min-width: 200px; height: 34px; border-bottom: 1px solid #222; vertical-align: bottom; }
  .sig-ligne img { height: 32px; width: auto; display: block; }
  .sig-mention { display: block; font-weight: normal; font-size: 7.5pt; color: #0b3d91; font-family: "Helvetica Neue", Arial, sans-serif; margin-top: 1px; }
  .cadre-sig { display: inline-block; width: 120px; height: 46px; border: 1px solid #555; border-radius: 10px; vertical-align: middle; margin-left: 6px; overflow: hidden; }
  .cadre-sig img { max-height: 42px; max-width: 116px; display: block; margin: 1px auto; }
  .consignes { font-size: 9.5pt; margin-top: 10px; }
  .consignes ul { padding-left: 16px; }
  .consignes li { margin-bottom: 1px; }
`;

function tableauMembres(membres: MembreCollecte[], debut: number): string {
  const lignes = Array.from({ length: LIGNES_PAR_PAGE }, (_, i) => {
    const m = membres[i];
    const n = debut + i + 1;
    if (!m) return `<tr><td class="n"></td><td></td><td></td><td></td><td></td></tr>`;
    return `<tr><td class="n">${n}</td><td class="v">${esc(m.nom)}</td><td class="adh v">${esc(m.adhesion ?? "")}</td>`
      + `<td class="jrs v">${m.jours ?? ""}</td><td class="mt v">${fmtMontant(m.montant)}</td></tr>`;
  }).join("");
  return `
  <table>
    <colgroup><col style="width:7%"/><col style="width:40%"/><col style="width:20%"/><col style="width:10%"/><col style="width:23%"/></colgroup>
    <thead><tr><th>N°</th><th>Nom &amp; Prénom</th><th>Numéro<br/>d&apos;adhésion</th><th>Nbr<br/>de<br/>jrs</th><th>Montant<br/>versé<br/>(FCFA)</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>`;
}

export function genFicheCollecteHtml(d: FicheCollecteHtmlData): string {
  const nbPagesSuite = Math.max(0, Math.ceil((d.membres.length - LIGNES_PAR_PAGE) / (LIGNES_PAR_PAGE * 2)));
  const totalPages = 1 + nbPagesSuite;
  const nbMembres = d.membres.length;
  const ecart = d.montantAttendu != null && d.montantCollecte != null ? d.montantAttendu - d.montantCollecte : null;
  const t = d.transmission;

  const page1 = `
<section class="page">
  <div class="col">
    <div class="entete">
      <h1>FICHE JOURNALIÈRE<br/>DE COLLECTE – AFRISIME</h1>
      ${d.logoDataUrl ? `<img src="${d.logoDataUrl}" alt="AfriSime" />` : ""}
    </div>
    <div class="identite">
      <div class="champs">
        <p>Date : ${dateCourte(d.date)}</p>
        <p>Nom du collecteur : ${champ(d.collecteur, "150px")}</p>
        <p>Zone / Secteur de collecte : ${champ(d.zone, "110px")}</p>
      </div>
      <div class="visa">VISA CGT${d.visaCGT?.signature ? `<img src="${d.visaCGT.signature}" alt="Visa" />` : ""}${d.visaCGT ? mention(d.visaCGT.nom, d.visaCGT.date, "Visé") : ""}</div>
    </div>
    <hr class="sep" />
    <h2>1 Informations des Membres</h2>
    ${tableauMembres(d.membres.slice(0, LIGNES_PAR_PAGE), 0)}
  </div>

  <div class="col">
    <h2 style="margin-top:0">2 Récapitulatif de la Journée</h2>
    <ul>
      <li>Nombre total de membres collectés : ${champ(d.reference ? String(nbMembres) : null, "70px")}</li>
      <li>Montant total attendu : ${champ(montant(d.montantAttendu), "110px")} FCFA</li>
      <li>Montant total effectivement collecté : ${champ(montant(d.montantCollecte), "90px")} FCFA</li>
      <li>Écart (si existant) : ${champ(ecart != null && Math.abs(ecart) > 0.01 ? fmtMontant(ecart) : null, "110px")} FCFA</li>
    </ul>

    <h2 style="margin-top:14px">3 Transmission des Fonds</h2>
    <ul>
      <li>Montant remis au Trésorier : ${champ(t ? fmtMontant(t.montantRemis) : null, "110px")} FCFA</li>
      <li>Mode de remise : Espèces ${case_(!!t?.especes)} / Dépôt bancaire ${case_(!!t?.depotBancaire)} / Mobile Money ${case_(!!t?.mobileMoney)}</li>
      <li>N° Bordereau ou Transaction : ${champ(t ? t.references.join(", ") : null, "140px")}</li>
    </ul>

    <p class="gras" style="margin:12px 0 0">Signature du Collecteur :</p>
    <span class="sig-ligne">${t?.signatureCollecteur ? `<img src="${t.signatureCollecteur}" alt="Signature" />` : ""}</span>
    ${t ? mention(d.collecteur, t.dateSignatureCollecteur) : ""}

    <p class="gras" style="margin:14px 0 0">Signature du Trésorier Réceptionnaire :
      <span class="cadre-sig">${d.tresorier?.signature ? `<img src="${d.tresorier.signature}" alt="Signature" />` : ""}</span>
    </p>
    ${d.tresorier ? mention(d.tresorier.nom, d.tresorier.date) : ""}

    <div class="consignes">
      Cette fiche doit être :
      <ul>
        <li>remplie chaque jour par le collecteur,</li>
        <li>transmise en même temps que les fonds,</li>
        <li>conservée dans le classeur de collecte mensuel.</li>
      </ul>
    </div>
  </div>
  <span class="num-page">1 / ${totalPages}</span>
</section>`;

  const suites = Array.from({ length: nbPagesSuite }, (_, i) => {
    const debut = LIGNES_PAR_PAGE + i * LIGNES_PAR_PAGE * 2;
    return `
<section class="page">
  <div class="col">
    <h2 style="margin-top:0">1 Informations des Membres (suite)${d.reference ? ` <span style="font-size:9pt; font-weight:normal">${esc(d.reference)}</span>` : ""}</h2>
    ${tableauMembres(d.membres.slice(debut, debut + LIGNES_PAR_PAGE), debut)}
  </div>
  <div class="col">
    <h2 style="margin-top:0">&nbsp;</h2>
    ${tableauMembres(d.membres.slice(debut + LIGNES_PAR_PAGE, debut + LIGNES_PAR_PAGE * 2), debut + LIGNES_PAR_PAGE)}
  </div>
  <span class="num-page">${i + 2} / ${totalPages}</span>
</section>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${d.reference ? esc(d.reference) + " — " : ""}Fiche journalière de collecte</title>
<style>${STYLE}</style>
</head>
<body>${page1}${suites}</body>
</html>`;
}
