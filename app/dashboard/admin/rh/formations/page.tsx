"use client";

import { useState, useCallback } from "react";
import React from "react";
import {
  Search, RefreshCw, Plus, X, Save,
  BookOpen, CheckCircle, Clock, PlayCircle, XCircle,
  User, Calendar, MapPin, UserPlus, Award, ArrowLeft,
  Monitor, Building2, Globe, BarChart2, TrendingUp,
  DollarSign, Users, Star,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Participation {
  id:            number;
  statut:        string;
  note:          number | null;
  certificatUrl: string | null;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
  };
}

interface Formation {
  id:              number;
  titre:           string;
  type:            string | null;
  objectifs:       string | null;
  lieu:            string | null;
  formateur:       string | null;
  dateDebut:       string;
  dateFin:         string | null;
  dureeHeures:     number | null;
  cout:            number | null;
  budgetAlloue:    number | null;
  certificationNom:string | null;
  statut:          string;
  notes:           string | null;
  createdAt:       string;
  participations:  Participation[];
  _count:          { participations: number };
}

interface FormationsRes {
  data:        Formation[];
  meta:        { page: number; limit: number; total: number; totalPages: number };
  stats:       Record<string, number>;
  statsByType: Record<string, number>;
}

interface StatsRes {
  tauxFormation:     number;
  tauxPresence:      number;
  collabsFormes:     number;
  totalCollabsActifs:number;
  certifications:    number;
  budgetAlloue:      number;
  budgetDepense:     number;
  heuresTotales:     number;
  noteMoyenne:       number | null;
  totalFormations:   number;
  typeStats:         Record<string, number>;
  statutStats:       Record<string, number>;
}

interface CollabsRes {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

interface DemandeFormationAdmin {
  id:               number;
  intituleSouhaite: string;
  motif:            string | null;
  statut:           string;
  commentaireRefus: string | null;
  createdAt:        string;
  formation:        { id: number; titre: string; dateDebut: string } | null;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } };
  };
}

interface DemandesFormationRes { data: DemandeFormationAdmin[]; meta: { total: number }; stats: Record<string, number> }

interface PlanFormation {
  id:               number;
  annee:            number;
  budgetTotal:      number | null;
  axesPrioritaires: string | null;
  notes:            string | null;
  statut:           string;
  budgetEngage:     number;
  coutReel:         number;
  formations:       { id: number; titre: string; budgetAlloue: number | null; cout: number | null; statut: string }[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  PLANIFIEE: { label: "Planifiée", badge: "bg-slate-100 text-slate-600",    icon: <Clock      className="w-3.5 h-3.5" /> },
  EN_COURS:  { label: "En cours",  badge: "bg-amber-100 text-amber-700",    icon: <PlayCircle className="w-3.5 h-3.5" /> },
  TERMINEE:  { label: "Terminée",  badge: "bg-emerald-100 text-emerald-700",icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ANNULEE:   { label: "Annulée",   badge: "bg-red-100 text-red-700",        icon: <XCircle    className="w-3.5 h-3.5" /> },
};

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  INTERNE:   { label: "Interne",   badge: "bg-indigo-100 text-indigo-700", icon: <Building2 className="w-3.5 h-3.5" /> },
  EXTERNE:   { label: "Externe",   badge: "bg-sky-100 text-sky-700",       icon: <Globe     className="w-3.5 h-3.5" /> },
  ELEARNING: { label: "E-learning",badge: "bg-violet-100 text-violet-700", icon: <Monitor   className="w-3.5 h-3.5" /> },
};

const STATUT_DEMANDE_CONFIG: Record<string, { label: string; badge: string }> = {
  EN_ATTENTE:     { label: "En attente",     badge: "bg-amber-100 text-amber-700" },
  VALIDE_MANAGER: { label: "Validée manager",badge: "bg-blue-100 text-blue-700" },
  VALIDE_RH:      { label: "Validée RH",     badge: "bg-indigo-100 text-indigo-700" },
  APPROUVE:       { label: "Approuvée",      badge: "bg-emerald-100 text-emerald-700" },
  REJETE:         { label: "Rejetée",        badge: "bg-red-100 text-red-700" },
  ANNULE:         { label: "Annulée",        badge: "bg-slate-100 text-slate-500" },
};

const STATUT_PART: Record<string, { label: string; badge: string }> = {
  INSCRIT:  { label: "Inscrit",  badge: "bg-slate-100 text-slate-600"     },
  PRESENT:  { label: "Présent",  badge: "bg-blue-100 text-blue-700"       },
  ABSENT:   { label: "Absent",   badge: "bg-red-100 text-red-600"         },
  CERTIFIE: { label: "Certifié", badge: "bg-emerald-100 text-emerald-700" },
};

const WORKFLOW: Record<string, { action: string; label: string; cls: string }[]> = {
  PLANIFIEE: [
    { action: "DEMARRER", label: "Démarrer", cls: "bg-amber-600 text-white hover:bg-amber-700" },
    { action: "ANNULER",  label: "Annuler",  cls: "bg-white text-red-600 border border-red-200 hover:bg-red-50" },
  ],
  EN_COURS:  [{ action: "TERMINER", label: "Terminer", cls: "bg-emerald-600 text-white hover:bg-emerald-700" }],
  TERMINEE:  [],
  ANNULEE:   [],
};

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const ANNEES  = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

// ── Composant champ formulaire ─────────────────────────────────────────────────

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FormationsPage() {
  const [activeTab, setActiveTab] = useState<"catalogue" | "demandes" | "plan" | "suivi" | "kpis">("catalogue");
  const [demandeStatutFilt, setDemandeStatutFilt] = useState("");
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [statut,    setStatut]    = useState("");
  const [typeFilt,  setTypeFilt]  = useState("");
  const [annee,     setAnnee]     = useState(String(new Date().getFullYear()));
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState<Formation | null>(null);

  const params = new URLSearchParams();
  if (statut)   params.set("statut", statut);
  if (typeFilt) params.set("type",   typeFilt);
  if (annee)    params.set("annee",  annee);
  if (search)   params.set("search", search);
  params.set("page", String(page)); params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<FormationsRes>(`/api/admin/rh/formations?${params}`);
  const formations  = res?.data        ?? [];
  const meta        = res?.meta;
  const stats       = res?.stats       ?? {};
  const statsByType = res?.statsByType ?? {};

  // Stats globales (onglet KPIs)
  const statsParams = new URLSearchParams();
  if (annee) statsParams.set("annee", annee);
  const { data: kpiData, loading: kpiLoading } = useApi<StatsRes>(
    activeTab === "kpis" ? `/api/admin/rh/formations/stats?${statsParams}` : null
  );

  // Suivi — toutes participations
  const suiviParams = new URLSearchParams();
  suiviParams.set("limit", "100");
  if (annee) suiviParams.set("annee", annee);
  const { data: suiviRes, loading: suiviLoading } = useApi<FormationsRes>(
    activeTab === "suivi" ? `/api/admin/rh/formations?${suiviParams}` : null
  );
  const suiviFormations = suiviRes?.data ?? [];

  // Demandes de formation self-service
  const demandeParams = new URLSearchParams();
  if (demandeStatutFilt) demandeParams.set("statut", demandeStatutFilt);
  demandeParams.set("limit", "50");
  const { data: demandesRes, loading: demandesLoading, refetch: refetchDemandes } = useApi<DemandesFormationRes>(
    activeTab === "demandes" ? `/api/admin/rh/formations/demandes?${demandeParams}` : null
  );
  const demandesFormation  = demandesRes?.data  ?? [];
  const demandesStats      = demandesRes?.stats ?? {};

  // Plan de formation annuel
  const { data: plansRes, loading: plansLoading, refetch: refetchPlans } = useApi<{ data: PlanFormation[] }>(
    activeTab === "plan" ? "/api/admin/rh/formations/plans" : null
  );
  const plans = plansRes?.data ?? [];

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Formations & Développement</h1>
            <p className="text-sm text-slate-500 mt-0.5">Catalogue · Suivi · KPIs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            {activeTab === "catalogue" && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nouvelle formation
              </button>
            )}
            {activeTab === "plan" && (
              <button onClick={() => setShowNewPlan(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700">
                <Plus className="w-4 h-4" /> Nouveau plan annuel
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit overflow-x-auto">
          {[
            { key: "catalogue", label: "Catalogue",    icon: <BookOpen  className="w-3.5 h-3.5" /> },
            { key: "demandes",  label: "Demandes",     icon: <UserPlus  className="w-3.5 h-3.5" /> },
            { key: "plan",      label: "Plan annuel",  icon: <Award     className="w-3.5 h-3.5" /> },
            { key: "suivi",     label: "Suivi",        icon: <Users     className="w-3.5 h-3.5" /> },
            { key: "kpis",      label: "KPIs",         icon: <BarChart2 className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ════════ CATALOGUE ════════ */}
        {activeTab === "catalogue" && (
          <>
            {/* Stats statut */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
                  className={`p-4 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md w-fit mb-2 text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</div>
                  <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
                </button>
              ))}
            </div>

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Rechercher (titre, formateur, lieu…)"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              {/* Filtre type */}
              <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                <button onClick={() => setTypeFilt("")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${!typeFilt ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                  Tous
                </button>
                {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                  <button key={k} onClick={() => setTypeFilt(typeFilt === k ? "" : k)}
                    className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-all ${typeFilt === k ? `${cfg.badge} ring-1` : "text-slate-500 hover:bg-slate-50"}`}>
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
              <select value={annee} onChange={(e) => { setAnnee(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Toutes années</option>
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Répartition par type */}
            {Object.keys(statsByType).length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                  <div key={k} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                    {cfg.icon} {cfg.label} : {statsByType[k] ?? 0}
                  </div>
                ))}
              </div>
            )}

            {/* Liste */}
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : formations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <BookOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune formation trouvée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formations.map((f) => (
                  <FormationCard key={f.id} formation={f} onOpen={() => setSelected(f)} onRefetch={refetch} />
                ))}
              </div>
            )}

            {meta && meta.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{meta.total} formations</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
                  <span className="px-3 py-1.5 text-sm text-slate-600">{page}/{meta.totalPages}</span>
                  <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ DEMANDES DE FORMATION ════════ */}
        {activeTab === "demandes" && (
          <>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUT_DEMANDE_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setDemandeStatutFilt(demandeStatutFilt === key ? "" : key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    demandeStatutFilt === key ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
                  }`}>
                  {cfg.label} ({demandesStats[key] ?? 0})
                </button>
              ))}
            </div>

            {demandesLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : demandesFormation.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <UserPlus className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune demande de formation</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {demandesFormation.map((d) => (
                  <DemandeFormationRow key={d.id} demande={d} onRefetch={refetchDemandes} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════ PLAN DE FORMATION ANNUEL ════════ */}
        {activeTab === "plan" && (
          <>
            {plansLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : plans.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Award className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun plan de formation annuel</p>
                <button onClick={() => setShowNewPlan(true)} className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Créer un plan annuel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((p) => <PlanFormationCard key={p.id} plan={p} onRefetch={refetchPlans} />)}
              </div>
            )}
          </>
        )}

        {/* ════════ SUIVI ════════ */}
        {activeTab === "suivi" && (
          <>
            <div className="flex items-center gap-3">
              <select value={annee} onChange={(e) => setAnnee(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {suiviLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : suiviFormations.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Users className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune formation pour cette période</p>
              </div>
            ) : (
              <div className="space-y-4">
                {suiviFormations.map((f) => {
                  if (f.participations.length === 0) return null;
                  const cfg  = STATUT_CONFIG[f.statut] ?? STATUT_CONFIG.PLANIFIEE;
                  const tcfg = f.type ? TYPE_CONFIG[f.type] : null;
                  const nbCertifies = f.participations.filter((p) => p.statut === "CERTIFIE").length;
                  const nbPresents  = f.participations.filter((p) => ["PRESENT","CERTIFIE"].includes(p.statut)).length;
                  const tauxPres    = f.participations.length > 0 ? Math.round(nbPresents / f.participations.length * 100) : 0;

                  return (
                    <div key={f.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setSelected(f)} className="text-sm font-semibold text-slate-800 hover:text-emerald-600 text-left">
                              {f.titre}
                            </button>
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                            {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
                            {f.certificationNom && <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Award className="w-3 h-3" />{f.certificationNom}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                            <span>{formatDate(f.dateDebut)}</span>
                            {f.dureeHeures && <span>{f.dureeHeures}h</span>}
                            <span>{f.participations.length} participant{f.participations.length > 1 ? "s" : ""}</span>
                            <span className={`font-medium ${tauxPres >= 80 ? "text-emerald-600" : tauxPres >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {tauxPres}% présence
                            </span>
                            {nbCertifies > 0 && <span className="text-amber-600 font-medium"><Award className="w-3 h-3 inline" /> {nbCertifies} certifié{nbCertifies > 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {f.participations.map((p) => {
                          const m  = p.profilRH.gestionnaire.member;
                          const sp = STATUT_PART[p.statut] ?? STATUT_PART.INSCRIT;
                          return (
                            <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {m.prenom[0]}{m.nom[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <Link href={`/dashboard/admin/rh/collaborateurs/${p.profilRH.id}`}
                                  className="text-sm font-medium text-slate-800 hover:text-emerald-600">
                                  {m.prenom} {m.nom}
                                </Link>
                                <p className="text-xs text-slate-400 font-mono">{p.profilRH.matricule}</p>
                              </div>
                              {p.note !== null && (
                                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                  {p.note}/20
                                </span>
                              )}
                              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sp.badge}`}>
                                {p.statut === "CERTIFIE" && <Award className="w-3 h-3" />}
                                {sp.label}
                              </span>
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

        {/* ════════ KPIs ════════ */}
        {activeTab === "kpis" && (
          <>
            <div className="flex items-center gap-3">
              <select value={annee} onChange={(e) => setAnnee(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {kpiLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Calcul des KPIs…
              </div>
            ) : kpiData ? (
              <div className="space-y-5">
                {/* Indicateurs principaux */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
                    label="Taux de formation"
                    value={`${kpiData.tauxFormation}%`}
                    sub={`${kpiData.collabsFormes}/${kpiData.totalCollabsActifs} collaborateurs`}
                    color="bg-emerald-50 border-emerald-200"
                    pct={kpiData.tauxFormation} />
                  <KpiCard
                    icon={<Users className="w-5 h-5 text-blue-600" />}
                    label="Taux de présence"
                    value={`${kpiData.tauxPresence}%`}
                    sub="Présents ou certifiés"
                    color="bg-blue-50 border-blue-200"
                    pct={kpiData.tauxPresence} />
                  <KpiCard
                    icon={<Award className="w-5 h-5 text-amber-600" />}
                    label="Certifications"
                    value={String(kpiData.certifications)}
                    sub="Diplômés cette année"
                    color="bg-amber-50 border-amber-200" />
                  <KpiCard
                    icon={<Clock className="w-5 h-5 text-violet-600" />}
                    label="Heures de formation"
                    value={`${kpiData.heuresTotales}h`}
                    sub="Formations terminées"
                    color="bg-violet-50 border-violet-200" />
                </div>

                {/* Budget */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" /> Budget formation
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Budget alloué</p>
                      <p className="text-xl font-bold text-slate-800">{fmt(kpiData.budgetAlloue)} FCFA</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Coût réel (formations terminées)</p>
                      <p className="text-xl font-bold text-slate-800">{fmt(kpiData.budgetDepense)} FCFA</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">Écart</p>
                      <p className={`text-xl font-bold ${kpiData.budgetDepense <= kpiData.budgetAlloue ? "text-emerald-600" : "text-red-600"}`}>
                        {kpiData.budgetAlloue > 0 ? (kpiData.budgetDepense <= kpiData.budgetAlloue ? "Dans le budget" : "Dépassement") : "—"}
                      </p>
                    </div>
                  </div>
                  {kpiData.budgetAlloue > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Consommation</span>
                        <span>{Math.round(kpiData.budgetDepense / kpiData.budgetAlloue * 100)}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${kpiData.budgetDepense > kpiData.budgetAlloue ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, Math.round(kpiData.budgetDepense / kpiData.budgetAlloue * 100))}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Répartition par type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-500" /> Répartition par type
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(TYPE_CONFIG).map(([k, cfg]) => {
                        const count = kpiData.typeStats[k] ?? 0;
                        const total = kpiData.totalFormations || 1;
                        const pct   = Math.round(count / total * 100);
                        return (
                          <div key={k}>
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
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500" /> Qualité & résultats
                    </h3>
                    <div className="space-y-4">
                      {kpiData.noteMoyenne !== null && (
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                          <p className="text-sm text-slate-700">Note moyenne</p>
                          <p className="text-xl font-bold text-amber-700">{kpiData.noteMoyenne}/20</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <p className="text-sm text-slate-700">Taux de complétion</p>
                        <p className="text-xl font-bold text-emerald-700">
                          {kpiData.totalFormations > 0
                            ? `${Math.round((kpiData.statutStats["TERMINEE"] ?? 0) / kpiData.totalFormations * 100)}%`
                            : "—"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <p className="text-sm text-slate-700">Formations planifiées</p>
                        <p className="text-xl font-bold text-slate-700">{kpiData.statutStats["PLANIFIEE"] ?? 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            )}
          </>
        )}
      </div>

      {showCreate  && <CreateFormationModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {selected    && <FormationDetailModal formation={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />}
      {showNewPlan && <NewPlanFormationModal onClose={() => setShowNewPlan(false)} onCreated={() => { setShowNewPlan(false); refetchPlans(); }} />}
    </div>
  );
}

// ── Ligne demande de formation ─────────────────────────────────────────────────

function DemandeFormationRow({ demande: d, onRefetch }: { demande: DemandeFormationAdmin; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/demandes/${d.id}`, "PATCH");
  const statutCfg = STATUT_DEMANDE_CONFIG[d.statut] ?? STATUT_DEMANDE_CONFIG.EN_ATTENTE;
  const member = d.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    let commentaire: string | undefined;
    if (action === "REJETER") commentaire = window.prompt("Motif du refus (facultatif) :") ?? undefined;
    const result = await mutate({ action, commentaire });
    if (result) { toast.success("Demande mise à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{member.prenom} {member.nom}</span>
          <span className="text-xs text-slate-400 font-mono">{d.profilRH.matricule}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutCfg.badge}`}>{statutCfg.label}</span>
        </div>
        <p className="text-sm text-slate-700 mt-0.5">{d.intituleSouhaite}</p>
        {d.formation && <p className="text-xs text-slate-400 mt-0.5">Session : {d.formation.titre} ({formatDate(d.formation.dateDebut)})</p>}
        {d.motif && <p className="text-xs text-slate-400 mt-0.5 italic">{d.motif}</p>}
        {d.commentaireRefus && <p className="text-xs text-red-500 mt-0.5">Motif refus : {d.commentaireRefus}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {d.statut === "EN_ATTENTE" && (
          <button disabled={loading} onClick={() => doAction("VALIDER_MANAGER")}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">Valider manager</button>
        )}
        {d.statut === "VALIDE_MANAGER" && (
          <button disabled={loading} onClick={() => doAction("VALIDER_RH")}
            className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50">Valider RH</button>
        )}
        {["EN_ATTENTE", "VALIDE_MANAGER", "VALIDE_RH"].includes(d.statut) && (
          <>
            <button disabled={loading} onClick={() => doAction("APPROUVER")}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 disabled:opacity-50">Approuver</button>
            <button disabled={loading} onClick={() => doAction("REJETER")}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50">Rejeter</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Carte plan de formation annuel ─────────────────────────────────────────────

function PlanFormationCard({ plan: p, onRefetch }: { plan: PlanFormation; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/plans/${p.id}`, "PATCH");
  const pct = p.budgetTotal ? Math.min(100, Math.round((p.budgetEngage / Number(p.budgetTotal)) * 100)) : null;

  const handleValider = async () => {
    const result = await mutate({ statut: p.statut === "BROUILLON" ? "VALIDE" : "CLOTURE" });
    if (result) { toast.success("Plan mis à jour"); onRefetch(); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-slate-900">{p.annee}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          p.statut === "CLOTURE" ? "bg-slate-100 text-slate-500" : p.statut === "VALIDE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}>{p.statut === "BROUILLON" ? "Brouillon" : p.statut === "VALIDE" ? "Validé" : "Clôturé"}</span>
      </div>

      {p.budgetTotal != null && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Budget engagé</span>
            <span>{new Intl.NumberFormat("fr-FR").format(p.budgetEngage)} / {new Intl.NumberFormat("fr-FR").format(Number(p.budgetTotal))} FCFA</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${pct != null && pct > 100 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
          </div>
        </div>
      )}

      {p.axesPrioritaires && <p className="text-xs text-slate-600">{p.axesPrioritaires}</p>}

      <p className="text-xs text-slate-400">{p.formations.length} formation{p.formations.length > 1 ? "s" : ""} rattachée{p.formations.length > 1 ? "s" : ""}</p>

      {p.statut !== "CLOTURE" && (
        <button onClick={handleValider} disabled={loading}
          className="w-full px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50">
          {p.statut === "BROUILLON" ? "Valider le plan" : "Clôturer le plan"}
        </button>
      )}
    </div>
  );
}

function NewPlanFormationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/formations/plans", "POST");
  const [form, setForm] = useState({ annee: String(new Date().getFullYear() + 1), budgetTotal: "", axesPrioritaires: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.annee) { toast.error("Année requise"); return; }
    const result = await mutate({
      annee:            Number(form.annee),
      budgetTotal:      form.budgetTotal || undefined,
      axesPrioritaires: form.axesPrioritaires || undefined,
      notes:            form.notes || undefined,
    });
    if (result) { toast.success("Plan de formation créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau plan de formation annuel</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Année *</label>
            <input type="number" value={form.annee} onChange={(e) => set("annee", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Budget total (FCFA)</label>
            <input type="number" value={form.budgetTotal} onChange={(e) => set("budgetTotal", e.target.value)}
              placeholder="ex : 5000000"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Axes prioritaires</label>
            <textarea value={form.axesPrioritaires} onChange={(e) => set("axesPrioritaires", e.target.value)} rows={3}
              placeholder="ex : management, digitalisation, vente…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, color, pct }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; pct?: number }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="p-1.5 bg-white rounded-lg shadow-sm">{icon}</div>
        {pct !== undefined && (
          <span className={`text-xs font-bold ${pct >= 70 ? "text-emerald-700" : pct >= 50 ? "text-amber-700" : "text-red-600"}`}>{pct}%</span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
            style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="text-xs font-medium text-slate-700 mt-1">{label}</p>
    </div>
  );
}

// ── Card formation ─────────────────────────────────────────────────────────────

function FormationCard({ formation, onOpen, onRefetch }: { formation: Formation; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/${formation.id}`, "PATCH");
  const cfg     = STATUT_CONFIG[formation.statut] ?? STATUT_CONFIG.PLANIFIEE;
  const tcfg    = formation.type ? TYPE_CONFIG[formation.type] : null;
  const actions = WORKFLOW[formation.statut] ?? [];

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onRefetch(); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onOpen} className="text-base font-semibold text-slate-900 hover:text-emerald-600 text-left">
              {formation.titre}
            </button>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
            {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
            {formation.certificationNom && (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <Award className="w-3 h-3" /> {formation.certificationNom}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(formation.dateDebut)}{formation.dateFin ? ` → ${formatDate(formation.dateFin)}` : ""}</span>
            {formation.lieu      && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {formation.lieu}</span>}
            {formation.formateur && <span className="flex items-center gap-1"><User   className="w-3 h-3" /> {formation.formateur}</span>}
            {formation.dureeHeures && <span>{formation.dureeHeures}h</span>}
            {formation.cout && <span className="text-slate-500">{fmt(Number(formation.cout))} FCFA</span>}
            {formation.budgetAlloue && <span className="text-slate-400">Budget: {fmt(Number(formation.budgetAlloue))} FCFA</span>}
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {formation._count.participations} participant{formation._count.participations > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions.map((act) => (
            <button key={act.action} onClick={() => doAction(act.action)} disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${act.cls}`}>
              {act.label}
            </button>
          ))}
          <button onClick={onOpen} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
            Détail
          </button>
        </div>
      </div>

      {/* Participants aperçu */}
      {formation.participations.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {formation.participations.slice(0, 10).map((p) => {
            const m  = p.profilRH.gestionnaire.member;
            const sp = STATUT_PART[p.statut] ?? STATUT_PART.INSCRIT;
            return (
              <Link key={p.id} href={`/dashboard/admin/rh/collaborateurs/${p.profilRH.id}`}
                title={`${m.prenom} ${m.nom} — ${sp.label}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white ring-1 ${sp.badge}`}>
                {m.prenom[0]}{m.nom[0]}
              </Link>
            );
          })}
          {formation._count.participations > 10 && (
            <span className="text-xs text-slate-400">+{formation._count.participations - 10}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateFormationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/formations", "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const { data: plansRes } = useApi<{ data: PlanFormation[] }>("/api/admin/rh/formations/plans");
  const plans = plansRes?.data ?? [];
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const [partSearch, setPartSearch] = useState("");

  const [form, setForm] = useState({
    titre: "", type: "INTERNE", objectifs: "", lieu: "", formateur: "",
    dateDebut: "", dateFin: "", dureeHeures: "", cout: "", budgetAlloue: "",
    certificationNom: "", notes: "", planFormationId: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const togglePart = (id: number) => setSelectedParts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const filteredCollabs = partSearch
    ? collabs.filter((c) => {
        const m = c.gestionnaire.member;
        return `${m.prenom} ${m.nom} ${c.matricule}`.toLowerCase().includes(partSearch.toLowerCase());
      })
    : collabs;

  const handleSubmit = async () => {
    if (!form.titre || !form.dateDebut) { toast.error("Titre et date de début obligatoires"); return; }
    const result = await mutate({
      titre:            form.titre,
      type:             form.type     || null,
      objectifs:        form.objectifs || null,
      lieu:             form.lieu     || null,
      formateur:        form.formateur || null,
      dateDebut:        form.dateDebut,
      dateFin:          form.dateFin  || null,
      dureeHeures:      form.dureeHeures   ? Number(form.dureeHeures)   : null,
      cout:             form.cout          ? Number(form.cout)          : null,
      budgetAlloue:     form.budgetAlloue  ? Number(form.budgetAlloue)  : null,
      certificationNom: form.certificationNom || null,
      notes:            form.notes          || null,
      participantIds:   selectedParts,
      planFormationId:  form.planFormationId || undefined,
    });
    if (result) { toast.success("Formation créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle formation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <FField label="Titre *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)}
              placeholder="Ex: Formation Excel avancé"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </FField>

          <FField label="Type">
            <div className="flex gap-2">
              {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => set("type", k)}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm flex-1 justify-center transition-all ${
                    form.type === k ? `${cfg.badge} border-current ring-1` : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </FField>

          {plans.length > 0 && (
            <FField label="Plan de formation annuel (facultatif)">
              <select value={form.planFormationId} onChange={(e) => set("planFormationId", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Aucun —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.annee}</option>)}
              </select>
            </FField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FField label="Date de début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Date de fin">
              <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Lieu">
              <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder="Ville / salle"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Formateur">
              <input value={form.formateur} onChange={(e) => set("formateur", e.target.value)} placeholder="Nom"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Durée (heures)">
              <input type="number" value={form.dureeHeures} onChange={(e) => set("dureeHeures", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Budget alloué (FCFA)">
              <input type="number" value={form.budgetAlloue} onChange={(e) => set("budgetAlloue", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Coût réel (FCFA)">
              <input type="number" value={form.cout} onChange={(e) => set("cout", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Certification délivrée">
              <input value={form.certificationNom} onChange={(e) => set("certificationNom", e.target.value)}
                placeholder="Ex: PRINCE2, ITIL…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
          </div>

          <FField label="Objectifs">
            <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2}
              placeholder="Objectifs pédagogiques de la formation…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </FField>

          {/* Participants */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5" />
              Participants ({selectedParts.length} sélectionnés)
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input value={partSearch} onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Filtrer les collaborateurs…"
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {filteredCollabs.map((c) => {
                const m   = c.gestionnaire.member;
                const sel = selectedParts.includes(c.id);
                return (
                  <button key={c.id} onClick={() => togglePart(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${sel ? "bg-emerald-50" : ""}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                      {sel && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1 truncate">{m.prenom} {m.nom}</span>
                    <span className="text-slate-400 text-xs font-mono flex-shrink-0">{c.matricule}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail ───────────────────────────────────────────────────────────────

function FormationDetailModal({ formation, onClose, onUpdated }: { formation: Formation; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/${formation.id}`, "PATCH");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs     = collabRes?.data ?? [];
  const cfg         = STATUT_CONFIG[formation.statut] ?? STATUT_CONFIG.PLANIFIEE;
  const tcfg        = formation.type ? TYPE_CONFIG[formation.type] : null;
  const actions     = WORKFLOW[formation.statut] ?? [];
  const existingIds = new Set(formation.participations.map((p) => p.profilRH.id));

  const doAction = async (action: string) => {
    const r = await mutate({ action });
    if (r) { toast.success("Statut mis à jour"); onUpdated(); }
  };
  const addParticipant = async (profilRHId: number) => {
    const r = await mutate({ addParticipants: [profilRHId] });
    if (r) { toast.success("Participant ajouté"); onUpdated(); }
  };
  const updateStatutPart = async (participantId: number, statutParticipation: string) => {
    const r = await mutate({ participantId, statutParticipation });
    if (r) { toast.success("Statut mis à jour"); onUpdated(); }
  };
  const updateNote = async (participantId: number, note: number) => {
    const r = await mutate({ participantId, statutParticipation: formation.participations.find((p) => p.profilRH.id === participantId)?.statut ?? "PRESENT", note });
    if (r) { toast.success("Note enregistrée"); onUpdated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-900 truncate">{formation.titre}</h2>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
              {tcfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tcfg.badge}`}>{tcfg.icon} {tcfg.label}</span>}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(formation.dateDebut)}</span>
              {formation.lieu      && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{formation.lieu}</span>}
              {formation.formateur && <span className="flex items-center gap-1"><User   className="w-3 h-3" />{formation.formateur}</span>}
              {formation.dureeHeures && <span>{formation.dureeHeures}h</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Info formation */}
          <div className="grid grid-cols-2 gap-3">
            {formation.certificationNom && (
              <div className="col-span-2 flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Certification délivrée</p>
                  <p className="text-sm font-semibold text-amber-800">{formation.certificationNom}</p>
                </div>
              </div>
            )}
            {formation.cout && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-400">Coût</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(Number(formation.cout))} FCFA</p>
              </div>
            )}
            {formation.budgetAlloue && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-400">Budget alloué</p>
                <p className="text-sm font-semibold text-slate-800">{fmt(Number(formation.budgetAlloue))} FCFA</p>
              </div>
            )}
          </div>

          {formation.objectifs && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">{formation.objectifs}</div>
          )}

          {/* Participants */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase mb-2">
              Participants ({formation._count.participations})
            </p>
            {formation.participations.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun participant inscrit</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {formation.participations.map((p) => {
                  const m  = p.profilRH.gestionnaire.member;
                  const sp = STATUT_PART[p.statut] ?? STATUT_PART.INSCRIT;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {m.prenom[0]}{m.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{m.prenom} {m.nom}</p>
                      </div>
                      {/* Note */}
                      {formation.statut === "TERMINEE" && (
                        <input type="number" min={0} max={20}
                          defaultValue={p.note !== null ? Number(p.note) : ""}
                          onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && v !== Number(p.note)) updateNote(p.profilRH.id, v); }}
                          placeholder="Note/20"
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-center" />
                      )}
                      <select value={p.statut} onChange={(e) => updateStatutPart(p.profilRH.id, e.target.value)}
                        disabled={loading}
                        className={`text-xs px-2 py-1 rounded-lg border font-medium ${sp.badge} focus:outline-none`}>
                        {Object.entries(STATUT_PART).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      {p.statut === "CERTIFIE" && <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ajouter participant */}
          {formation.statut !== "ANNULEE" && (
            <div>
              <p className="text-xs font-semibold text-slate-700 uppercase mb-2">Ajouter un participant</p>
              <select onChange={(e) => { if (e.target.value) { addParticipant(Number(e.target.value)); e.target.value = ""; } }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Sélectionner un collaborateur —</option>
                {collabs.filter((c) => !existingIds.has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2">
            {actions.map((act) => (
              <button key={act.action} onClick={() => doAction(act.action)} disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${act.cls}`}>
                {act.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
