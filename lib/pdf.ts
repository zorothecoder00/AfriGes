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

import puppeteer, { type Browser } from "puppeteer-core";
import chromium from "@sparticuz/chromium";

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
  format?:    "A4" | "Letter";
  landscape?: boolean;
  margin?:    { top?: string; right?: string; bottom?: string; left?: string };
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
    const pdf = await page.pdf({
      format:          opts.format ?? "A4",
      landscape:       opts.landscape ?? false,
      printBackground: true,
      margin:          opts.margin ?? { top: "12mm", right: "12mm", bottom: "14mm", left: "12mm" },
      timeout:         15_000,
    });
    return Buffer.from(pdf);
  } catch (err) {
    // Rendu visible dans les Runtime Logs Vercel (au lieu d'un « en attente » muet).
    console.error("[htmlToPdf] génération PDF échouée :", err);
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
