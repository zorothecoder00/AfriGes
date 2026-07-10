/**
 * Générateur de code-barres Code 128 (jeu B) → SVG, sans dépendance externe
 * (Catalogue §13). Fonctionne côté serveur comme côté client. Encode texte
 * ASCII imprimable (32–126) : lettres, chiffres, ponctuation — suffisant pour
 * les codes produit / codes-barres internes AfriSime.
 */

// Table canonique Code 128 : largeurs des 6 modules (barre/espace alternés) de
// chaque symbole, index = valeur du symbole (0..106). L'index 106 est le motif
// d'arrêt (7 modules).
const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

const START_B = 104;
const STOP = 106;

export interface BarcodeOptions {
  moduleWidth?: number; // largeur d'un module en px (défaut 2)
  height?: number;      // hauteur des barres en px (défaut 60)
  showText?: boolean;   // afficher le texte lisible sous le code (défaut true)
  margin?: number;      // marge blanche (quiet zone) en modules (défaut 10)
}

/** Nettoie/tronque une valeur pour rester dans le jeu Code 128-B (ASCII 32–126). */
export function sanitizeBarcodeValue(value: string): string {
  return Array.from(value)
    .filter((c) => { const n = c.charCodeAt(0); return n >= 32 && n <= 126; })
    .join("")
    .slice(0, 48);
}

/** Suite de symboles Code 128-B (valeurs) pour une chaîne, avec checksum. */
function encodeValues(data: string): number[] {
  const values = [START_B];
  for (const ch of data) values.push(ch.charCodeAt(0) - 32);
  // Checksum pondéré : start × 1 + Σ(valeur_i × position_i), modulo 103.
  let sum = START_B;
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  values.push(sum % 103);
  values.push(STOP);
  return values;
}

/**
 * Génère un SVG (chaîne) encodant `data` en Code 128-B. Renvoie un SVG vide
 * (placeholder) si la valeur nettoyée est vide.
 */
export function code128Svg(data: string, opts: BarcodeOptions = {}): string {
  const { moduleWidth = 2, height = 60, showText = true, margin = 10 } = opts;
  const clean = sanitizeBarcodeValue(data);
  if (!clean) return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`;

  const values = encodeValues(clean);
  const modules = values.map((v) => PATTERNS[v]).join("");

  // Construit les rectangles (barres) : chiffres pairs = barre, impairs = espace.
  let x = margin;
  const bars: string[] = [];
  let bar = true;
  for (const chStr of modules) {
    const w = Number(chStr) * moduleWidth;
    if (bar && w > 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}" />`);
    x += w;
    bar = !bar;
  }

  const totalWidth = x + margin;
  const textH = showText ? 18 : 0;
  const svgH = height + textH;
  const textEl = showText
    ? `<text x="${totalWidth / 2}" y="${height + 14}" text-anchor="middle" font-family="monospace" font-size="14" fill="#111">${escapeXml(clean)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgH}" viewBox="0 0 ${totalWidth} ${svgH}">`
    + `<rect x="0" y="0" width="${totalWidth}" height="${svgH}" fill="#fff"/>`
    + `<g fill="#000">${bars.join("")}</g>${textEl}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));
}

/** SVG encodé en data-URI (utilisable dans un <img src> ou pour l'impression). */
export function code128DataUri(data: string, opts?: BarcodeOptions): string {
  const svg = code128Svg(data, opts);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
