"use client";

import { useState, type ReactNode } from "react";
import { useApi } from "@/hooks/useApi";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import {
  FolderTree, Folder, FolderOpen, Calendar, ChevronRight, ChevronDown,
  Banknote, AlertTriangle, XCircle, FileText, X, RefreshCw, ArrowLeft, Loader2,
  FileSpreadsheet, Printer,
} from "lucide-react";

interface Agg { nbCollectes: number; montantCollecte: number; nbRetards: number; montantRetards: number; nbImpayes: number; montantImpayes: number }
interface Rapport { totalCollecte: number; nbRetards: number; montantRetards: number; nbImpayes: number; montantImpayes: number; tauxRecouvrement: number }
interface NoeudJour { date: string; label: string; agg: Agg; rapport: Rapport }
interface NoeudSemaine { semaine: number; label: string; agg: Agg; rapport: Rapport; jours: NoeudJour[] }
interface NoeudMois { mois: number; label: string; agg: Agg; rapport: Rapport; semaines: NoeudSemaine[] }
interface ArbreAnnee { annee: number; agg: Agg; rapport: Rapport; mois: NoeudMois[]; anneesDisponibles: number[] }

interface ItemCollecte { id: number; client: string; reference: string; montant: number; numeroJour: number | null; agent: string | null; heure: string }
interface ItemRetard { client: string; reference: string; numeroEcheance: number; dateEcheance: string; reste: number; joursRetard: number }
interface ItemImpaye { client: string; reference: string; soldeRestant: number; dateEcheanceFin: string }
interface DetailJour { date: string; label: string; collectes: ItemCollecte[]; retards: ItemRetard[]; impayes: ItemImpaye[]; rapport: Rapport }

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

// ── Utilitaires d'export ────────────────────────────────────────────────────────
type Cell = string | number;
function imprimerPDF(titre: string, corpsHTML: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"/><title>${titre}</title>` +
    `<style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#1e293b}` +
    `h1{font-size:18px;margin:0 0 12px}h2{font-size:13px;margin:16px 0 6px;color:#475569}` +
    `table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}` +
    `th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left}th{background:#f8fafc}` +
    `.r{text-align:right}</style></head><body><h1>${titre}</h1>${corpsHTML}` +
    `<script>window.onload=function(){window.print()}</script></body></html>`
  );
  w.document.close();
}

// Détail ligne par ligne d'une plage (chargé en une requête ?from=&to=).
interface ItemCollecteP extends ItemCollecte { jour: string }
interface ItemRetardP   extends ItemRetard   { jour: string }
interface ItemImpayeP   extends ItemImpaye   { jour: string }
interface DetailPlage { collectes: ItemCollecteP[]; retards: ItemRetardP[]; impayes: ItemImpayeP[] }

const ENTETE_PLAGE = ["Jour", "Type", "Client", "Référence", "Détail", "Montant"];
function lignesPlage(p: DetailPlage): Cell[][] {
  const rows: { k: string; cells: Cell[] }[] = [];
  p.collectes.forEach((c) => rows.push({ k: `${c.jour}-1`, cells: [c.jour, "Collecte", c.client, c.reference, [c.numeroJour ? `J${c.numeroJour}` : "", c.agent ?? "", c.heure].filter(Boolean).join(" · "), c.montant] }));
  p.retards.forEach((r) => rows.push({ k: `${r.jour}-2`, cells: [r.jour, "Retard", r.client, r.reference, `Échéance #${r.numeroEcheance} · ${r.joursRetard}j`, r.reste] }));
  p.impayes.forEach((m) => rows.push({ k: `${m.jour}-3`, cells: [m.jour, "Impayé", m.client, m.reference, "Crédit clos", m.soldeRestant] }));
  rows.sort((a, b) => a.k.localeCompare(b.k));
  return rows.map((r) => r.cells);
}
/** Calcule la plage [from, to) couvrant les jours d'un nœud. */
function plageDe(jours: NoeudJour[]): { from: string; to: string } | null {
  if (!jours.length) return null;
  const dates = jours.map((j) => j.date).sort();
  const d = new Date(dates[dates.length - 1]); d.setDate(d.getDate() + 1);
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: dates[0], to };
}
async function chargerPlage(apiBase: string, jours: NoeudJour[]): Promise<DetailPlage | null> {
  const r = plageDe(jours);
  if (!r) return { collectes: [], retards: [], impayes: [] };
  const res = await fetch(`${apiBase}?from=${r.from}&to=${r.to}`);
  if (!res.ok) return null;
  return (await res.json()).data as DetailPlage;
}
async function exporterXlsxNoeud(apiBase: string, label: string, jours: NoeudJour[]) {
  const p = await chargerPlage(apiBase, jours);
  if (!p) return;
  await exportRowsToXlsx(
    [ENTETE_PLAGE, ...lignesPlage(p)],
    `archivage-${label}.xlsx`.replace(/\s+/g, "_"),
    { sheetName: "Détail", columnTypes: ["text", "text", "text", "text", "text", "currency"] },
  );
}
async function exporterPDFNoeud(apiBase: string, label: string, jours: NoeudJour[]) {
  const p = await chargerPlage(apiBase, jours);
  if (!p) return;
  const body = lignesPlage(p).map((c) => `<tr>${c.map((cell, i) => `<td class="${i === 5 ? "r" : ""}">${i === 5 ? fmt(Number(cell)) : cell}</td>`).join("")}</tr>`).join("");
  const corps = `<h2>Détail ligne par ligne</h2><table><thead><tr>${ENTETE_PLAGE.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="6">Aucun élément</td></tr>`}</tbody></table>`;
  imprimerPDF(`Archivage — ${label}`, corps);
}

/** Détail d'un jour en table unifiée (mêmes colonnes que la plage, sans "Jour"). */
const ENTETE_JOUR = ["Type", "Client", "Référence", "Détail", "Montant"];
function lignesJour(d: DetailJour): Cell[][] {
  const rows: Cell[][] = [];
  d.collectes.forEach((c) => rows.push(["Collecte", c.client, c.reference, [c.numeroJour ? `J${c.numeroJour}` : "", c.agent ?? "", c.heure].filter(Boolean).join(" · "), c.montant]));
  d.retards.forEach((r) => rows.push(["Retard", r.client, r.reference, `Échéance #${r.numeroEcheance} · ${r.joursRetard}j`, r.reste]));
  d.impayes.forEach((m) => rows.push(["Impayé", m.client, m.reference, "Crédit clos", m.soldeRestant]));
  return rows;
}
async function exporterXlsxJour(d: DetailJour) {
  await exportRowsToXlsx(
    [ENTETE_JOUR, ...lignesJour(d)],
    `archivage-${d.date}.xlsx`,
    { sheetName: d.label.slice(0, 31), columnTypes: ["text", "text", "text", "text", "currency"] },
  );
}
function exporterPDFJour(d: DetailJour) {
  const tbl = (titre: string, head: string[], corps: string, ncols: number) =>
    `<h2>${titre}</h2><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${corps || `<tr><td colspan="${ncols}">Aucun élément</td></tr>`}</tbody></table>`;
  const col = d.collectes.map((c) => `<tr><td>${c.client}</td><td>${c.reference}</td><td>${c.numeroJour ? `J${c.numeroJour}` : "—"}</td><td>${c.agent ?? "—"}</td><td>${c.heure}</td><td class="r">${fmt(c.montant)}</td></tr>`).join("");
  const ret = d.retards.map((r) => `<tr><td>${r.client}</td><td>${r.reference}</td><td>#${r.numeroEcheance}</td><td>${r.joursRetard} j</td><td class="r">${fmt(r.reste)}</td></tr>`).join("");
  const imp = d.impayes.map((m) => `<tr><td>${m.client}</td><td>${m.reference}</td><td class="r">${fmt(m.soldeRestant)}</td></tr>`).join("");
  const synthese = `<p>Recouvrement : <b>${d.rapport.tauxRecouvrement}%</b> · Collecté ${fmt(d.rapport.totalCollecte)} · Retards ${fmt(d.rapport.montantRetards)} · Impayés ${fmt(d.rapport.montantImpayes)}</p>`;
  imprimerPDF(`Archivage — ${d.label}`,
    synthese
    + tbl("Collectes", ["Client", "Réf.", "Jour", "Agent", "Heure", "Montant"], col, 6)
    + tbl("Retards", ["Client", "Réf.", "Échéance", "Retard", "Reste dû"], ret, 5)
    + tbl("Impayés", ["Client", "Réf.", "Solde restant"], imp, 3));
}

/** Boutons Excel / PDF d'un nœud → détail ligne par ligne de tous ses jours. */
function ExportNoeud({ apiBase, label, jours }: { apiBase: string; label: string; jours: NoeudJour[] }) {
  const [busy, setBusy] = useState<null | "xlsx" | "pdf">(null);
  const run = async (kind: "xlsx" | "pdf", fn: () => Promise<void>) => { setBusy(kind); try { await fn(); } finally { setBusy(null); } };
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      <button onClick={(e) => { e.stopPropagation(); run("xlsx", () => exporterXlsxNoeud(apiBase, label, jours)); }} disabled={busy !== null} title="Export Excel (détail ligne par ligne)" className="p-1 text-slate-300 hover:text-emerald-600 disabled:opacity-50">
        {busy === "xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
      </button>
      <button onClick={(e) => { e.stopPropagation(); run("pdf", () => exporterPDFNoeud(apiBase, label, jours)); }} disabled={busy !== null} title="Export PDF (détail ligne par ligne)" className="p-1 text-slate-300 hover:text-rose-600 disabled:opacity-50">
        {busy === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

/** Badges des 4 rubriques pour un nœud. */
function Rubriques({ agg, rapport }: { agg: Agg; rapport: Rapport }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-xs">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" title="Collectes">
        <Banknote className="w-3 h-3" /> {agg.nbCollectes} · {fmt(agg.montantCollecte)}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700" title="Retards">
        <AlertTriangle className="w-3 h-3" /> {agg.nbRetards} · {fmt(agg.montantRetards)}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700" title="Impayés">
        <XCircle className="w-3 h-3" /> {agg.nbImpayes} · {fmt(agg.montantImpayes)}
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700" title="Rapport — taux de recouvrement">
        <FileText className="w-3 h-3" /> {rapport.tauxRecouvrement}%
      </span>
    </div>
  );
}

export default function ArchivageClasseurs({ apiBase, backHref }: { apiBase: string; backHref?: string }) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<{ data: ArbreAnnee }>(`${apiBase}?year=${year}&_r=${refresh}`);
  const arbre = data?.data;

  const [openMois, setOpenMois] = useState<Set<number>>(new Set());
  const [openSem, setOpenSem] = useState<Set<string>>(new Set());
  const [jour, setJour] = useState<string | null>(null);

  const toggle = <T,>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const annees = arbre?.anneesDisponibles ?? [year];

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* En-tête */}
      <div>
        {backHref && (
          <a href={backHref} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-1">
            <ArrowLeft className="w-4 h-4" /> Retour
          </a>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-indigo-600" /> Archivage — classeurs numériques
          </h1>
          <div className="flex items-center gap-2">
            <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setOpenMois(new Set()); setOpenSem(new Set()); }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {annees.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => setRefresh((x) => x + 1)} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-1">Généré automatiquement : Année → Mois → Semaine → Jour · Collectes · Retards · Impayés · Rapports.</p>
      </div>

      {/* Synthèse année */}
      {arbre && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <FolderOpen className="w-5 h-5 text-amber-500" /> Année {arbre.annee}
          </div>
          <div className="flex items-center gap-2">
            <Rubriques agg={arbre.agg} rapport={arbre.rapport} />
            <ExportNoeud apiBase={apiBase} label={`Annee-${arbre.annee}`} jours={arbre.mois.flatMap((m) => m.semaines.flatMap((s) => s.jours))} />
          </div>
        </div>
      )}

      {/* Arbre */}
      {loading && !arbre ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : !arbre?.mois.length ? (
        <div className="text-center py-12 text-slate-400 bg-white border border-slate-200 rounded-xl">Aucune donnée archivée pour {year}</div>
      ) : (
        <div className="space-y-2">
          {arbre.mois.map((m) => {
            const moisOpen = openMois.has(m.mois);
            return (
              <div key={m.mois} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <button onClick={() => toggle(openMois, m.mois, setOpenMois)} className="flex items-center gap-2 font-medium text-slate-800 flex-1 text-left min-w-0">
                    {moisOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" /> {m.label}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Rubriques agg={m.agg} rapport={m.rapport} />
                    <ExportNoeud apiBase={apiBase} label={`${arbre.annee}-${m.label}`} jours={m.semaines.flatMap((s) => s.jours)} />
                  </div>
                </div>

                {moisOpen && (
                  <div className="border-t border-slate-100 px-3 py-2 space-y-1.5">
                    {m.semaines.map((s) => {
                      const semKey = `${m.mois}-${s.semaine}`;
                      const semOpen = openSem.has(semKey);
                      return (
                        <div key={semKey} className="rounded-lg border border-slate-100">
                          <div className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50">
                            <button onClick={() => toggle(openSem, semKey, setOpenSem)} className="flex items-center gap-2 text-sm text-slate-700 flex-1 text-left min-w-0">
                              {semOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                              <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> {s.label}
                            </button>
                            <div className="flex items-center gap-2 shrink-0">
                              <Rubriques agg={s.agg} rapport={s.rapport} />
                              <ExportNoeud apiBase={apiBase} label={`${arbre.annee}-${m.label}-${s.label}`} jours={s.jours} />
                            </div>
                          </div>
                          {semOpen && (
                            <div className="px-3 pb-2 space-y-1">
                              {s.jours.map((j) => (
                                <div key={j.date} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
                                  <button onClick={() => setJour(j.date)} className="text-sm text-slate-600 flex-1 text-left min-w-0 hover:text-indigo-700">{j.label}</button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Rubriques agg={j.agg} rapport={j.rapport} />
                                    <ExportNoeud apiBase={apiBase} label={j.label} jours={[j]} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {jour && <DetailJourModal apiBase={apiBase} date={jour} onClose={() => setJour(null)} />}
    </div>
  );
}

function DetailJourModal({ apiBase, date, onClose }: { apiBase: string; date: string; onClose: () => void }) {
  const { data, loading } = useApi<{ data: DetailJour }>(`${apiBase}?date=${date}`);
  const d = data?.data;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600" /> {d?.label ?? date}</h2>
          <div className="flex items-center gap-1">
            {d && (
              <>
                <button onClick={() => exporterXlsxJour(d)} title="Export Excel" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel</button>
                <button onClick={() => exporterPDFJour(d)} title="Export PDF" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100"><Printer className="w-3.5 h-3.5" /> PDF</button>
              </>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {loading && !d ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : d ? (
          <div className="overflow-y-auto px-6 py-4 space-y-5">
            {/* Rapport */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3"><p className="text-xs text-emerald-600">Collecté</p><p className="text-lg font-bold text-emerald-700">{fmt(d.rapport.totalCollecte)}</p></div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3"><p className="text-xs text-amber-600">Retards</p><p className="text-lg font-bold text-amber-700">{d.rapport.nbRetards} · {fmt(d.rapport.montantRetards)}</p></div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3"><p className="text-xs text-rose-600">Impayés</p><p className="text-lg font-bold text-rose-700">{d.rapport.nbImpayes} · {fmt(d.rapport.montantImpayes)}</p></div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3"><p className="text-xs text-blue-600">Recouvrement</p><p className="text-lg font-bold text-blue-700">{d.rapport.tauxRecouvrement}%</p></div>
            </div>

            {/* Collectes */}
            <Section titre="Collectes" icon={<Banknote className="w-4 h-4 text-emerald-600" />} vide={d.collectes.length === 0}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="py-1.5">Client</th><th>Jour</th><th>Agent</th><th>Heure</th><th className="text-right">Montant</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {d.collectes.map((c) => (
                    <tr key={c.id}><td className="py-1.5"><p className="font-medium text-slate-800">{c.client}</p><p className="text-xs text-slate-400">{c.reference}</p></td>
                      <td className="text-slate-500">{c.numeroJour ? `J${c.numeroJour}` : "—"}</td><td className="text-slate-500 text-xs">{c.agent ?? "—"}</td><td className="text-slate-500 text-xs">{c.heure}</td>
                      <td className="text-right font-semibold text-emerald-700">{fmt(c.montant)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Retards */}
            <Section titre="Retards" icon={<AlertTriangle className="w-4 h-4 text-amber-600" />} vide={d.retards.length === 0}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="py-1.5">Client</th><th>Échéance</th><th>Retard</th><th className="text-right">Reste dû</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {d.retards.map((r, i) => (
                    <tr key={i}><td className="py-1.5"><p className="font-medium text-slate-800">{r.client}</p><p className="text-xs text-slate-400">{r.reference}</p></td>
                      <td className="text-slate-500">#{r.numeroEcheance}</td><td className="text-amber-600 text-xs">{r.joursRetard} j</td>
                      <td className="text-right font-semibold text-amber-700">{fmt(r.reste)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Impayés */}
            <Section titre="Impayés" icon={<XCircle className="w-4 h-4 text-rose-600" />} vide={d.impayes.length === 0}>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100"><th className="py-1.5">Client</th><th>Crédit</th><th className="text-right">Solde restant</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {d.impayes.map((m, i) => (
                    <tr key={i}><td className="py-1.5 font-medium text-slate-800">{m.client}</td><td className="text-slate-500 text-xs">{m.reference}</td>
                      <td className="text-right font-semibold text-rose-700">{fmt(m.soldeRestant)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </div>
        ) : null}

        <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function Section({ titre, icon, vide, children }: { titre: string; icon: ReactNode; vide: boolean; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2">{icon} {titre}</h3>
      {vide ? <p className="text-xs text-slate-400 italic">Aucun élément.</p> : <div className="overflow-x-auto border border-slate-100 rounded-lg px-3 py-1">{children}</div>}
    </div>
  );
}
