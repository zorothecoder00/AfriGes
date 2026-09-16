"use client";

import { useState } from "react";
import { X, Printer, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Chrome partagé pour les documents imprimables générés côté navigateur
 * (aperçu iframe zoomable + impression couleur/N-B) — extrait de
 * BordereauRemboursement pour éviter de dupliquer ~120 lignes de modal à
 * chaque nouveau document (Reçu, Avis d'échéance, Fiche de recouvrement…).
 * BordereauRemboursement lui-même n'a pas été touché (fonctionne déjà).
 */

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
export const dash = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? "—" : String(v));
export const fmtMoney = (v: number | string | null | undefined) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(v ?? 0))) + " FCFA";
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");
export const fmtDateHeure = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** Code-barres décoratif (SVG) dérivé d'un texte — non scannable. */
export function barcodeSvg(text: string, color: string): string {
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (let b = 0; b < 4; b++) {
      const w = ((code >> b) & 1) ? 3 : 1;
      if ((i + b) % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="38" fill="${color}"/>`);
      x += w + 1;
    }
  }
  return `<svg width="100%" height="38" viewBox="0 0 ${x} 38" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${bars.join("")}</svg>`;
}

export function openPrint(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
  } else {
    win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
    setTimeout(() => { try { win.print(); } catch { /* ignoré */ } URL.revokeObjectURL(url); }, 1500);
  }
}

export interface DocPalette {
  text: string; muted: string; faint: string; rule: string; line: string;
  headBg: string; headText: string; accent: string; danger: string;
  logoFilter: string; barColor: string;
}

/** Palette couleur AfriSime (vert) ou N/B économe en encre selon `mono`. */
export function palette(mono: boolean): DocPalette {
  return mono
    ? { text: "#000", muted: "#333", faint: "#555", rule: "#000", line: "#999", headBg: "#eee", headText: "#000", accent: "#000", danger: "#000", logoFilter: "filter:grayscale(1);", barColor: "#000" }
    : { text: "#0f172a", muted: "#475569", faint: "#94a3b8", rule: "#047857", line: "#e2e8f0", headBg: "#ecfdf5", headText: "#065f46", accent: "#047857", danger: "#dc2626", logoFilter: "", barColor: "#0f172a" };
}

export function DocumentPrintShell({ title, reference, filename, buildHtml, onClose }: {
  title: string;
  reference: string;
  filename: string;
  /** Construit le HTML complet du document ; `mono` = version N/B économe en encre. */
  buildHtml: (mono: boolean) => string;
  onClose: () => void;
}) {
  const previewHtml = buildHtml(false);

  const ZOOM_MIN = 0.6, ZOOM_MAX = 2, ZOOM_STEP = 0.1;
  const [zoom, setZoom] = useState(0.8);
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10));

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[97vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800">{title}</h3>
            <p className="text-xs text-slate-400 font-mono">{reference}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-1 rounded-xl border border-slate-200 bg-slate-50 px-1 py-0.5">
              <button
                onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                title="Réduire l'aperçu"
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => setZoom(1)}
                title="Réinitialiser le zoom (100 %)"
                className="min-w-[48px] text-center text-xs font-medium text-slate-600 hover:text-slate-900 tabular-nums transition-colors">
                {Math.round(zoom * 100)} %
              </button>
              <button
                onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                title="Agrandir l'aperçu"
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
                <ZoomIn size={14} />
              </button>
            </div>
            <button
              onClick={() => openPrint(buildHtml(true), filename)}
              title="Impression noir & blanc, économe en encre"
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Printer size={14} /> Imprimer en N/B
            </button>
            <button
              onClick={() => openPrint(previewHtml, filename)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={16} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-slate-100 p-2">
          <iframe
            title={`Aperçu ${title}`}
            srcDoc={previewHtml}
            className="bg-white rounded-lg border border-slate-200"
            style={{
              width: `${100 / zoom}%`,
              height: `${100 / zoom}%`,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          />
        </div>
      </div>
    </div>
  );
}
