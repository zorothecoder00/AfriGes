"use client";

import React, { useState, useCallback } from "react";
import {
  Search, RefreshCw, Plus, X, Save, Star, CheckCircle, Clock,
  PlayCircle, Trash2, ChevronDown, ChevronUp, User, ArrowLeft,
  Target, TrendingUp, Award, FileText, ChevronRight,
  Users, UserCheck, BarChart2,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Critere   { id?: number; libelle: string; note: number; commentaire?: string }
interface ObjectifKPI {
  id:             number;
  libelle:        string;
  indicateur:     string | null;
  valeurCible:    number;
  valeurAtteinte: number | null;
  unite:          string | null;
  poids:          number | null;
  commentaire:    string | null;
}

interface ActionPDI {
  id:           number;
  objectif:     string;
  actionPrevue: string | null;
  echeance:     string | null;
  statut:       string;
  notes:        string | null;
}

interface Evaluation {
  id:               number;
  typeEvaluation:   string | null;
  periode:          string;
  annee:            number;
  statut:           string;
  noteGlobale:      number | null;
  appreciation:     string | null;
  pointsForts:      string | null;
  axesAmelioration: string | null;
  objectifsN1:      string | null;
  planAmelioration: string | null;
  dateDebut:        string;
  dateFin:          string | null;
  notes:            string | null;
  createdAt:        string;
  criteres:         Critere[];
  objectifs:        ObjectifKPI[];
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
  evaluateur: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
}

interface EvalResponse {
  data:        Evaluation[];
  meta:        { page: number; limit: number; total: number; totalPages: number };
  stats:       Record<string, number>;
  statsByType: Record<string, number>;
}
interface CollabsResponse { data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; step: number }> = {
  BROUILLON:         { label: "Brouillon",          badge: "bg-slate-100 text-slate-600",   icon: <Clock      className="w-3 h-3" />, step: 0 },
  OBJECTIFS_FIXES:   { label: "Objectifs fixés",    badge: "bg-blue-100 text-blue-700",     icon: <Target     className="w-3 h-3" />, step: 1 },
  EN_COURS:          { label: "En cours",            badge: "bg-amber-100 text-amber-700",   icon: <PlayCircle className="w-3 h-3" />, step: 2 },
  EVALUATION:        { label: "Évaluation",          badge: "bg-purple-100 text-purple-700", icon: <Star       className="w-3 h-3" />, step: 3 },
  VALIDATION:        { label: "Validation",          badge: "bg-orange-100 text-orange-700", icon: <UserCheck  className="w-3 h-3" />, step: 4 },
  PLAN_AMELIORATION: { label: "Plan d'amélioration", badge: "bg-indigo-100 text-indigo-700", icon: <FileText   className="w-3 h-3" />, step: 5 },
  CLOTURE:           { label: "Clôturée",            badge: "bg-emerald-100 text-emerald-700",icon:<CheckCircle className="w-3 h-3" />, step: 6 },
};

const STATUT_ACTION_CONFIG: Record<string, { label: string; badge: string }> = {
  A_FAIRE:  { label: "À faire",   badge: "bg-slate-100 text-slate-600" },
  EN_COURS: { label: "En cours",  badge: "bg-amber-100 text-amber-700" },
  REALISE:  { label: "Réalisée",  badge: "bg-emerald-100 text-emerald-700" },
  ANNULE:   { label: "Annulée",   badge: "bg-red-100 text-red-500" },
};
const CYCLE_STATUT_ACTION: Record<string, string> = {
  A_FAIRE: "EN_COURS", EN_COURS: "REALISE", REALISE: "A_FAIRE", ANNULE: "A_FAIRE",
};

const CYCLE_STEPS = [
  { key: "BROUILLON",         label: "Brouillon"    },
  { key: "OBJECTIFS_FIXES",   label: "Objectifs"    },
  { key: "EN_COURS",          label: "Suivi"        },
  { key: "EVALUATION",        label: "Évaluation"   },
  { key: "VALIDATION",        label: "Validation"   },
  { key: "PLAN_AMELIORATION", label: "Plan"         },
  { key: "CLOTURE",           label: "Clôturé"      },
];

const WORKFLOW_ACTIONS: Record<string, { action: string; label: string; cls: string }[]> = {
  BROUILLON:         [
    { action: "FIXER_OBJECTIFS", label: "Fixer les objectifs", cls: "text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100" },
    { action: "DEMARRER",        label: "Démarrer directement", cls: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100" },
  ],
  OBJECTIFS_FIXES:   [{ action: "DEMARRER",             label: "Démarrer le suivi",    cls: "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100" }],
  EN_COURS:          [{ action: "EVALUER",               label: "Passer en évaluation", cls: "text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100" }],
  EVALUATION:        [{ action: "SOUMETTRE_VALIDATION",  label: "Soumettre validation", cls: "text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100" }],
  VALIDATION:        [{ action: "VALIDER",               label: "Valider → Plan",       cls: "text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100" }],
  PLAN_AMELIORATION: [{ action: "CLOTURER",              label: "Clôturer",             cls: "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" }],
  CLOTURE:           [{ action: "REUVRIR",               label: "Rouvrir",              cls: "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100" }],
};

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  HIERARCHIQUE:    { label: "Hiérarchique",   badge: "bg-sky-100 text-sky-700",    icon: <User      className="w-3 h-3" /> },
  AUTO_EVALUATION: { label: "Auto-évaluation",badge: "bg-violet-100 text-violet-700",icon: <Users   className="w-3 h-3" /> },
  EVALUATION_360:  { label: "Évaluation 360°",badge: "bg-teal-100 text-teal-700",  icon: <BarChart2 className="w-3 h-3" /> },
};

const PERIODE_LABEL: Record<string, string> = {
  ANNUELLE: "Annuelle", SEMESTRIELLE: "Semestrielle", TRIMESTRIELLE: "Trimestrielle", PROBATOIRE: "Probatoire",
};

const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES         = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i);

const CRITERES_DEFAUT = [
  "Qualité du travail", "Productivité", "Ponctualité & présence",
  "Travail en équipe", "Initiative & autonomie",
];

// ── Composants utilitaires ─────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`w-4 h-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function CycleIndicator({ statut }: { statut: string }) {
  const currentStep = STATUT_CONFIG[statut]?.step ?? 0;
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {CYCLE_STEPS.map((s, i) => {
        const step    = STATUT_CONFIG[s.key]?.step ?? i;
        const done    = step < currentStep;
        const active  = s.key === statut;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex flex-col items-center gap-0.5 min-w-0 flex-shrink-0 ${active ? "" : ""}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                active ? "bg-indigo-600 text-white ring-2 ring-indigo-300" :
                done   ? "bg-emerald-500 text-white" :
                         "bg-slate-200 text-slate-400"
              }`}>
                {done ? "✓" : step + 1}
              </div>
              <span className={`text-[10px] leading-tight text-center ${active ? "text-indigo-700 font-semibold" : done ? "text-emerald-600" : "text-slate-400"}`}>
                {s.label}
              </span>
            </div>
            {i < CYCLE_STEPS.length - 1 && (
              <div className={`h-0.5 w-4 flex-shrink-0 ${step < currentStep ? "bg-emerald-400" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function KpiProgressBar({ kpi }: { kpi: ObjectifKPI }) {
  const pct = kpi.valeurAtteinte !== null && kpi.valeurCible > 0
    ? Math.min(100, Math.round((kpi.valeurAtteinte / kpi.valeurCible) * 100))
    : null;
  const color = pct === null ? "bg-slate-300" : pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: pct !== null ? `${pct}%` : "0%" }} />
      </div>
      <span className="text-xs text-slate-500 w-10 text-right flex-shrink-0">
        {pct !== null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState<"liste" | "kpis" | "synthese">("liste");
  const [statut,    setStatut]    = useState("");
  const [typeEval,  setTypeEval]  = useState("");
  const [periode,   setPeriode]   = useState("");
  const [annee,     setAnnee]     = useState(String(ANNEE_COURANTE));
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [showCreate,  setShowCreate]  = useState(false);
  const [selected,    setSelected]    = useState<Evaluation | null>(null);

  const params = new URLSearchParams();
  if (statut)   params.set("statut",  statut);
  if (typeEval) params.set("type",    typeEval);
  if (periode)  params.set("periode", periode);
  if (annee)    params.set("annee",   annee);
  if (search)   params.set("search",  search);
  params.set("page", String(page)); params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<EvalResponse>(`/api/admin/rh/evaluations?${params}`);
  const evaluations = res?.data        ?? [];
  const meta        = res?.meta;
  const stats       = res?.stats       ?? {};
  const statsByType = res?.statsByType ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  // KPIs tab : toutes les évals EN_COURS/EVALUATION/VALIDATION/PLAN/CLOTURE
  const kpiParams = new URLSearchParams();
  if (annee) kpiParams.set("annee", annee);
  kpiParams.set("limit", "100");
  const { data: kpiRes } = useApi<EvalResponse>(activeTab === "kpis" ? `/api/admin/rh/evaluations?${kpiParams}` : null);
  const kpiEvals = (kpiRes?.data ?? []).filter((e) => e.objectifs.length > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Évaluations de performance</h1>
            <p className="text-sm text-slate-500 mt-0.5">Cycle KPI · Hiérarchique · Auto-évaluation · 360°</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Nouvelle évaluation
            </button>
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {[
            { key: "liste",   label: "Évaluations",     icon: <Star     className="w-3.5 h-3.5" /> },
            { key: "kpis",    label: "Suivi KPIs",      icon: <Target   className="w-3.5 h-3.5" /> },
            { key: "synthese",label: "Synthèse",         icon: <BarChart2 className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ══════════════════ TAB : LISTE ══════════════════ */}
        {activeTab === "liste" && (
          <>
            {/* Stats statut */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
                  className={`p-3 rounded-xl border text-left transition-all ${statut === key ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md w-fit mb-1.5 ${cfg.badge}`}>{cfg.icon}</div>
                  <p className="text-xl font-bold text-slate-900">{stats[key] ?? 0}</p>
                  <p className="text-[11px] text-slate-500 leading-tight">{cfg.label}</p>
                </button>
              ))}
            </div>

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Rechercher un collaborateur…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <select value={typeEval} onChange={(e) => { setTypeEval(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Toutes méthodes</option>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value={periode} onChange={(e) => { setPeriode(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Toutes périodes</option>
                {Object.entries(PERIODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <select value={annee} onChange={(e) => { setAnnee(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Toutes années</option>
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Liste */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : evaluations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Star className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune évaluation trouvée</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {evaluations.map((e) => (
                    <EvalRow key={e.id} eval_={e}
                      onOpen={() => setSelected(e)}
                      onRefetch={() => { refetch(); setSelected(null); }} />
                  ))}
                </div>
              </div>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{meta.total} évaluations</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
                  <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
                  <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ TAB : SUIVI KPIs ══════════════════ */}
        {activeTab === "kpis" && (
          <>
            <div className="flex items-center gap-3">
              <select value={annee} onChange={(e) => setAnnee(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <p className="text-sm text-slate-500">{kpiEvals.reduce((s, e) => s + e.objectifs.length, 0)} objectifs KPI suivis</p>
            </div>

            {kpiEvals.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Target className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun objectif KPI défini pour cette période</p>
              </div>
            ) : (
              <div className="space-y-4">
                {kpiEvals.map((e) => {
                  const m    = e.profilRH.gestionnaire.member;
                  const cfg  = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG.BROUILLON;
                  const tcfg = e.typeEvaluation ? TYPE_CONFIG[e.typeEvaluation] : null;
                  const avgPct = e.objectifs.filter((k) => k.valeurAtteinte !== null && k.valeurCible > 0).length > 0
                    ? Math.round(e.objectifs.filter((k) => k.valeurAtteinte !== null && k.valeurCible > 0)
                        .reduce((s, k) => s + (k.valeurAtteinte! / k.valeurCible) * 100, 0)
                      / e.objectifs.filter((k) => k.valeurAtteinte !== null && k.valeurCible > 0).length)
                    : null;
                  return (
                    <div key={e.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                          {m.prenom[0]}{m.nom[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{m.prenom} {m.nom}</span>
                            <span className="text-xs text-slate-400 font-mono">{e.profilRH.matricule}</span>
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                            {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
                            <span className="text-xs text-slate-400">{PERIODE_LABEL[e.periode] ?? e.periode} {e.annee}</span>
                          </div>
                        </div>
                        {avgPct !== null && (
                          <div className={`px-3 py-1 rounded-lg text-sm font-bold ${avgPct >= 100 ? "bg-emerald-100 text-emerald-700" : avgPct >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            {avgPct}% moy.
                          </div>
                        )}
                        <button onClick={() => setSelected(e)}
                          className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                          Détail <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {e.objectifs.map((kpi) => {
                          const pct = kpi.valeurAtteinte !== null && kpi.valeurCible > 0
                            ? Math.min(100, Math.round((kpi.valeurAtteinte / kpi.valeurCible) * 100)) : null;
                          return (
                            <div key={kpi.id} className="flex items-center gap-4 px-5 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-700 font-medium">{kpi.libelle}</p>
                                {kpi.indicateur && <p className="text-xs text-slate-400">{kpi.indicateur}</p>}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-slate-500">
                                  {kpi.valeurAtteinte !== null ? Number(kpi.valeurAtteinte).toLocaleString() : "—"}
                                  {" / "}{Number(kpi.valeurCible).toLocaleString()}
                                  {kpi.unite ? ` ${kpi.unite}` : ""}
                                </span>
                                {kpi.poids !== null && (
                                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                    {kpi.poids}%
                                  </span>
                                )}
                              </div>
                              <div className="w-32">
                                <KpiProgressBar kpi={kpi} />
                              </div>
                              <div className={`w-10 text-right text-xs font-bold ${pct === null ? "text-slate-400" : pct >= 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-500"}`}>
                                {pct !== null ? `${pct}%` : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══════════════════ TAB : SYNTHÈSE ══════════════════ */}
        {activeTab === "synthese" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Par méthode */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-indigo-500" /> Répartition par méthode
                </h3>
                <div className="space-y-3">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const count = statsByType[key] ?? 0;
                    const total = Object.values(statsByType).reduce((a, b) => a + b, 0) || 1;
                    const pct   = Math.round((count / total) * 100);
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="text-sm font-bold text-slate-700">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {Object.values(statsByType).every((v) => v === 0) && (
                    <p className="text-sm text-slate-400 text-center py-4">Aucune donnée</p>
                  )}
                </div>
              </div>

              {/* Par statut */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Répartition par statut du cycle
                </h3>
                <div className="space-y-3">
                  {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
                    const count = stats[key] ?? 0;
                    const total = Object.values(stats).reduce((a, b) => a + b, 0) || 1;
                    const pct   = Math.round((count / total) * 100);
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="text-sm font-bold text-slate-700">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Conseil méthodes */}
              <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-indigo-800 mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Guide des méthodes d&apos;évaluation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG.HIERARCHIQUE.badge}`}>
                        {TYPE_CONFIG.HIERARCHIQUE.icon} Hiérarchique
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Évaluation réalisée par le supérieur direct. Mesure l&apos;atteinte des objectifs fixés, les compétences métier et le comportement professionnel.</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG.AUTO_EVALUATION.badge}`}>
                        {TYPE_CONFIG.AUTO_EVALUATION.icon} Auto-évaluation
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Le collaborateur évalue lui-même ses performances. Favorise l&apos;introspection et le dialogue lors de l&apos;entretien annuel.</p>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG.EVALUATION_360.badge}`}>
                        {TYPE_CONFIG.EVALUATION_360.icon} 360°
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">Évaluation multi-sources : supérieur, collègues, subordonnés. Vision globale et objective des comportements et soft skills.</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateEvalModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
      {selected && (
        <EvalDetailModal
          eval_={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { refetch(); setSelected(null); }} />
      )}
    </div>
  );
}

// ── Ligne évaluation ───────────────────────────────────────────────────────────

function EvalRow({ eval_: e, onOpen, onRefetch }: { eval_: Evaluation; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/evaluations/${e.id}`, "PATCH");
  const cfg    = STATUT_CONFIG[e.statut]  ?? STATUT_CONFIG.BROUILLON;
  const tcfg   = e.typeEvaluation ? TYPE_CONFIG[e.typeEvaluation] : null;
  const member = e.profilRH.gestionnaire.member;
  const noteMoy = e.criteres.length > 0 ? (e.criteres.reduce((s, c) => s + Number(c.note), 0) / e.criteres.length) : null;
  const actions = WORKFLOW_ACTIONS[e.statut] ?? [];

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${e.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-indigo-600">
            {member.prenom} {member.nom}
          </Link>
          <span className="text-xs text-slate-400 font-mono">{e.profilRH.matricule}</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
          {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{PERIODE_LABEL[e.periode] ?? e.periode} {e.annee}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          {noteMoy !== null && <><StarRating value={Math.round(noteMoy)} /><span className="font-semibold text-slate-700">{noteMoy.toFixed(1)}/5</span></>}
          {e.objectifs.length > 0 && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{e.objectifs.length} KPI</span>}
          <span>{formatDate(e.dateDebut)}</span>
          {e.evaluateur && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {e.evaluateur.gestionnaire?.member.prenom} {e.evaluateur.gestionnaire?.member.nom}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {actions.map(({ action, label, cls }) => (
          <button key={action} onClick={async () => {
            const r = await mutate({ action });
            if (r) { toast.success("Statut mis à jour"); onRefetch(); }
          }} disabled={loading}
            className={`px-3 py-1.5 text-xs font-medium border rounded-lg disabled:opacity-50 ${cls}`}>
            {label}
          </button>
        ))}
        <button onClick={onOpen} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
          Détail
        </button>
      </div>
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateEvalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/evaluations", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", typeEvaluation: "HIERARCHIQUE", periode: "ANNUELLE",
    annee: String(ANNEE_COURANTE), dateDebut: new Date().toISOString().slice(0, 10), dateFin: "",
  });
  const [criteres, setCriteres]     = useState<Critere[]>(CRITERES_DEFAUT.map((l) => ({ libelle: l, note: 3 })));
  const [showCriteres, setShowCriteres] = useState(true);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId) { toast.error("Sélectionner un collaborateur"); return; }
    const result = await mutate({
      profilRHId:     Number(form.profilRHId),
      typeEvaluation: form.typeEvaluation || null,
      periode:        form.periode,
      annee:          Number(form.annee),
      dateDebut:      form.dateDebut,
      dateFin:        form.dateFin || null,
      criteres:       criteres.filter((c) => c.libelle.trim()),
    });
    if (result) { toast.success("Évaluation créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle évaluation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <EField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>
              ))}
            </select>
          </EField>

          <EField label="Méthode d'évaluation">
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => set("typeEvaluation", k)}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm transition-all ${
                    form.typeEvaluation === k ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </EField>

          <div className="grid grid-cols-3 gap-3">
            <EField label="Période *">
              <select value={form.periode} onChange={(e) => set("periode", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {Object.entries(PERIODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </EField>
            <EField label="Année *">
              <select value={form.annee} onChange={(e) => set("annee", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </EField>
            <EField label="Date début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </EField>
          </div>

          {/* Critères */}
          <div>
            <button onClick={() => setShowCriteres((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              {showCriteres ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Critères de notation ({criteres.length})
            </button>
            {showCriteres && (
              <div className="space-y-2 p-4 bg-slate-50 rounded-xl">
                {criteres.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {c.libelle ? (
                      <span className="flex-1 text-sm text-slate-700">{c.libelle}</span>
                    ) : (
                      <input value={c.libelle}
                        onChange={(e) => setCriteres((prev) => prev.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x))}
                        placeholder="Libellé du critère…"
                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    )}
                    <StarRating value={c.note} onChange={(v) => setCriteres((prev) => prev.map((x, j) => j === i ? { ...x, note: v } : x))} />
                    <button onClick={() => setCriteres((prev) => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setCriteres((prev) => [...prev, { libelle: "", note: 3 }])}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter un critère
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Actions PDI structurées ──────────────────────────────────────────────────

function ActionsPDISection({ evaluationId, canEdit }: { evaluationId: number; canEdit: boolean }) {
  const { data, loading, refetch } = useApi<{ data: ActionPDI[] }>(`/api/admin/rh/evaluations/${evaluationId}/actions`);
  const actions = data?.data ?? [];
  const { mutate: create, loading: creating } = useMutation(`/api/admin/rh/evaluations/${evaluationId}/actions`, "POST");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ objectif: "", actionPrevue: "", echeance: "" });

  const handleAdd = async () => {
    if (!form.objectif.trim()) { toast.error("Objectif requis"); return; }
    const result = await create({
      objectif: form.objectif.trim(),
      actionPrevue: form.actionPrevue || undefined,
      echeance: form.echeance || undefined,
    });
    if (result) {
      toast.success("Action ajoutée");
      setForm({ objectif: "", actionPrevue: "", echeance: "" });
      setShowAdd(false);
      refetch();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Actions PDI structurées</p>
        {canEdit && !showAdd && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            <Plus className="w-3.5 h-3.5" /> Ajouter une action
          </button>
        )}
      </div>

      {showAdd && (
        <div className="p-3 bg-slate-50 rounded-xl space-y-2">
          <input value={form.objectif} onChange={(e) => setForm((f) => ({ ...f, objectif: e.target.value }))}
            placeholder="Objectif de développement…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <input value={form.actionPrevue} onChange={(e) => setForm((f) => ({ ...f, actionPrevue: e.target.value }))}
            placeholder="Action prévue (formation, accompagnement…)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          <div className="flex items-center gap-2">
            <input type="date" value={form.echeance} onChange={(e) => setForm((f) => ({ ...f, echeance: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            <button onClick={() => setShowAdd(false)} className="ml-auto px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button onClick={handleAdd} disabled={creating}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin" /></div>
      ) : actions.length === 0 ? (
        !showAdd && <p className="text-xs text-slate-400 py-2">Aucune action structurée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {actions.map((a) => (
            <ActionPDIRow key={a.id} action={a} evaluationId={evaluationId} canEdit={canEdit} onChanged={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionPDIRow({ action: a, evaluationId, canEdit, onChanged }: {
  action: ActionPDI; evaluationId: number; canEdit: boolean; onChanged: () => void;
}) {
  const { mutate: update } = useMutation(`/api/admin/rh/evaluations/${evaluationId}/actions/${a.id}`, "PATCH");
  const { mutate: remove }  = useMutation(`/api/admin/rh/evaluations/${evaluationId}/actions/${a.id}`, "DELETE");
  const cfg = STATUT_ACTION_CONFIG[a.statut] ?? STATUT_ACTION_CONFIG.A_FAIRE;

  const cycleStatut = async () => {
    const result = await update({ statut: CYCLE_STATUT_ACTION[a.statut] ?? "A_FAIRE" });
    if (result) onChanged();
  };
  const handleDelete = async () => {
    const result = await remove({});
    if (result) { toast.success("Action supprimée"); onChanged(); }
  };

  return (
    <div className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 font-medium">{a.objectif}</p>
        {a.actionPrevue && <p className="text-xs text-slate-500 mt-0.5">{a.actionPrevue}</p>}
        {a.echeance && <p className="text-xs text-slate-400 mt-0.5">Échéance : {formatDate(a.echeance)}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button disabled={!canEdit} onClick={cycleStatut}
          className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.badge} ${canEdit ? "hover:opacity-80" : "opacity-70 cursor-default"}`}>
          {cfg.label}
        </button>
        {canEdit && (
          <button onClick={handleDelete} className="text-slate-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  );
}

// ── Modal détail ───────────────────────────────────────────────────────────────

function EvalDetailModal({ eval_: e, onClose, onUpdated }: { eval_: Evaluation; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/evaluations/${e.id}`, "PATCH");
  const [subTab, setSubTab] = useState<"synthese" | "kpis" | "plan">("synthese");

  // Synthèse state
  const [criteres,  setCriteres]  = useState<Critere[]>(e.criteres.map((c) => ({ ...c, note: Number(c.note) })));
  const [form, setForm] = useState({
    appreciation:     e.appreciation     ?? "",
    pointsForts:      e.pointsForts      ?? "",
    axesAmelioration: e.axesAmelioration ?? "",
    objectifsN1:      e.objectifsN1      ?? "",
    noteGlobale:      e.noteGlobale !== null ? String(e.noteGlobale) : "",
  });
  const [editMode, setEditMode] = useState(false);

  // Plan d'amélioration
  const [plan,     setPlan]     = useState(e.planAmelioration ?? "");
  const [editPlan, setEditPlan] = useState(false);

  // KPIs state
  const [kpis,        setKpis]        = useState<ObjectifKPI[]>(e.objectifs ?? []);
  const [showAddKpi,  setShowAddKpi]  = useState(false);
  const [kpiForm,     setKpiForm]     = useState({ libelle: "", indicateur: "", valeurCible: "", unite: "", poids: "" });
  const [editingKpi,  setEditingKpi]  = useState<number | null>(null);
  const [kpiAtteinte, setKpiAtteinte] = useState<Record<number, string>>({});
  const [savingKpi,   setSavingKpi]   = useState(false);

  const cfg    = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG.BROUILLON;
  const tcfg   = e.typeEvaluation ? TYPE_CONFIG[e.typeEvaluation] : null;
  const m      = e.profilRH.gestionnaire.member;
  const noteMoy = criteres.length > 0 ? criteres.reduce((s, c) => s + c.note, 0) / criteres.length : null;
  const actions = WORKFLOW_ACTIONS[e.statut] ?? [];
  const canEdit = e.statut !== "CLOTURE";

  const handleSaveSynthese = async () => {
    const result = await mutate({
      noteGlobale:      form.noteGlobale ? Number(form.noteGlobale) : (noteMoy ? Math.round(noteMoy * 10) / 10 : null),
      appreciation:     form.appreciation     || null,
      pointsForts:      form.pointsForts      || null,
      axesAmelioration: form.axesAmelioration || null,
      objectifsN1:      form.objectifsN1      || null,
      criteres:         criteres.map((c) => ({ libelle: c.libelle, note: c.note, commentaire: c.commentaire ?? null })),
    });
    if (result) { toast.success("Synthèse enregistrée"); setEditMode(false); onUpdated(); }
  };

  const handleSavePlan = async () => {
    const result = await mutate({ planAmelioration: plan || null });
    if (result) { toast.success("Plan d'amélioration enregistré"); setEditPlan(false); onUpdated(); }
  };

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onUpdated(); }
  };

  const handleAddKpi = async () => {
    if (!kpiForm.libelle || !kpiForm.valeurCible) { toast.error("Libellé et valeur cible requis"); return; }
    setSavingKpi(true);
    try {
      const res = await fetch(`/api/admin/rh/evaluations/${e.id}/objectifs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libelle:     kpiForm.libelle,
          indicateur:  kpiForm.indicateur || null,
          valeurCible: Number(kpiForm.valeurCible),
          unite:       kpiForm.unite || null,
          poids:       kpiForm.poids ? Number(kpiForm.poids) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setKpis((prev) => [...prev, data.data]);
      setKpiForm({ libelle: "", indicateur: "", valeurCible: "", unite: "", poids: "" });
      setShowAddKpi(false);
      toast.success("KPI ajouté");
    } finally {
      setSavingKpi(false);
    }
  };

  const handleUpdateAtteinte = async (kpiId: number) => {
    const val = kpiAtteinte[kpiId];
    setSavingKpi(true);
    try {
      const res = await fetch(`/api/admin/rh/evaluations/${e.id}/objectifs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpiId, valeurAtteinte: val !== "" ? Number(val) : null }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setKpis((prev) => prev.map((k) => k.id === kpiId ? { ...k, valeurAtteinte: data.data.valeurAtteinte } : k));
      setEditingKpi(null);
      toast.success("Valeur atteinte mise à jour");
    } finally {
      setSavingKpi(false);
    }
  };

  const handleDeleteKpi = async (kpiId: number) => {
    setSavingKpi(true);
    try {
      const res = await fetch(`/api/admin/rh/evaluations/${e.id}/objectifs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kpiId }),
      });
      if (!res.ok) { toast.error("Erreur suppression"); return; }
      setKpis((prev) => prev.filter((k) => k.id !== kpiId));
      toast.success("KPI supprimé");
    } finally {
      setSavingKpi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-900">{PERIODE_LABEL[e.periode]} {e.annee}</span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <User className="w-3 h-3" /> {m.prenom} {m.nom} — {e.profilRH.matricule}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cycle indicator */}
          <div className="mt-3">
            <CycleIndicator statut={e.statut} />
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-0 border-b border-slate-200 px-6">
          {[
            { key: "synthese", label: "Synthèse",          icon: <Star    className="w-3.5 h-3.5" /> },
            { key: "kpis",     label: `KPIs (${kpis.length})`, icon: <Target  className="w-3.5 h-3.5" /> },
            { key: "plan",     label: "Plan d'amélioration", icon: <FileText className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setSubTab(key as typeof subTab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-all ${
                subTab === key ? "border-indigo-600 text-indigo-700 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── Synthèse ── */}
          {subTab === "synthese" && (
            <div className="space-y-4">
              {/* Note globale */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Note globale (moyenne critères)</p>
                  {noteMoy !== null && (
                    <div className="flex items-center gap-2">
                      <StarRating value={Math.round(noteMoy)} />
                      <span className="text-xl font-bold text-slate-800">{noteMoy.toFixed(1)}/5</span>
                    </div>
                  )}
                  {noteMoy === null && <p className="text-sm text-slate-400">Aucun critère noté</p>}
                </div>
                {!editMode && canEdit && (
                  <button onClick={() => setEditMode(true)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    Modifier
                  </button>
                )}
              </div>

              {/* Critères */}
              <div>
                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Critères ({criteres.length})</p>
                <div className="space-y-2">
                  {criteres.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {editMode && !c.id ? (
                        <input value={c.libelle}
                          onChange={(e) => setCriteres((p) => p.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x))}
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm"
                          placeholder="Libellé" />
                      ) : (
                        <span className="flex-1 text-sm text-slate-600">{c.libelle}</span>
                      )}
                      {editMode
                        ? <StarRating value={c.note} onChange={(v) => setCriteres((p) => p.map((x, j) => j === i ? { ...x, note: v } : x))} />
                        : <StarRating value={c.note} />}
                      <span className="text-xs text-slate-400 w-6">{c.note}/5</span>
                      {editMode && (
                        <button onClick={() => setCriteres((p) => p.filter((_, j) => j !== i))}
                          className="text-slate-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      )}
                    </div>
                  ))}
                </div>
                {editMode && (
                  <button onClick={() => setCriteres((p) => [...p, { libelle: "", note: 3 }])}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-2">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un critère
                  </button>
                )}
              </div>

              {/* Champs texte */}
              {editMode ? (
                <div className="space-y-3">
                  {([
                    ["appreciation",     "Appréciation générale"],
                    ["pointsForts",      "Points forts"],
                    ["axesAmelioration", "Axes d'amélioration"],
                    ["objectifsN1",      "Objectifs pour la prochaine période"],
                  ] as [keyof typeof form, string][]).map(([k, l]) => (
                    <EField key={k} label={l}>
                      <textarea value={form[k]} rows={2} onChange={(ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </EField>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {e.appreciation     && <DetailBlock label="Appréciation"          value={e.appreciation} />}
                  {e.pointsForts      && <DetailBlock label="Points forts"          value={e.pointsForts} />}
                  {e.axesAmelioration && <DetailBlock label="Axes d'amélioration"   value={e.axesAmelioration} />}
                  {e.objectifsN1      && <DetailBlock label="Objectifs N+1"         value={e.objectifsN1} />}
                  {!e.appreciation && !e.pointsForts && !e.axesAmelioration && !e.objectifsN1 && (
                    <p className="text-sm text-slate-400 text-center py-4">Aucune synthèse rédigée</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── KPIs ── */}
          {subTab === "kpis" && (
            <div className="space-y-3">
              {kpis.length === 0 && !showAddKpi && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Target className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucun objectif KPI défini</p>
                  {canEdit && (
                    <button onClick={() => setShowAddKpi(true)}
                      className="mt-3 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      <Plus className="w-4 h-4" /> Ajouter un objectif
                    </button>
                  )}
                </div>
              )}

              {kpis.length > 0 && (
                <div className="space-y-2">
                  {kpis.map((kpi) => {
                    const pct = kpi.valeurAtteinte !== null && kpi.valeurCible > 0
                      ? Math.min(100, Math.round((kpi.valeurAtteinte / kpi.valeurCible) * 100)) : null;
                    const isEditing = editingKpi === kpi.id;
                    return (
                      <div key={kpi.id} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{kpi.libelle}</p>
                            {kpi.indicateur && <p className="text-xs text-slate-400 mt-0.5">{kpi.indicateur}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {kpi.poids !== null && (
                              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                                Poids {kpi.poids}%
                              </span>
                            )}
                            {canEdit && !isEditing && (
                              <button onClick={() => { setEditingKpi(kpi.id); setKpiAtteinte((p) => ({ ...p, [kpi.id]: kpi.valeurAtteinte !== null ? String(kpi.valeurAtteinte) : "" })); }}
                                className="text-xs text-slate-500 hover:text-indigo-600 px-2 py-0.5 border border-slate-200 rounded hover:border-indigo-300">
                                Saisir atteinte
                              </button>
                            )}
                            {canEdit && (
                              <button onClick={() => handleDeleteKpi(kpi.id)} disabled={savingKpi}
                                className="text-slate-300 hover:text-red-400 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                            <span>Cible :</span>
                            <span className="font-semibold text-slate-700">{Number(kpi.valeurCible).toLocaleString()}{kpi.unite ? ` ${kpi.unite}` : ""}</span>
                          </div>
                          <span className="text-slate-300">|</span>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input type="number" value={kpiAtteinte[kpi.id] ?? ""}
                                onChange={(ev) => setKpiAtteinte((p) => ({ ...p, [kpi.id]: ev.target.value }))}
                                className="w-24 px-2 py-1 border border-indigo-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="Valeur" />
                              {kpi.unite && <span className="text-xs text-slate-500">{kpi.unite}</span>}
                              <button onClick={() => handleUpdateAtteinte(kpi.id)} disabled={savingKpi}
                                className="px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">
                                {savingKpi ? "…" : "OK"}
                              </button>
                              <button onClick={() => setEditingKpi(null)} className="text-xs text-slate-400 hover:text-slate-600">Annuler</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                              <span>Atteint :</span>
                              <span className={`font-semibold ${pct !== null ? (pct >= 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-500") : "text-slate-400"}`}>
                                {kpi.valeurAtteinte !== null ? `${Number(kpi.valeurAtteinte).toLocaleString()}${kpi.unite ? ` ${kpi.unite}` : ""}` : "—"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <KpiProgressBar kpi={kpi} />
                          </div>
                        </div>
                        {kpi.commentaire && (
                          <p className="text-xs text-slate-400 mt-2 italic">{kpi.commentaire}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Formulaire ajout KPI */}
              {canEdit && (kpis.length > 0 || showAddKpi) && (
                <>
                  {!showAddKpi ? (
                    <button onClick={() => setShowAddKpi(true)}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium w-full justify-center py-3 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50">
                      <Plus className="w-4 h-4" /> Ajouter un objectif KPI
                    </button>
                  ) : (
                    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-medium text-indigo-800">Nouvel objectif KPI</p>
                      <div className="grid grid-cols-2 gap-3">
                        <EField label="Libellé *">
                          <input value={kpiForm.libelle} onChange={(e) => setKpiForm((f) => ({ ...f, libelle: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Ex: Chiffre d'affaires" />
                        </EField>
                        <EField label="Indicateur">
                          <input value={kpiForm.indicateur} onChange={(e) => setKpiForm((f) => ({ ...f, indicateur: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Ex: Ventes mensuelles" />
                        </EField>
                        <EField label="Valeur cible *">
                          <input type="number" value={kpiForm.valeurCible} onChange={(e) => setKpiForm((f) => ({ ...f, valeurCible: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="100" />
                        </EField>
                        <EField label="Unité">
                          <input value={kpiForm.unite} onChange={(e) => setKpiForm((f) => ({ ...f, unite: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Ex: FCFA, %, unités" />
                        </EField>
                        <EField label="Poids (%)">
                          <input type="number" min={0} max={100} value={kpiForm.poids}
                            onChange={(e) => setKpiForm((f) => ({ ...f, poids: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Ex: 30" />
                        </EField>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddKpi(false)}
                          className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                        <button onClick={handleAddKpi} disabled={savingKpi}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                          {savingKpi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Ajouter
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Plan d'amélioration ── */}
          {subTab === "plan" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Plan d&apos;amélioration</p>
                  <p className="text-xs text-slate-400 mt-0.5">Actions concrètes pour améliorer les performances</p>
                </div>
                {!editPlan && canEdit && (
                  <button onClick={() => setEditPlan(true)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    {plan ? "Modifier" : "Rédiger"}
                  </button>
                )}
              </div>

              {editPlan ? (
                <div className="space-y-3">
                  <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={8}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder={"Actions à mettre en place :\n\n1. Formation sur …\n2. Accompagnement par …\n3. Objectifs intermédiaires …"} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setPlan(e.planAmelioration ?? ""); setEditPlan(false); }}
                      className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                    <button onClick={handleSavePlan} disabled={loading}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
                    </button>
                  </div>
                </div>
              ) : plan ? (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{plan}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <FileText className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">Aucun plan d&apos;amélioration rédigé</p>
                  {canEdit && (
                    <button onClick={() => setEditPlan(true)}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">Rédiger le plan</button>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <ActionsPDISection evaluationId={e.id} canEdit={canEdit} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2 flex-wrap">
            {actions.map(({ action, label, cls }) => (
              <button key={action} onClick={() => doAction(action)} disabled={loading}
                className={`px-4 py-2 text-sm font-medium border rounded-lg disabled:opacity-50 ${cls}`}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin inline mr-1" /> : null}{label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
              Fermer
            </button>
            {subTab === "synthese" && editMode && (
              <button onClick={handleSaveSynthese} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
