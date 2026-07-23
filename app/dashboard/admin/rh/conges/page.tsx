"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, CheckCircle,
  Clock, XCircle, CalendarDays, User,
  ChevronRight, AlertTriangle, Settings,
  X, Save, ArrowLeft, Plus, ChevronLeft,
  BarChart2, Wallet, Ban, Download,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { exportToXlsx } from "@/lib/exportXlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Demande {
  id:               number;
  type:             string;
  statut:           string;
  dateDebut:        string;
  dateFin:          string;
  nbJours:          number;
  motif:            string | null;
  commentaireRefus: string | null;
  createdAt:        string;
  profilRH: {
    id:        number;
    matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
}

interface DemandesResponse {
  data:  Demande[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface Politique {
  id:             number;
  type:           string;
  joursParAn:     number;
  reportable:     boolean;
  joursMaxReport: number;
  description:    string | null;
  actif:          boolean;
}

interface SoldeLine {
  profilRH: { id: number; matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
  soldes:   { type: string; totalDroit: number; pris: number; reporte: number; restant: number }[];
  annee:    number;
}

interface CalendrierResponse {
  data:    Demande[];
  byDay:   Record<string, { profilRHId: number; nom: string; prenom: string; type: string }[]>;
  periode: { annee: number; mois: number | null };
}

interface ProfilRH {
  id: number; matricule: string;
  gestionnaire: { member: { nom: string; prenom: string } };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE:      "bg-amber-100 text-amber-700",
  VALIDE_MANAGER:  "bg-blue-100 text-blue-700",
  VALIDE_RH:       "bg-indigo-100 text-indigo-700",
  APPROUVE:        "bg-emerald-100 text-emerald-700",
  REJETE:          "bg-red-100 text-red-700",
  ANNULE:          "bg-gray-100 text-gray-500",
};

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE:     "En attente",
  VALIDE_MANAGER: "Validé manager",
  VALIDE_RH:      "Validé RH",
  APPROUVE:       "Approuvé",
  REJETE:         "Rejeté",
  ANNULE:         "Annulé",
};

const TYPE_LABEL: Record<string, string> = {
  ANNUEL:       "Congé annuel",
  MALADIE:      "Maladie",
  EXCEPTIONNEL: "Exceptionnel",
  PERMISSION:   "Permission",
  FORMATION:    "Formation",
  MATERNITE:    "Maternité",
  PATERNITE:    "Paternité",
  SANS_SOLDE:   "Sans solde",
};

const TYPE_COLOR: Record<string, string> = {
  ANNUEL:       "bg-emerald-100 text-emerald-700",
  MALADIE:      "bg-red-100 text-red-700",
  EXCEPTIONNEL: "bg-purple-100 text-purple-700",
  PERMISSION:   "bg-amber-100 text-amber-700",
  FORMATION:    "bg-blue-100 text-blue-700",
  MATERNITE:    "bg-pink-100 text-pink-700",
  PATERNITE:    "bg-cyan-100 text-cyan-700",
  SANS_SOLDE:   "bg-gray-100 text-gray-600",
};

const TYPE_DOT: Record<string, string> = {
  ANNUEL:       "bg-emerald-400",
  MALADIE:      "bg-red-400",
  EXCEPTIONNEL: "bg-purple-400",
  PERMISSION:   "bg-amber-400",
  FORMATION:    "bg-blue-400",
  MATERNITE:    "bg-pink-400",
  PATERNITE:    "bg-cyan-400",
  SANS_SOLDE:   "bg-gray-400",
};

const NEXT_ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  EN_ATTENTE:     [
    { action: "VALIDER_MANAGER", label: "Valider (manager)", color: "bg-blue-600 hover:bg-blue-700" },
    { action: "APPROUVER",       label: "Approuver direct",  color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-500 hover:bg-red-600" },
  ],
  VALIDE_MANAGER: [
    { action: "VALIDER_RH",      label: "Valider (RH)",      color: "bg-indigo-600 hover:bg-indigo-700" },
    { action: "APPROUVER",       label: "Approuver direct",  color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-500 hover:bg-red-600" },
  ],
  VALIDE_RH:      [
    { action: "APPROUVER",       label: "Approuver",         color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-500 hover:bg-red-600" },
  ],
};

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_LABELS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function isoDate(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CongesPage() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<"demandes" | "calendrier" | "soldes">("demandes");

  // Demandes tab state
  const [searchInput,    setSearchInput]    = useState("");
  const [search,         setSearch]         = useState("");
  const [statut,         setStatut]         = useState("EN_ATTENTE");
  const [type,           setType]           = useState("");
  const [page,           setPage]           = useState(1);
  const [showPolitiques, setShowPolitiques] = useState(false);
  const [showCreate,     setShowCreate]     = useState(false);
  const [rejetId,        setRejetId]        = useState<number | null>(null);
  const [annulerTarget,  setAnnulerTarget]  = useState<Demande | null>(null);

  // Calendrier tab state
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth()); // 0-based

  // Soldes tab state
  const [soldesAnnee, setSoldesAnnee] = useState(today.getFullYear());
  const [soldesDept,  setSoldesDept]  = useState("");
  const [editSolde, setEditSolde] = useState<{ profilRHId: number; type: string; nom: string } | null>(null);

  const query = new URLSearchParams({
    page: String(page), limit: "20",
    ...(search && { search }),
    ...(statut && { statut }),
    ...(type   && { type }),
  }).toString();

  const { data: res, loading, refetch } = useApi<DemandesResponse>(`/api/admin/rh/conges?${query}`);
  const { data: politiquesRes } = useApi<{ data: Politique[] }>("/api/admin/rh/politiques-conges");

  // Calendrier
  const calParams = new URLSearchParams({ annee: String(calYear), mois: String(calMonth + 1) });
  const { data: calRes, loading: calLoading, refetch: calRefetch } = useApi<CalendrierResponse>(
    activeTab === "calendrier" ? `/api/admin/rh/conges/calendrier?${calParams}` : null
  );

  // Soldes
  const soldesParams = new URLSearchParams({ annee: String(soldesAnnee), ...(soldesDept && { departement: soldesDept }) });
  const { data: soldesRes, loading: soldesLoading, refetch: soldesRefetch } = useApi<{ data: SoldeLine[] }>(
    activeTab === "soldes" ? `/api/admin/rh/conges/soldes?${soldesParams}` : null
  );

  const handleSearch = useCallback(() => { setSearch(searchInput); setPage(1); }, [searchInput]);

  const stats    = res?.stats ?? {};
  const enAttente = (stats["EN_ATTENTE"] ?? 0) + (stats["VALIDE_MANAGER"] ?? 0) + (stats["VALIDE_RH"] ?? 0);

  const prevCalMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextCalMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Congés & Absences</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestion des demandes, validation et soldes</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPolitiques(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <Settings className="w-4 h-4" /> Politiques
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Nouvelle demande
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />}   label="En attente" value={enAttente}             bg="bg-amber-50"   onClick={() => { setActiveTab("demandes"); setStatut("EN_ATTENTE"); }} />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} label="Approuvés" value={stats["APPROUVE"] ?? 0} bg="bg-emerald-50" onClick={() => { setActiveTab("demandes"); setStatut("APPROUVE"); }} />
          <StatCard icon={<CalendarDays className="w-5 h-5 text-blue-600" />} label="En cours auj." value={stats["enCours"] ?? 0} bg="bg-blue-50"  onClick={() => setActiveTab("calendrier")} />
          <StatCard icon={<XCircle className="w-5 h-5 text-red-500" />}   label="Rejetés"    value={stats["REJETE"] ?? 0}   bg="bg-red-50"     onClick={() => { setActiveTab("demandes"); setStatut("REJETE"); }} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            ["demandes",   CalendarDays, "Demandes"],
            ["calendrier", CalendarDays, "Calendrier"],
            ["soldes",     Wallet,       "Soldes"],
          ] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              <Icon className="w-4 h-4" /> {label}
              {tab === "demandes" && enAttente > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{enAttente}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB : DEMANDES ── */}
        {activeTab === "demandes" && (
          <>
            {/* Filtres */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <div className="flex-1 min-w-[200px] flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Nom du collaborateur…"
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <button onClick={handleSearch} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                <option value="">Tous les statuts</option>
                {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                <option value="">Tous les types</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Filter className="w-4 h-4" /> {res?.meta.total ?? 0}
                </span>
                <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Liste */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
                </div>
              ) : !res?.data.length ? (
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
                  <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucune demande trouvée</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-4 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    Créer une demande
                  </button>
                </div>
              ) : (
                res.data.map((d) => (
                  <DemandeCard key={d.id} demande={d}
                    onAction={(action) => {
                      if (action === "REJETER") { setRejetId(d.id); return; }
                      if (action === "ANNULER") { setAnnulerTarget(d); return; }
                      handleAction(d.id, action, undefined, refetch);
                    }}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {res && res.meta.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Page {res.meta.page} / {res.meta.totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                    Précédent
                  </button>
                  <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB : CALENDRIER ── */}
        {activeTab === "calendrier" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Navigation mois */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <button onClick={prevCalMonth} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-base font-semibold text-slate-700">{MOIS_LABELS[calMonth]} {calYear}</span>
                <button onClick={nextCalMonth} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={calRefetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  {calLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
              {/* Légende types */}
              <div className="hidden sm:flex flex-wrap gap-2">
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${TYPE_DOT[k]}`} />{v}
                  </span>
                ))}
              </div>
            </div>

            {calLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {JOURS_LABELS.map((j) => (
                    <div key={j} className="text-center text-[10px] font-semibold text-slate-400 py-1">{j}</div>
                  ))}
                </div>
                {(() => {
                  const byDay = calRes?.byDay ?? {};
                  const days  = daysInMonth(calYear, calMonth);
                  const firstDow = new Date(calYear, calMonth, 1).getDay();
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e-${i}`} />);
                  for (let d = 1; d <= days; d++) {
                    const dateStr = isoDate(calYear, calMonth, d);
                    const absents = byDay[dateStr] ?? [];
                    const dow     = new Date(calYear, calMonth, d).getDay();
                    const isWE    = dow === 0 || dow === 6;
                    const isToday = dateStr === new Date().toISOString().slice(0, 10);
                    cells.push(
                      <div key={d} className={`min-h-[80px] rounded-lg border p-1.5 ${
                        isToday ? "border-emerald-400 bg-emerald-50/50" :
                        isWE    ? "border-slate-100 bg-slate-50/50" :
                        "border-slate-100 bg-white"
                      }`}>
                        <p className={`text-xs font-semibold mb-1 ${isToday ? "text-emerald-600" : isWE ? "text-slate-300" : "text-slate-500"}`}>{d}</p>
                        <div className="space-y-0.5">
                          {absents.slice(0, 3).map((a, i) => (
                            <div key={i} className={`text-[9px] px-1 py-0.5 rounded truncate flex items-center gap-1 ${TYPE_COLOR[a.type] ?? "bg-gray-100 text-gray-600"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[a.type]}`} />
                              {a.prenom} {a.nom[0]}.
                            </div>
                          ))}
                          {absents.length > 3 && (
                            <p className="text-[9px] text-slate-400 pl-1">+{absents.length - 3} autres</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── TAB : SOLDES ── */}
        {activeTab === "soldes" && (
          <>
            {/* Filtres */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
              <select value={soldesAnnee} onChange={(e) => setSoldesAnnee(Number(e.target.value))}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <input value={soldesDept} onChange={(e) => setSoldesDept(e.target.value)}
                placeholder="Filtrer par département…"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52" />
              <button onClick={soldesRefetch} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                {soldesLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  const rows = (soldesRes?.data ?? []).map((line) => {
                    const row: Record<string, string | number> = {
                      Collaborateur: `${line.profilRH.prenom} ${line.profilRH.nom}`,
                      Matricule: line.profilRH.matricule,
                      Departement: line.profilRH.departement ?? "",
                    };
                    Object.keys(TYPE_LABEL).forEach((t) => {
                      const s = line.soldes.find((x) => x.type === t);
                      row[TYPE_LABEL[t]] = s ? s.restant : "";
                    });
                    return row;
                  });
                  exportToXlsx(
                    rows,
                    [
                      { label: "Collaborateur", key: "Collaborateur" },
                      { label: "Matricule", key: "Matricule" },
                      { label: "Département", key: "Departement" },
                      ...Object.values(TYPE_LABEL).map((label) => ({ label, key: label, type: "number" as const })),
                    ],
                    `suivi-conges-${soldesAnnee}.xlsx`,
                    { sheetName: "Soldes congés", title: `Suivi des congés — ${soldesAnnee}` },
                  );
                }}
                disabled={!soldesRes?.data.length}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Exporter
              </button>
              <span className="text-xs text-slate-400 ml-auto italic">Cliquez sur un solde pour l&apos;ajuster</span>
            </div>

            {soldesLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : !soldesRes?.data.length ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
                <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun collaborateur</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs sticky left-0 bg-slate-50">Collaborateur</th>
                        {Object.keys(TYPE_LABEL).map((t) => (
                          <th key={t} className="text-center px-3 py-3 text-xs">
                            <span className={`px-1.5 py-0.5 rounded-full font-semibold ${TYPE_COLOR[t]}`}>{TYPE_LABEL[t].split(" ")[0]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {soldesRes.data.map((line) => (
                        <tr key={line.profilRH.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 sticky left-0 bg-white hover:bg-slate-50">
                            <p className="font-medium text-slate-800">{line.profilRH.prenom} {line.profilRH.nom}</p>
                            <p className="text-xs text-slate-400 font-mono">{line.profilRH.matricule}</p>
                            {line.profilRH.departement && <p className="text-xs text-slate-400">{line.profilRH.departement}</p>}
                          </td>
                          {Object.keys(TYPE_LABEL).map((t) => {
                            const s = line.soldes.find((x) => x.type === t);
                            if (!s) return <td key={t} className="text-center px-3 py-3 text-xs text-slate-300">—</td>;
                            const alert = s.restant < 0;
                            return (
                              <td key={t} className="text-center px-3 py-3">
                                <button
                                  onClick={() => setEditSolde({ profilRHId: line.profilRH.id, type: t, nom: `${line.profilRH.prenom} ${line.profilRH.nom}` })}
                                  className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors hover:ring-2 ring-emerald-300 ${
                                    alert ? "text-red-600 bg-red-50" : s.restant === 0 ? "text-slate-400 bg-slate-50" : "text-slate-700 bg-slate-100"
                                  }`}
                                  title={`${s.pris}j pris / ${s.totalDroit + s.reporte}j droit`}
                                >
                                  {s.restant}j
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Modal Politiques */}
      {showPolitiques && (
        <PolitiquesModal politiques={politiquesRes?.data ?? []} onClose={() => setShowPolitiques(false)} />
      )}

      {/* Modal Nouvelle demande */}
      {showCreate && (
        <NouvelleDemandeModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}

      {/* Modal Rejet */}
      {rejetId !== null && (
        <RejetModal demandeId={rejetId} onClose={() => setRejetId(null)} onRejeted={() => { setRejetId(null); refetch(); }} />
      )}

      {/* Modal Annuler */}
      {annulerTarget && (
        <AnnulerModal demande={annulerTarget} onClose={() => setAnnulerTarget(null)} onDone={() => { setAnnulerTarget(null); refetch(); }} />
      )}

      {/* Modal Ajuster solde */}
      {editSolde && (
        <AjusterSoldeModal
          profilRHId={editSolde.profilRHId}
          type={editSolde.type}
          nom={editSolde.nom}
          annee={soldesAnnee}
          currentSolde={soldesRes?.data.find((l) => l.profilRH.id === editSolde.profilRHId)?.soldes.find((s) => s.type === editSolde.type)}
          onClose={() => setEditSolde(null)}
          onSaved={() => { setEditSolde(null); soldesRefetch(); }}
        />
      )}
    </div>
  );
}

// ── DemandeCard ───────────────────────────────────────────────────────────────

function DemandeCard({ demande, onAction }: { demande: Demande; onAction: (action: string) => void }) {
  const actions = NEXT_ACTIONS[demande.statut] ?? [];
  const canAnnuler = ["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH", "APPROUVE"].includes(demande.statut);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {demande.profilRH.gestionnaire.member.prenom[0]}{demande.profilRH.gestionnaire.member.nom[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/dashboard/admin/rh/collaborateurs/${demande.profilRH.id}`}
              className="flex items-center gap-1 font-semibold text-slate-800 hover:text-emerald-600">
              <User className="w-3.5 h-3.5" />
              {demande.profilRH.gestionnaire.member.prenom} {demande.profilRH.gestionnaire.member.nom}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="font-mono text-xs text-slate-400">{demande.profilRH.matricule}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOR[demande.type] ?? "bg-gray-100 text-gray-600"}`}>
              {TYPE_LABEL[demande.type] ?? demande.type}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[demande.statut] ?? "bg-gray-100 text-gray-500"}`}>
              {STATUT_LABEL[demande.statut] ?? demande.statut}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDate(demande.dateDebut)} → {formatDate(demande.dateFin)}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {demande.nbJours} jour{demande.nbJours > 1 ? "s" : ""}
            </span>
          </div>
          {demande.motif && <p className="text-xs text-slate-500 mt-1 italic">{demande.motif}</p>}
          {demande.commentaireRefus && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {demande.commentaireRefus}
            </div>
          )}
        </div>
        <div className="text-xs text-slate-400 flex-shrink-0">{formatDate(demande.createdAt)}</div>
      </div>

      {(actions.length > 0 || canAnnuler) && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
          {actions.map((a) => (
            <button key={a.action} onClick={() => onAction(a.action)}
              className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${a.color}`}>
              {a.label}
            </button>
          ))}
          {canAnnuler && (
            <button onClick={() => onAction("ANNULER")}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1">
              <Ban className="w-3 h-3" /> Annuler
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Action handler ────────────────────────────────────────────────────────────

async function handleAction(id: number, action: string, commentaire: string | undefined, refetch: () => void) {
  try {
    const res = await fetch(`/api/admin/rh/conges/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action, commentaire }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erreur"); return; }
    toast.success(
      action === "APPROUVER"       ? "Demande approuvée" :
      action === "REJETER"         ? "Demande rejetée"   :
      action === "VALIDER_MANAGER" ? "Validé (manager)"  :
      action === "VALIDER_RH"      ? "Validé (RH)"       : "Mis à jour"
    );
    refetch();
  } catch { toast.error("Erreur réseau"); }
}

// ── Modal Nouvelle demande ────────────────────────────────────────────────────

function NouvelleDemandeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { data: collabRes } = useApi<{ data: ProfilRH[] }>("/api/admin/rh/collaborateurs?limit=200");
  const collabs = collabRes?.data ?? [];

  const [profilRHId, setProfilRHId] = useState("");
  const [type,       setType]       = useState("ANNUEL");
  const [dateDebut,  setDateDebut]  = useState("");
  const [dateFin,    setDateFin]    = useState("");
  const [motif,      setMotif]      = useState("");
  const [statut,     setStatutD]    = useState("EN_ATTENTE");
  const [saving,     setSaving]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilRHId || !dateDebut || !dateFin) { toast.error("Champs requis manquants"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/rh/conges", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ profilRHId: Number(profilRHId), type, dateDebut, dateFin, motif: motif || null, statut }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Demande créée");
      onCreated();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Nouvelle demande de congé
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Créer une nouvelle demande pour un collaborateur
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5"
        >
          {/* Collaborateur */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Collaborateur
            </label>
            <select
              value={profilRHId}
              onChange={(e) => setProfilRHId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">
                — Sélectionner —
              </option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom}{" "}
                  {c.gestionnaire.member.nom} ({c.matricule})
                </option>
              ))}
            </select>
          </div>
          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Type de congé
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.entries(TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Date début
              </label>
              <input
                type="date"
                required
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Date fin
              </label>
              <input
                type="date"
                required
                min={dateDebut}
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          {/* Statut */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Statut initial
            </label>
            <select
              value={statut}
              onChange={(e) => setStatutD(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="EN_ATTENTE">
                En attente (workflow normal)
              </option>
              <option value="APPROUVE">
                Approuvé directement
              </option>
            </select>
          </div>
          {/* Motif */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Motif (optionnel)
            </label>
            <textarea
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Raison du congé..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </form>
        {/* Footer */}
        <div className="border-t border-slate-200 px-5 sm:px-6 py-4 bg-slate-50 flex flex-col-reverse sm:flex-row gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:flex-1 py-2.5 rounded-xl border border-slate-300 text-sm hover:bg-white transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full sm:flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Créer la demande
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Rejet ───────────────────────────────────────────────────────────────

function RejetModal({ demandeId, onClose, onRejeted }: { demandeId: number; onClose: () => void; onRejeted: () => void }) {
  const [commentaire, setCommentaire] = useState("");
  const { mutate, loading } = useMutation(`/api/admin/rh/conges/${demandeId}`, "PATCH");

  const handleRejet = async () => {
    const result = await mutate({ action: "REJETER", commentaire: commentaire || undefined });
    if (result) { toast.success("Demande rejetée"); onRejeted(); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Rejeter la demande</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Motif du rejet (optionnel)</label>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
            placeholder="Expliquer la raison du rejet…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleRejet} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Annuler ─────────────────────────────────────────────────────────────

function AnnulerModal({ demande, onClose, onDone }: { demande: Demande; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleAnnuler = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rh/conges/${demande.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "ANNULER" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Demande annulée");
      onDone();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-100 rounded-xl"><Ban className="w-5 h-5 text-slate-600" /></div>
          <h3 className="font-semibold text-slate-800">Annuler la demande ?</h3>
        </div>
        <p className="text-sm text-slate-600">
          {demande.profilRH.gestionnaire.member.prenom} {demande.profilRH.gestionnaire.member.nom} —{" "}
          <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLOR[demande.type]}`}>{TYPE_LABEL[demande.type]}</span>{" "}
          du {formatDate(demande.dateDebut)} au {formatDate(demande.dateFin)} ({demande.nbJours}j)
        </p>
        {demande.statut === "APPROUVE" && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            Cette demande est approuvée. Les jours seront restaurés dans le solde.
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Conserver
          </button>
          <button onClick={handleAnnuler} disabled={loading}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Annuler la demande
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Ajuster solde ────────────────────────────────────────────────────────

function AjusterSoldeModal({ profilRHId, type, nom, annee, currentSolde, onClose, onSaved }: {
  profilRHId:   number;
  type:         string;
  nom:          string;
  annee:        number;
  currentSolde: { totalDroit: number; pris: number; reporte: number; restant: number } | undefined;
  onClose:      () => void;
  onSaved:      () => void;
}) {
  const [totalDroit, setTotalDroit] = useState(String(currentSolde?.totalDroit ?? 0));
  const [reporte,    setReporte]    = useState(String(currentSolde?.reporte    ?? 0));
  const [saving,     setSaving]     = useState(false);

  const pris    = currentSolde?.pris ?? 0;
  const restant = Number(totalDroit) + Number(reporte) - pris;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/rh/conges/soldes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ profilRHId, type, annee, totalDroit: Number(totalDroit), reporte: Number(reporte) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Solde mis à jour");
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Ajuster le solde</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="text-sm text-slate-600">
          <span className="font-medium">{nom}</span> —{" "}
          <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</span>{" "}
          {annee}
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
          <div className="flex justify-between"><span>Jours pris</span><strong>{pris}j</strong></div>
          <div className="flex justify-between"><span>Solde restant calculé</span>
            <strong className={restant < 0 ? "text-red-600" : "text-emerald-600"}>{restant}j</strong>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Droit annuel (j)</label>
            <input type="number" min="0" value={totalDroit} onChange={(e) => setTotalDroit(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reportés (j)</label>
            <input type="number" min="0" value={reporte} onChange={(e) => setReporte(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Politiques ──────────────────────────────────────────────────────────

function PolitiquesModal({ politiques, onClose }: { politiques: Politique[]; onClose: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ joursParAn: "", reportable: false, joursMaxReport: "", description: "" });
  const { mutate, loading } = useMutation("/api/admin/rh/politiques-conges", "POST");

  const startEdit = (p: Politique) => {
    setEditing(p.type);
    setForm({ joursParAn: String(p.joursParAn), reportable: p.reportable, joursMaxReport: String(p.joursMaxReport), description: p.description ?? "" });
  };

  const handleSave = async () => {
    if (!editing) return;
    const result = await mutate({ type: editing, joursParAn: Number(form.joursParAn), reportable: form.reportable, joursMaxReport: Number(form.joursMaxReport), description: form.description || null });
    if (result) { toast.success("Politique mise à jour"); setEditing(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Politiques de congés</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {Object.keys(TYPE_LABEL).map((t) => {
            const p = politiques.find((pol) => pol.type === t);
            const isEditing = editing === t;
            return (
              <div key={t} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOR[t]}`}>{TYPE_LABEL[t]}</span>
                  {!isEditing && (
                    <button onClick={() => startEdit(p ?? { id: 0, type: t, joursParAn: 0, reportable: false, joursMaxReport: 0, description: null, actif: true })}
                      className="text-xs text-emerald-600 hover:underline">Modifier</button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Jours / an</label>
                        <input type="number" min={0} value={form.joursParAn}
                          onChange={(e) => setForm((f) => ({ ...f, joursParAn: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Jours max reportables</label>
                        <input type="number" min={0} value={form.joursMaxReport}
                          onChange={(e) => setForm((f) => ({ ...f, joursMaxReport: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={form.reportable} onChange={(e) => setForm((f) => ({ ...f, reportable: e.target.checked }))} className="rounded" />
                      Reportable sur l&apos;année suivante
                    </label>
                    <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Description optionnelle"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg">Annuler</button>
                      <button onClick={handleSave} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Enregistrer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span><strong>{p?.joursParAn ?? 0}</strong> j/an</span>
                    {p?.reportable && <span className="text-xs text-blue-600">Reportable ({p.joursMaxReport}j max)</span>}
                    {!p && <span className="text-xs text-slate-400 italic">Non configuré</span>}
                    {p?.description && <span className="text-xs text-slate-400">{p.description}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg, onClick }: {
  icon: React.ReactNode; label: string; value: number; bg: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 w-full text-left hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </button>
  );
}
