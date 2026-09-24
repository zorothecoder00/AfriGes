// lib/bordereauRemiseHtml.ts
// Bordereau de Remise de Fonds — document imprimable (CDC digitalisation §3.1).
// Reproduit le formulaire papier AfriSime : A4 paysage, 2 pages, chaque page coupée en deux colonnes.
//   Page 1 — gauche : en-tête + références, I (identification), titre II ; droite : tableau II, III (billetage), vérification.
//   Page 2 — gauche : IV (mode de remise), V (pièces jointes), VI (déclaration & signatures) ; droite : instructions.
// Les champs sans donnée en base (compte à créditer, banque, opérateur mobile money…) restent des lignes vierges
// à compléter à la main, comme sur le papier.

import { SOCIETE } from "@/lib/societe";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMontant(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/\u202f|\u00a0/g, " ");
}

/** « 24 / 09 / 2026 », ou le gabarit vierge « __ / __ / ____ ». */
function dateCourte(date?: Date | string | null): string {
  if (!date) return `<span class="vide-court"></span> / <span class="vide-court"></span> / <span class="vide-court"></span>`;
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return dateCourte(null);
  const p = (n: number) => String(n).padStart(2, "0");
  return `<span class="rempli">${p(d.getDate())} / ${p(d.getMonth() + 1)} / ${d.getFullYear()}</span>`;
}

/** Valeur remplie sur sa ligne pointillée, ou ligne vierge à compléter à la main. */
function champ(valeur: string | null | undefined, largeur = "auto"): string {
  const v = valeur == null ? "" : String(valeur).trim();
  return `<span class="ligne" style="min-width:${largeur}">${v ? `<span class="rempli">${esc(v)}</span>` : ""}</span>`;
}

/** « le 24/09/2026 à 14:32 » */
function horodatage(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = (n: number) => String(n).padStart(2, "0");
  return `le ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Ligne de signature : tracé imprimé s'il existe, et mention de signature électronique
 * (validation horodatée dans AfriGes) dès que l'acteur a validé son étape.
 */
function signature(trace: string | null | undefined, largeur: string): string {
  const img = trace ? `<img class="sig" src="${trace}" alt="Signature" />` : "";
  return `<span class="ligne sig-ligne" style="min-width:${largeur}">${img}</span>`;
}

function mentionElectronique(signataire: string | null, date: Date | string | null | undefined): string {
  return signataire && date ? `<span class="sig-mention">Signé électroniquement par ${esc(signataire)} ${horodatage(date)}</span>` : "";
}

function montant(n: number | null | undefined): string {
  return n != null && Math.abs(n) > 0.001 ? fmtMontant(n) : "";
}

function case_(cochee: boolean): string {
  return `<span class="case">${cochee ? "X" : ""}</span>`;
}

/** Dénominations du formulaire papier, dans l'ordre. */
const DENOMINATIONS_FORMULAIRE = [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25];

export interface BordereauRemiseHtmlData {
  reference: string;
  date: Date | string;
  pointDeVente: { nom: string; code: string };
  compte: { titulaire: string | null; numero: string | null; banque: string | null; guichet: string | null };
  collecteur: { id: number; nom: string; prenom: string; telephone: string | null; adresse: string | null; zone: string | null };
  cotisationsEspeces: number; cotisationsMobileMoney: number; mobileMoneyReference: string | null;
  remboursements: number; ventes: number; venteCarnet: number; fraisLivraison: number;
  montantVirement: number; virementReference: string | null;
  totalEspecesAttendu: number;
  lignesBilletage: { denomination: number; nombre: number; total: number }[];
  totalBilletageCalcule: number;
  ecartSoumission: number; motifEcartSoumission: string | null;
  tresorier: { nom: string; prenom: string } | null;
  montantConfirmeTresorier: number | null; dateTraitementTresorier: Date | string | null;
  visaCGTPar: { nom: string; prenom: string } | null; dateVisaCGT: Date | string | null;
  /** Natures des pièces jointes déposées (RECU, RELEVE_BANCAIRE, PIECE_CAISSE…). */
  naturesPieces: string[];
  mobileMoneyOperateur: string | null;
  carnetsAnnexes: boolean;
  fichesPages: [string | null, string | null];
  recusNum: [string | null, string | null];
  /** VI — déclaration cochée et signée par le collecteur à la soumission. */
  declarationAcceptee: boolean;
  dateSoumission: Date | string;
  signatureCollecteur: string | null;
  signatureTresorier: string | null;
  signatureVisaCGT: string | null;
  seuilVisaCGT: number;
  logoDataUrl?: string | null;
}

const STYLE = `
  @page { size: A4 landscape; margin: 9mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Cambria, Georgia, "Times New Roman", serif; color: #111; font-size: 11pt; line-height: 1.32; }
  .page { position: relative; height: 190mm; border: 1px solid #333; padding: 7mm 8mm 9mm; display: flex; gap: 9mm; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .col { flex: 1; min-width: 0; }
  .num-page { position: absolute; left: 8mm; bottom: 3mm; font-size: 8pt; color: #666; }
  h1 { font-size: 17pt; font-weight: bold; text-align: center; margin: 0; line-height: 1.2; }
  h2 { font-size: 13.5pt; font-weight: bold; margin: 7px 0 4px; }
  .entete { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
  .entete h1 { flex: 1; }
  .entete img { height: 58px; width: auto; }
  .champs p { margin: 0 0 5px; }
  .ligne { display: inline-block; border-bottom: 1px solid #333; min-height: 1.1em; vertical-align: bottom; padding: 0 3px; }
  .rempli { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10pt; color: #0b3d91; }
  .vide-court { display: inline-block; width: 22px; border-bottom: 1px solid #333; }
  ul { margin: 0; padding-left: 16px; }
  li { margin: 0 0 5px; }
  .verif li { margin-bottom: 2px; }
  hr.sep { border: none; border-top: 1px solid #333; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9.6pt; line-height: 1.25; }
  th, td { border: 1px solid #444; padding: 1.5px 5px; vertical-align: top; }
  th { font-weight: bold; text-align: center; }
  td.m { text-align: right; width: 26%; font-family: "Helvetica Neue", Arial, sans-serif; color: #0b3d91; }
  tr.total td { font-weight: bold; text-align: center; }
  tr.total td.m { text-align: right; }
  .billetage td { text-align: center; height: 15px; padding-top: 0; padding-bottom: 0; }
  .billetage td.nb, .billetage td.tt { font-family: "Helvetica Neue", Arial, sans-serif; color: #0b3d91; }
  .case { display: inline-block; width: 11px; height: 11px; border: 1px solid #222; text-align: center; line-height: 10px; font-size: 9px; font-weight: bold; font-family: Arial, sans-serif; color: #0b3d91; vertical-align: middle; margin: 0 2px; }
  .petit { font-size: 10pt; }
  .gras { font-weight: bold; }
  .instructions h2 { text-align: center; }
  .instructions ol { margin: 0; padding-left: 18px; font-size: 10.3pt; text-align: justify; }
  .instructions li { margin-bottom: 4px; }
  .signatures p { margin: 0 0 6px; }
  .cachet { margin-top: 4px; }
  .sig-ligne { height: 34px; vertical-align: bottom; }
  img.sig { height: 32px; width: auto; display: block; }
  .sig-mention { display: block; font-weight: normal; font-size: 7.5pt; color: #0b3d91; font-family: "Helvetica Neue", Arial, sans-serif; margin-top: 1px; }
`;

export function genBordereauRemiseHtml(d: BordereauRemiseHtmlData): string {
  // ── Billetage : lignes du formulaire, + toute autre dénomination saisie (ex. 10 FCFA) ──
  const parDenom = new Map(d.lignesBilletage.map((l) => [l.denomination, l]));
  const denoms = [
    ...DENOMINATIONS_FORMULAIRE,
    ...d.lignesBilletage.map((l) => l.denomination).filter((x) => !DENOMINATIONS_FORMULAIRE.includes(x)).sort((a, b) => b - a),
  ];
  const lignesBilletage = denoms.map((den) => {
    const l = parDenom.get(den);
    const nb = l && l.nombre > 0 ? String(l.nombre) : "";
    const tt = l && l.nombre > 0 ? fmtMontant(l.total) : "";
    return `<tr><td class="nb">${nb}</td><td>${fmtMontant(den)}</td><td class="tt">${tt}</td></tr>`;
  }).join("");

  const totalRemis = d.totalEspecesAttendu + d.cotisationsMobileMoney + d.montantVirement;
  const ecart = Math.abs(d.ecartSoumission) > 0.01 ? d.ecartSoumission : null;
  const especes = d.totalBilletageCalcule > 0 || d.totalEspecesAttendu > 0;
  const virement = d.montantVirement > 0;
  const pieces = new Set(d.naturesPieces);
  const nomCollecteur = `${d.collecteur.prenom} ${d.collecteur.nom}`.trim();

  const page1 = `
<section class="page">
  <div class="col">
    <div class="entete">
      <h1>BORDEREAU DE REMISE DE<br/>FONDS – AFRISIME</h1>
      ${d.logoDataUrl ? `<img src="${d.logoDataUrl}" alt="AfriSime" />` : ""}
    </div>
    <div class="champs">
      <p>BORDEREAU N° : ${champ(d.reference, "150px")}</p>
      <p>Date : ${dateCourte(d.date)}</p>
      <p>Agence / Point de dépôt : ${champ(`${d.pointDeVente.nom} (${d.pointDeVente.code})`, "190px")}</p>
      <p>Compte à créditer (Titulaire) : ${champ(d.compte.titulaire, "170px")}</p>
      <p>N° de compte : ${champ(d.compte.numero, "250px")}</p>
      <p>Banque : ${champ(d.compte.banque, "290px")}</p>
      <p>Guichet / Branche : ${champ(d.compte.guichet, "230px")}</p>
    </div>
    <hr class="sep" />
    <h2>I — Identification du déposant / collecteur</h2>
    <ul>
      <li>Nom &amp; Prénom : ${champ(nomCollecteur, "230px")}</li>
      <li>Code Collecteur / ID : ${champ(`#${d.collecteur.id}`, "200px")}</li>
      <li>Zone / Secteur : ${champ(d.collecteur.zone, "230px")}</li>
      <li>Téléphone : ${champ(d.collecteur.telephone, "255px")}</li>
      <li>Adresse : ${champ(d.collecteur.adresse, "270px")}</li>
    </ul>
    <h2 style="margin-top:14px">II — Récapitulatif des fonds remis</h2>
  </div>

  <div class="col">
    <table>
      <thead><tr><th>Nature des fonds</th><th>Montant<br/>(FCFA)</th></tr></thead>
      <tbody>
        <tr><td>Cotisations (espèces)</td><td class="m">${montant(d.cotisationsEspeces)}</td></tr>
        <tr><td>Cotisations (mobile money - ID N° ${champ(d.mobileMoneyReference, "110px")})</td><td class="m">${montant(d.cotisationsMobileMoney)}</td></tr>
        <tr><td>Remboursements (espèces)</td><td class="m">${montant(d.remboursements)}</td></tr>
        <tr><td>Ventes de produits en espèces</td><td class="m">${montant(d.ventes)}</td></tr>
        <tr><td>Vente de Carnet</td><td class="m">${montant(d.venteCarnet)}</td></tr>
        <tr><td>Frais de Livraison</td><td class="m">${montant(d.fraisLivraison)}</td></tr>
        <tr class="total"><td>Total espèces attendu</td><td class="m">${montant(d.totalEspecesAttendu)}</td></tr>
        <tr><td>Montant remis par virement / dépôt bancaire (N° transaction${d.virementReference ? ` : <span class="rempli">${esc(d.virementReference)}</span>` : ""})</td><td class="m">${montant(d.montantVirement)}</td></tr>
        <tr class="total"><td>Montant total remis (Espèces + Virements)</td><td class="m">${montant(totalRemis)}</td></tr>
      </tbody>
    </table>

    <h2>III — Billetage</h2>
    <p class="petit" style="margin:0 0 4px">Remplir le tableau ci-dessous avec le nombre de billets pièces remises.</p>
    <table class="billetage">
      <thead><tr><th>Nbre billets /<br/>pièces</th><th>Dénomination<br/>(FCFA)</th><th>Total (FCFA) = Nbre ×<br/>Dénomination</th></tr></thead>
      <tbody>
        ${lignesBilletage}
        <tr class="total"><td></td><td>Total espèces calculé</td><td class="tt">${montant(d.totalBilletageCalcule)}</td></tr>
      </tbody>
    </table>

    <p class="gras" style="margin:5px 0 2px">Vérification :</p>
    <ul class="petit verif">
      <li>Total espèces (section II) : ${champ(montant(d.totalEspecesAttendu), "170px")} FCFA</li>
      <li>Total billetage (ci-dessus) : ${champ(montant(d.totalBilletageCalcule), "165px")} FCFA</li>
      <li>Écart (si ≠ 0) : ${champ(ecart != null ? fmtMontant(ecart) : null, "110px")} FCFA → Motif / observation : ${champ(ecart != null ? d.motifEcartSoumission : null, "90px")}</li>
    </ul>
  </div>
  <span class="num-page">p. 1</span>
</section>`;

  const page2 = `
<section class="page">
  <div class="col">
    <h2 style="margin-top:0">IV — Mode de remise &amp; références</h2>
    <ul class="gras">
      <li>Mode de remise espèces : Oui ${case_(especes)} Non ${case_(!especes)}</li>
      <li>Mobile Money (Opérateur) : ${champ(d.mobileMoneyOperateur, "90px")} — N° Transaction : ${champ(d.mobileMoneyReference, "90px")}<br/>
        — Montant : ${champ(montant(d.cotisationsMobileMoney), "150px")} FCFA</li>
      <li>Virement / Dépôt bancaire : Oui ${case_(virement)} Non ${case_(!virement)} — N° Transaction / Bordereau : ${champ(d.virementReference, "110px")}
        — Montant : ${champ(montant(d.montantVirement), "120px")} FCFA</li>
    </ul>

    <h2>V — Pièces jointes (cochez)</h2>
    <ul>
      <li>${case_(d.carnetsAnnexes)} Carnets individuels en annexe (listés)</li>
      <li>${case_(!!(d.fichesPages[0] || d.fichesPages[1]) || pieces.has("PIECE_CAISSE"))} Fiches journalières de collecte (n° pages : ${champ(d.fichesPages[0], "28px")} à ${champ(d.fichesPages[1], "28px")})</li>
      <li>${case_(!!(d.recusNum[0] || d.recusNum[1]) || pieces.has("RECU"))} Copies des reçus numérotés (n° : ${champ(d.recusNum[0], "28px")} à ${champ(d.recusNum[1], "28px")})</li>
      <li>${case_(pieces.has("RELEVE_BANCAIRE"))} Copies justificatifs Mobile Money / Virement</li>
    </ul>

    <h2>VI — Déclaration &amp; Signatures</h2>
    <p style="margin:0 0 10px; text-align:justify">Je soussigné(e) ${champ(nomCollecteur, "200px")} <i class="petit">(Nom du collecteur)</i>,
      déclare avoir remis à AfriSime, ce jour, les fonds et documents mentionnés ci-dessus. J&apos;atteste de l&apos;exactitude des montants et du
      billetage indiqué.</p>
    <div class="signatures">
      <p class="gras">Signature du Collecteur : ${signature(d.signatureCollecteur, "150px")} Date : ${dateCourte(d.date)}${mentionElectronique(d.declarationAcceptee ? nomCollecteur : null, d.dateSoumission)}</p>
      <p class="gras">Montant reçu et vérifié par le Trésorier AfriSime : ${champ(montant(d.montantConfirmeTresorier), "90px")} FCFA</p>
      <p class="gras">Signature du Trésorier : ${signature(d.signatureTresorier, "150px")} Date : ${dateCourte(d.dateTraitementTresorier)}${mentionElectronique(d.tresorier ? `${d.tresorier.prenom} ${d.tresorier.nom}` : null, d.dateTraitementTresorier)}</p>
      <p class="gras">Visa du Président CGT (si &gt; seuil) : ${signature(d.signatureVisaCGT, "95px")} Date : ${dateCourte(d.dateVisaCGT)}${mentionElectronique(d.visaCGTPar ? `${d.visaCGTPar.prenom} ${d.visaCGTPar.nom}` : null, d.dateVisaCGT)}</p>
      <p class="gras cachet">Cachet / Tampon AfriSime :</p>
    </div>
  </div>

  <div class="col instructions">
    <h2 style="margin-top:0">Instructions &amp; bonnes pratiques (procédure<br/>d&apos;utilisation)</h2>
    <ol>
      <li><b>Remplissage</b> : Le collecteur complète toutes les sections I, II et III avant remise au trésorier.</li>
      <li><b>Billetage</b> : Compter les billets devant le trésorier. Les totaux doivent être identiques (éviter déclarations séparées).</li>
      <li><b>Bordereau signé</b> : Le trésorier signe et numérote le bordereau ; une copie est remise au collecteur.</li>
      <li><b>Dépôt bancaire</b> : Les espèces ne doivent pas rester dans la caisse au-delà de 24 h ; dépôt bancaire le jour même. Joindre bordereau de dépôt bancaire au dossier.</li>
      <li><b>Archivage</b> : Conserver l&apos;original 1 (Trésorier), la copie 2 (Collecteur), la copie 3 (CCA) ; numériser et sauvegarder dans AfriGest.</li>
      <li><b>Contrôle</b> : En cas d&apos;écart, rédiger un rapport explicatif annexé au bordereau ; la CCA investigue et propose mesures disciplinaires si besoin.</li>
      <li><b>Seuils</b> : Tout dépôt &gt; ${fmtMontant(d.seuilVisaCGT)} FCFA nécessite visa président + notification à l&apos;AGM trimestrielle.</li>
      <li><b>Sécurité</b> : Collecteur ne doit pas circuler seul avec des montants importants ; prévoir duo ou escorte, et autoriser dépôt via Mobile Money ou virement si possible.</li>
    </ol>
  </div>
  <span class="num-page">p. 2</span>
</section>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(d.reference)} — Bordereau de remise de fonds ${esc(SOCIETE.nom)}</title>
<style>${STYLE}</style>
</head>
<body>${page1}${page2}</body>
</html>`;
}
