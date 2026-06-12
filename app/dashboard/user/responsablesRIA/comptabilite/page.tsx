"use client";

import { useState, useMemo } from "react";
import {
  BookOpen, BarChart2, Scale, FileText, RefreshCw,
  TrendingUp, TrendingDown, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Printer, FileSpreadsheet,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Compte { id: number; numero: string; libelle: string; type: string; sens: string }

interface StatsData {
  stats: {
    totalEcritures: number; totalDebit: number; totalCredit: number;
    equilibre: boolean; parType: Record<string, number>;
  };
  comptes: Compte[];
}

interface LigneJ { id: number; compteId: number; compte: { id: number; numero: string; libelle: string }; libelle: string; debit: number; credit: number }
interface EcritureJ { id: number; reference: string; date: string; libelle: string; journal: string; statut: string; lignes: LigneJ[] }
interface JournalData { data: EcritureJ[]; totaux: { debit: number; credit: number }; meta: { total: number; page: number; totalPages: number } }

interface BalanceLine { compteId: number; numero: string; libelle: string; type: string; totalDebit: number; totalCredit: number; soldeDebiteur: number; soldeCrediteur: number }
interface BalanceData { balance: BalanceLine[]; totaux: { debit: number; credit: number; soldeDebiteur: number; soldeCrediteur: number } }

interface Mvt { id: number; date: string; reference: string; libelle: string; journal: string; debit: number; credit: number; solde: number }
interface GrandLivreData { compte: Compte; mouvements: Mvt[]; totaux: { debit: number; credit: number; solde: number } }

interface BilanRow { compteId: number; numero: string; libelle: string; type: string; solde: number }
interface BilanData {
  bilan: { actif: BilanRow[]; passif: BilanRow[]; totalActif: number; totalPassif: number; equilibre: boolean };
  resultat: { charges: BilanRow[]; produits: BilanRow[]; totalCharges: number; totalProduits: number; resultat: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtD = (s: string) => new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

const TYPE_LABEL: Record<string, string> = {
  "RIA-DEP":  "Dépôts",
  "RIA-RET":  "Retraits",
  "RIA-FIN":  "Financements",
  "RIA-REM":  "Recouvrements",
  "RIA-DIST": "Distributions",
};

const JOURNAL_LABEL: Record<string, string> = {
  BANQUE: "Banque",
  OD:     "OD",
  CAISSE: "Caisse",
};

type Tab = "journal" | "grand-livre" | "balance" | "bilan";

// ── Excel export helper ───────────────────────────────────────────────────────

function exportBalanceExcel(balance: BalanceLine[], totaux: BalanceData["totaux"]) {
  const rows = balance.map((r) =>
    `<Row><Cell><Data ss:Type="String">${r.numero}</Data></Cell><Cell><Data ss:Type="String">${r.libelle}</Data></Cell><Cell><Data ss:Type="String">${r.type}</Data></Cell><Cell><Data ss:Type="Number">${r.totalDebit}</Data></Cell><Cell><Data ss:Type="Number">${r.totalCredit}</Data></Cell><Cell><Data ss:Type="Number">${r.soldeDebiteur}</Data></Cell><Cell><Data ss:Type="Number">${r.soldeCrediteur}</Data></Cell></Row>`
  ).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Balance RIA"><Table><Row><Cell><Data ss:Type="String">N° Compte</Data></Cell><Cell><Data ss:Type="String">Libellé</Data></Cell><Cell><Data ss:Type="String">Type</Data></Cell><Cell><Data ss:Type="String">Débit</Data></Cell><Cell><Data ss:Type="String">Crédit</Data></Cell><Cell><Data ss:Type="String">Solde Débiteur</Data></Cell><Cell><Data ss:Type="String">Solde Créditeur</Data></Cell></Row>${rows}<Row><Cell><Data ss:Type="String">TOTAUX</Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell ss:StyleID="s62"><Data ss:Type="Number">${totaux.debit}</Data></Cell><Cell ss:StyleID="s62"><Data ss:Type="Number">${totaux.credit}</Data></Cell><Cell ss:StyleID="s62"><Data ss:Type="Number">${totaux.soldeDebiteur}</Data></Cell><Cell ss:StyleID="s62"><Data ss:Type="Number">${totaux.soldeCrediteur}</Data></Cell></Row></Table></Worksheet></Workbook>`;
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = `balance-ria-${new Date().toISOString().slice(0,10)}.xls`; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ComptabiliteRIAPage() {
  const [tab, setTab] = useState<Tab>("journal");

  const { data: statsData, loading: statsLoading } = useApi<StatsData>("/api/admin/ria/comptabilite");

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "journal",     label: "Journal des écritures", icon: <BookOpen   className="w-4 h-4" /> },
    { id: "grand-livre", label: "Grand Livre",            icon: <FileText   className="w-4 h-4" /> },
    { id: "balance",     label: "Balance générale",       icon: <BarChart2  className="w-4 h-4" /> },
    { id: "bilan",       label: "Bilan / Résultat",       icon: <Scale      className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Comptabilité RIA</h1>
        <p className="text-sm text-slate-500 mt-0.5">Écritures automatiques et états financiers du module RIA</p>
      </div>

      {/* KPIs */}
      {statsData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Écritures" value={String(statsData.stats.totalEcritures)} icon={<BookOpen className="w-5 h-5" />} color="blue" />
          <KpiCard label="Total Débit" value={`${fmt(statsData.stats.totalDebit)} F`} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
          <KpiCard label="Total Crédit" value={`${fmt(statsData.stats.totalCredit)} F`} icon={<TrendingDown className="w-5 h-5" />} color="amber" />
          <KpiCard
            label="Équilibre"
            value={statsData.stats.equilibre ? "Équilibré" : "Écart détecté"}
            icon={statsData.stats.equilibre ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            color={statsData.stats.equilibre ? "green" : "red"}
          />
        </div>
      )}

      {/* Répartition par type */}
      {statsData && Object.keys(statsData.stats.parType).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(statsData.stats.parType).map(([type, count]) => (
            <span key={type} className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
              {TYPE_LABEL[type] ?? type} : {count}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0.5 overflow-x-auto">
          {TABS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu par onglet */}
      {tab === "journal"     && <TabJournal />}
      {tab === "grand-livre" && <TabGrandLivre comptes={statsData?.comptes ?? []} statsLoading={statsLoading} />}
      {tab === "balance"     && <TabBalance exportExcel={exportBalanceExcel} />}
      {tab === "bilan"       && <TabBilan />}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600", green: "bg-green-50 text-green-600", red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${bg[color] ?? bg.blue}`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Tab Journal ───────────────────────────────────────────────────────────────

function TabJournal() {
  const [page,    setPage]    = useState(1);
  const [type,    setType]    = useState("");
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const url = `/api/admin/ria/comptabilite/journal?page=${page}&limit=50${type ? `&type=${type}` : ""}${dateMin ? `&dateMin=${dateMin}` : ""}${dateMax ? `&dateMax=${dateMax}` : ""}`;
  const { data, loading, refetch } = useApi<JournalData>(url);

  const toggle = (id: number) => setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-end">
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k.replace("RIA-", "")}>{v}</option>)}
        </select>
        <input type="date" value={dateMin} onChange={(e) => { setDateMin(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <input type="date" value={dateMax} onChange={(e) => { setDateMax(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <button onClick={refetch} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg print:hidden">
          <Printer className="w-4 h-4" /> PDF
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Date", "Référence", "Journal", "Libellé", "Débit", "Crédit"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Chargement…
              </td></tr>
            )}
            {!loading && !data?.data?.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucune écriture RIA</td></tr>
            )}
            {(data?.data ?? []).map((e) => (
              <>
                <tr key={e.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => toggle(e.id)}>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmtD(e.date)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-700">{e.reference}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">{JOURNAL_LABEL[e.journal] ?? e.journal}</span></td>
                  <td className="px-4 py-3 text-slate-700">{e.libelle}</td>
                  <td className="px-4 py-3 text-right font-medium text-blue-700">
                    {fmt(e.lignes.reduce((s, l) => s + Number(l.debit), 0))}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-amber-700">
                    {fmt(e.lignes.reduce((s, l) => s + Number(l.credit), 0))}
                  </td>
                </tr>
                {expanded.has(e.id) && e.lignes.map((l) => (
                  <tr key={l.id} className="bg-slate-50/50 text-xs">
                    <td className="px-4 py-1.5 text-slate-400" />
                    <td className="px-4 py-1.5 pl-8 text-slate-500 font-mono">{l.compte.numero}</td>
                    <td className="px-4 py-1.5 text-slate-500" />
                    <td className="px-4 py-1.5 text-slate-600">{l.compte.libelle} — {l.libelle}</td>
                    <td className="px-4 py-1.5 text-right text-blue-600">{Number(l.debit)  > 0 ? fmt(Number(l.debit))  : ""}</td>
                    <td className="px-4 py-1.5 text-right text-amber-600">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : ""}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
          {data && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-xs text-slate-500 font-semibold">Totaux ({data.meta.total} écriture(s))</td>
                <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(data.totaux.debit)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(data.totaux.credit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Précédent</button>
          <span className="text-sm text-slate-500">Page {page} / {data.meta.totalPages}</span>
          <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
}

// ── Tab Grand Livre ────────────────────────────────────────────────────────────

function TabGrandLivre({ comptes, statsLoading }: { comptes: Compte[]; statsLoading: boolean }) {
  const [compteId, setCompteId] = useState<string>("");
  const [dateMin,  setDateMin]  = useState("");
  const [dateMax,  setDateMax]  = useState("");

  const url = compteId
    ? `/api/admin/ria/comptabilite/grand-livre?compteId=${compteId}${dateMin ? `&dateMin=${dateMin}` : ""}${dateMax ? `&dateMax=${dateMax}` : ""}`
    : null;
  const { data, loading } = useApi<GrandLivreData>(url ?? "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {statsLoading ? (
          <div className="text-sm text-slate-400">Chargement des comptes…</div>
        ) : (
          <select value={compteId} onChange={(e) => setCompteId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 min-w-[260px]">
            <option value="">— Sélectionner un compte —</option>
            {comptes.map((c) => <option key={c.id} value={String(c.id)}>{c.numero} — {c.libelle}</option>)}
          </select>
        )}
        <input type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        <input type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
      </div>

      {!compteId && <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 text-sm">Sélectionnez un compte pour afficher ses mouvements</div>}

      {compteId && loading && <div className="flex items-center gap-2 text-slate-400 py-4"><RefreshCw className="w-4 h-4 animate-spin" />Chargement…</div>}

      {data && (
        <>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-4">
            <span className="font-bold text-emerald-800">{data.compte.numero} — {data.compte.libelle}</span>
            <span className="text-sm text-slate-500">{data.mouvements.length} mouvement(s)</span>
            <span className="ml-auto font-bold text-slate-800">Solde : {fmt(data.totaux.solde)} F</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Date", "Référence", "Journal", "Libellé", "Débit", "Crédit", "Solde"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.mouvements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{fmtD(String(m.date))}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-emerald-700">{m.reference}</td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">{JOURNAL_LABEL[m.journal] ?? m.journal}</span></td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{m.libelle}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600">{m.debit  > 0 ? fmt(m.debit)  : ""}</td>
                    <td className="px-4 py-2.5 text-right text-amber-600">{m.credit > 0 ? fmt(m.credit) : ""}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${m.solde >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(Math.abs(m.solde))}{m.solde < 0 ? " Cr" : " Dr"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs text-slate-500 font-semibold">Totaux</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(data.totaux.debit)}</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700">{fmt(data.totaux.credit)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${data.totaux.solde >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(Math.abs(data.totaux.solde))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab Balance ───────────────────────────────────────────────────────────────

function TabBalance({ exportExcel }: { exportExcel: (b: BalanceLine[], t: BalanceData["totaux"]) => void }) {
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");

  const url = `/api/admin/ria/comptabilite/balance${dateMin || dateMax ? `?${dateMin ? `dateMin=${dateMin}` : ""}${dateMin && dateMax ? "&" : ""}${dateMax ? `dateMax=${dateMax}` : ""}` : ""}`;
  const { data, loading } = useApi<BalanceData>(url);

  const byType = useMemo(() => {
    if (!data) return {};
    const map: Record<string, BalanceLine[]> = {};
    for (const r of data.balance) {
      if (!map[r.type]) map[r.type] = [];
      map[r.type].push(r);
    }
    return map;
  }, [data]);

  const TYPE_COLORS: Record<string, string> = {
    ACTIF: "text-blue-700", TRESORERIE: "text-emerald-700", PASSIF: "text-amber-700", CHARGES: "text-red-700", PRODUITS: "text-violet-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <input type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        <input type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        {data && (
          <>
            <button onClick={() => exportExcel(data.balance, data.totaux)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg">
              <Printer className="w-4 h-4" /> PDF
            </button>
          </>
        )}
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin" />Chargement…</div>}

      {data && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["N° Compte", "Libellé", "Type", "Total Débit", "Total Crédit", "Solde Débiteur", "Solde Créditeur"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byType).map(([type, rows]) => (
                <>
                  <tr key={`grp-${type}`} className="bg-slate-50">
                    <td colSpan={7} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${TYPE_COLORS[type] ?? "text-slate-600"}`}>{type}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.compteId} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-xs">{r.numero}</td>
                      <td className="px-4 py-2.5 text-slate-700">{r.libelle}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{r.type}</td>
                      <td className="px-4 py-2.5 text-right text-blue-600">{fmt(r.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-600">{fmt(r.totalCredit)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-blue-700">{r.soldeDebiteur  > 0 ? fmt(r.soldeDebiteur)  : "—"}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-amber-700">{r.soldeCrediteur > 0 ? fmt(r.soldeCrediteur) : "—"}</td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-700">TOTAUX GÉNÉRAUX</td>
                <td className="px-4 py-3 text-right font-bold text-blue-800">{fmt(data.totaux.debit)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-800">{fmt(data.totaux.credit)}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-800">{fmt(data.totaux.soldeDebiteur)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-800">{fmt(data.totaux.soldeCrediteur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab Bilan ─────────────────────────────────────────────────────────────────

function TabBilan() {
  const [dateMin, setDateMin] = useState("");
  const [dateMax, setDateMax] = useState("");

  const url = `/api/admin/ria/comptabilite/bilan${dateMin || dateMax ? `?${dateMin ? `dateMin=${dateMin}` : ""}${dateMin && dateMax ? "&" : ""}${dateMax ? `dateMax=${dateMax}` : ""}` : ""}`;
  const { data, loading } = useApi<BilanData>(url);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <input type="date" value={dateMin} onChange={(e) => setDateMin(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        <input type="date" value={dateMax} onChange={(e) => setDateMax(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none" />
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg print:hidden">
          <Printer className="w-4 h-4" /> PDF
        </button>
      </div>

      {loading && <div className="flex items-center gap-2 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin" />Chargement…</div>}

      {data && (
        <div className="space-y-6">
          {/* Bilan ACTIF / PASSIF */}
          <div className="grid grid-cols-2 gap-4">
            <BilanSection
              title="ACTIF"
              rows={data.bilan.actif}
              total={data.bilan.totalActif}
              color="blue"
            />
            <BilanSection
              title={`PASSIF${data.resultat.resultat > 0 ? " + RÉSULTAT" : ""}`}
              rows={data.bilan.passif}
              total={data.bilan.totalPassif}
              extra={data.resultat.resultat !== 0 ? { label: "Résultat de l'exercice", montant: data.resultat.resultat } : undefined}
              color="amber"
            />
          </div>

          {/* Indicateur équilibre */}
          <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl border ${data.bilan.equilibre ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
            {data.bilan.equilibre
              ? <><CheckCircle className="w-4 h-4" /> Bilan équilibré — Actif = Passif + Résultat</>
              : <><AlertTriangle className="w-4 h-4" /> Écart détecté — vérifiez les comptes</>}
          </div>

          {/* Compte de résultat */}
          <div>
            <h3 className="text-base font-bold text-slate-700 mb-3">Compte de Résultat</h3>
            <div className="grid grid-cols-2 gap-4">
              <BilanSection title="CHARGES" rows={data.resultat.charges} total={data.resultat.totalCharges} color="red" />
              <BilanSection title="PRODUITS" rows={data.resultat.produits} total={data.resultat.totalProduits} color="violet" />
            </div>
            <div className={`mt-3 px-4 py-3 rounded-xl border text-sm font-semibold ${data.resultat.resultat >= 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              {data.resultat.resultat >= 0 ? "Bénéfice net" : "Perte nette"} : {fmt(Math.abs(data.resultat.resultat))} FCFA
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BilanSection({
  title, rows, total, extra, color,
}: {
  title: string; rows: BilanRow[]; total: number;
  extra?: { label: string; montant: number };
  color: string;
}) {
  const [open, setOpen] = useState(true);
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700", violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-4 py-3 font-bold text-sm ${colors[color] ?? colors.blue}`}>
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-50">
          {rows.map((r) => (
            <div key={r.compteId} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-slate-600"><span className="font-mono text-xs text-slate-400 mr-2">{r.numero}</span>{r.libelle}</span>
              <span className="font-semibold text-slate-800">{fmt(Math.abs(r.solde))} F</span>
            </div>
          ))}
          {extra && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-slate-50">
              <span className="text-slate-600 italic">{extra.label}</span>
              <span className={`font-semibold ${extra.montant >= 0 ? "text-emerald-700" : "text-red-600"}`}>{fmt(Math.abs(extra.montant))} F</span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
            <span className="font-bold text-slate-700 text-sm">Total {title}</span>
            <span className="font-bold text-slate-900">{fmt(total + (extra?.montant ?? 0))} F</span>
          </div>
        </div>
      )}
    </div>
  );
}
