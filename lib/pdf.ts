/**
 * lib/pdf.ts — Génération PDF côté serveur, mutualisée.
 *
 * Rend n'importe quel HTML en PDF via Chromium headless :
 *   - en production (Vercel) : binaire @sparticuz/chromium
 *   - en local : le Chrome installé sur la machine (channel "chrome")
 *
 * Réutilisée par les bulletins de paie et les documents RH (qui fournissent
 * déjà leur HTML), puis renvoyée en streaming (aucun stockage à gérer).
 *
 * Les routes appelantes DOIVENT déclarer le runtime Node :
 *   export const runtime = "nodejs";
 *   export const maxDuration = 30;
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { readFile } from "fs/promises";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

// Timeout de lancement : sans ça, une incompatibilité de protocole entre
// puppeteer-core et le Chromium @sparticuz laisse la fonction « en attente »
// jusqu'au maxDuration Vercel. On échoue vite et proprement à la place.
const LAUNCH_TIMEOUT_MS = 20_000;

// En serverless : pas de WebGL/animations → démarrage plus léger et rapide.
chromium.setGraphicsMode = false;

async function launchBrowser(): Promise<Browser> {
  // Override explicite (ex. chemin Chrome custom) prioritaire.
  const exePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  if (!isProd && !exePath) {
    // Dev local : utilise le Chrome/Chromium installé sur la machine.
    return puppeteer.launch({ headless: true, channel: "chrome", timeout: LAUNCH_TIMEOUT_MS });
  }

  return puppeteer.launch({
    args:            chromium.args,
    executablePath:  exePath ?? (await chromium.executablePath()),
    headless:        true,
    timeout:         LAUNCH_TIMEOUT_MS,
  });
}

export interface PdfOptions {
  format?:    "A4" | "A5" | "Letter";
  landscape?: boolean;
  /** Facteur d'échelle du rendu (0.1–2) : < 1 pour faire tenir des gabarits conçus pour A4 portrait. */
  scale?:     number;
  margin?:    { top?: string; right?: string; bottom?: string; left?: string };
}

/** Petits documents (bons, fiches, bordereaux) : A5 à l'horizontal, marges réduites. */
export const PDF_A5_PAYSAGE: PdfOptions = {
  format: "A5", landscape: true, scale: 0.82,
  margin: { top: "8mm", right: "8mm", bottom: "9mm", left: "8mm" },
};

/** Formulaires papier AfriSime reproduits en A4 paysage (bordereau de remise, fiche de collecte). */
export const PDF_A4_PAYSAGE_FORMULAIRE: PdfOptions = {
  format: "A4", landscape: true, scale: 1,
  margin: { top: "9mm", right: "9mm", bottom: "9mm", left: "9mm" },
};

/** Repli automatique quand un gabarit A5 déborde : même esprit paysage, en A4. */
export const PDF_A4_PAYSAGE: PdfOptions = {
  format: "A4", landscape: true, scale: 0.9,
  margin: { top: "10mm", right: "10mm", bottom: "11mm", left: "10mm" },
};

async function renderPdfPage(page: Page, opts: PdfOptions): Promise<Buffer> {
  const pdf = await page.pdf({
    format:          opts.format ?? "A4",
    landscape:       opts.landscape ?? false,
    scale:           opts.scale ?? 1,
    printBackground: true,
    margin:          opts.margin ?? { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
    timeout:         15_000,
  });
  return Buffer.from(pdf);
}

/** Nombre de pages d'un PDF, par comptage brut des objets `/Type /Page` (évite une dépendance PDF). */
function countPdfPages(pdf: Buffer): number {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

/**
 * Rend un document HTML complet en PDF (Buffer) via Chromium headless.
 * `html` doit être un document HTML autonome (styles inline ou <style>).
 */
export async function htmlToPdf(html: string, opts: PdfOptions = {}): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Nos gabarits sont autonomes (aucune ressource distante) → "load" est immédiat ;
    // le timeout borne malgré tout un éventuel blocage plutôt que d'attendre indéfiniment.
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    return await renderPdfPage(page, opts);
  } catch (err) {
    // Rendu visible dans les Runtime Logs Vercel (au lieu d'un « en attente » muet).
    console.error("[htmlToPdf] génération PDF échouée :", err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Rend un document en petit format (A5 paysage par défaut) et bascule automatiquement
 * en grand format (A4 paysage) si le contenu déborde sur plusieurs pages en A5 — pour
 * les documents commerciaux / centre de commandement dont certains ont beaucoup de
 * champs à remplir (donc plus de texte que le gabarit A5 standard).
 * Même contrat que `htmlToPdf` : à utiliser à sa place partout où `PDF_A5_PAYSAGE`
 * servait jusqu'ici.
 */
export async function htmlToPdfAdaptatif(
  html: string,
  compact: PdfOptions = PDF_A5_PAYSAGE,
  large: PdfOptions = PDF_A4_PAYSAGE,
): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 15_000 });
    const pdf = await renderPdfPage(page, compact);
    if (countPdfPages(pdf) <= 1) return pdf;
    // Contenu trop long pour tenir sur une page A5 → même page déjà chargée, on régénère juste le PDF en A4.
    return await renderPdfPage(page, large);
  } catch (err) {
    console.error("[htmlToPdfAdaptatif] génération PDF échouée :", err);
    throw err;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Enveloppe un fragment HTML (ex. `DocumentRHGenere.contenu`) dans un document
 * complet, imprimable, avec une base typographique propre.
 */
export function wrapHtmlDocument(bodyHtml: string, title = "Document"): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  h1, h2, h3 { color: #0f172a; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/** Construit une réponse HTTP PDF en streaming (inline par défaut). */
export function pdfResponse(
  pdf: Buffer,
  filename: string,
  disposition: "inline" | "attachment" = "inline",
): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control":       "private, no-store",
    },
  });
}

/** Échappe le HTML pour une insertion sûre dans un gabarit. */
export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Image de /public en data URL pour les gabarits PDF (null si absente : le document reste valide sans). */
export async function imagePubliqueDataUrl(fichier: string, type: string): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", fichier));
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch { return null; }
}
