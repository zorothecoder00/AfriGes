"use client";

import React, { useState } from "react";
import {
  ArrowLeft, RefreshCw, Plus, X, Save, Search,
  TrendingUp, ArrowUpRight, ArrowRight, RotateCcw,
  Star, Shield, Users, Target, Award, Briefcase,
  ChevronDown, ChevronUp, Trash2, User, Calendar,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Mouvement {
  id:                number;
  type:              string | null;
  ancienneFonction:  string | null;
  nouvelleFonction:  string | null;
  ancienDepartement: string | null;
  nouveauDepartement:string | null;
  ancienService:     string | null;
  nouveauService:    string | null;
  ancienSalaire:     number | null;
  nouveauSalaire:    number | null;
  motif:             string | null;
  createdAt:         string;
  ancienManager:     { nom: string; prenom: string } | null;
  nouveauManager:    { nom: string; prenom: string } | null;
  profilRH: {
    id: number; matricule: string; fonction: string | null; departement: string | null;
    gestionnaire: { member: { nom: string; prenom: string } };
  };
}

interface PosteCritique {
  id:                  number;
  titre:               string;
  departement:         string | null;
  description:         string | null;
  nbSuccesseursRequis: number;
  actif:               boolean;
  successeurs: {
    id:          number;
    readiness:   string;
    estTalentCle:boolean;
    notes:       string | null;
    profilRH: {
      id: number; matricule: string; fonction: string | null; departement: string | null;
      gestionnaire: { member: { nom: string; prenom: string } };
    };
  }[];
}

interface Talent {
  profilRH: {
    id: number; matricule: string; fonction: string | null; departement: string | null;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
    planCarriere: { prochainPosteVise: string | null; dateRevision: string | null } | null;
    competences:  { niveau: string; competence: { nom: string; type: string } }[];
  };
  readiness: string;
  notes:     string | null;
  postes:    { id: number; titre: string; departement: string | null }[];
}

interface DemandeCarriere {
  id:                 number;
  type:               string;
  nouvelleFonction:   string | null;
  nouveauService:     string | null;
  nouveauDepartement: string | null;
  nouveauSalaire:     number | null;
  motif:              string | null;
  statut:             string;
  commentaireRefus:   string | null;
  createdAt:          string;
  profilRH: {
    id: number; matricule: string; fonction: string | null; departement: string | null;
    gestionnaire: { member: { nom: string; prenom: string } };
  };
}

interface DemandesRes { data: DemandeCarriere[]; meta: { total: number; page: number; totalPages: number }; stats: Record<string, number> }

interface MouvementsRes  { data: Mouvement[];    meta: { total: number; page: number; totalPages: number }; stats: Record<string, number> }
interface SuccessionRes  { data: PosteCritique[]; stats: { total: number; couverts: number; critiques: number; talents: number } }
interface TalentsRes     { data: Talent[]; total: number }
interface CollabsRes     { data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; color: string }> = {
  PROMOTION:    { label: "Promotion",    badge: "bg-emerald-100 text-emerald-700", icon: <ArrowUpRight className="w-3.5 h-3.5" />, color: "bg-emerald-500" },
  MUTATION:     { label: "Mutation",     badge: "bg-blue-100 text-blue-700",       icon: <ArrowRight    className="w-3.5 h-3.5" />, color: "bg-blue-500" },
  EVOLUTION:    { label: "Évolution",    badge: "bg-violet-100 text-violet-700",   icon: <TrendingUp    className="w-3.5 h-3.5" />, color: "bg-violet-500" },
  RECLASSEMENT: { label: "Reclassement", badge: "bg-orange-100 text-orange-700",   icon: <RotateCcw     className="w-3.5 h-3.5" />, color: "bg-orange-500" },
};

const READINESS_CONFIG: Record<string, { label: string; badge: string; short: string }> = {
  PRET_MAINTENANT: { label: "Prêt maintenant",   badge: "bg-emerald-100 text-emerald-700", short: "Maintenant" },
  PRET_SOUS_1_AN:  { label: "Prêt sous 1 an",    badge: "bg-blue-100 text-blue-700",       short: "<1 an" },
  PRET_1_A_3_ANS:  { label: "Prêt dans 1-3 ans", badge: "bg-amber-100 text-amber-700",     short: "1-3 ans" },
  EN_DEVELOPPEMENT:{ label: "En développement",  badge: "bg-slate-100 text-slate-600",     short: "Dev." },
};

const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES         = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i);

const STATUT_DEMANDE_CONFIG: Record<string, { label: string; badge: string }> = {
  EN_ATTENTE: { label: "En attente",  badge: "bg-amber-100 text-amber-700" },
  VALIDE_RH:  { label: "Validée RH",  badge: "bg-blue-100 text-blue-700" },
  APPROUVE:   { label: "Approuvée",   badge: "bg-emerald-100 text-emerald-700" },
  REJETE:     { label: "Rejetée",     badge: "bg-red-100 text-red-700" },
  ANNULE:     { label: "Annulée",     badge: "bg-slate-100 text-slate-500" },
};

// ── Composants utilitaires ─────────────────────────────────────────────────────

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Avatar({ nom, prenom, size = "md" }: { nom: string; prenom: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={`${s} rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {prenom[0]}{nom[0]}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CarrieresPage() {
  const [activeTab, setActiveTab] = useState<"parcours" | "demandes" | "succession" | "talents">("parcours");
  const [typeFilt,  setTypeFilt]  = useState("");
  const [anneeFilt, setAnneeFilt] = useState(String(ANNEE_COURANTE));
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [demandeStatutFilt, setDemandeStatutFilt] = useState("");
  const [showNewMouvement,  setShowNewMouvement]  = useState(false);
  const [showNewDemande,    setShowNewDemande]    = useState(false);
  const [showNewPoste,      setShowNewPoste]       = useState(false);
  const [selectedPoste,     setSelectedPoste]      = useState<PosteCritique | null>(null);

  // ── Parcours ──
  const mouvParams = new URLSearchParams();
  if (typeFilt)  mouvParams.set("type",  typeFilt);
  if (anneeFilt) mouvParams.set("annee", anneeFilt);
  if (search)    mouvParams.set("search", search);
  mouvParams.set("page", String(page)); mouvParams.set("limit", "25");

  const { data: mouvRes, loading: mouvLoading, refetch: refetchMouv } = useApi<MouvementsRes>(
    activeTab === "parcours" ? `/api/admin/rh/carrieres/mouvements?${mouvParams}` : null
  );
  const mouvements = mouvRes?.data ?? [];
  const mouvMeta   = mouvRes?.meta;
  const mouvStats  = mouvRes?.stats ?? {};

  // ── Demandes de mouvement de carrière ──
  const demandeParams = new URLSearchParams();
  if (demandeStatutFilt) demandeParams.set("statut", demandeStatutFilt);
  demandeParams.set("limit", "50");

  const { data: demandesRes, loading: demandesLoading, refetch: refetchDemandes } = useApi<DemandesRes>(
    activeTab === "demandes" ? `/api/admin/rh/carrieres/demandes?${demandeParams}` : null
  );
  const demandes      = demandesRes?.data ?? [];
  const demandesStats = demandesRes?.stats ?? {};

  // ── Succession ──
  const { data: succRes, loading: succLoading, refetch: refetchSucc } = useApi<SuccessionRes>(
    activeTab === "succession" ? "/api/admin/rh/carrieres/plan-succession" : null
  );
  const postes     = succRes?.data  ?? [];
  const succStats  = succRes?.stats ?? { total: 0, couverts: 0, critiques: 0, talents: 0 };

  // ── Talents ──
  const { data: talentsRes, loading: talentsLoading, refetch: refetchTalents } = useApi<TalentsRes>(
    activeTab === "talents" ? "/api/admin/rh/carrieres/talents" : null
  );
  const talents = talentsRes?.data ?? [];

  const refetchAll = () => { refetchMouv(); refetchDemandes(); refetchSucc(); refetchTalents(); };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Gestion des carrières</h1>
            <p className="text-sm text-slate-500 mt-0.5">Parcours · Plan de succession · Talents clés</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetchAll} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            {activeTab === "parcours" && (
              <button onClick={() => setShowNewMouvement(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Nouveau mouvement
              </button>
            )}
            {activeTab === "demandes" && (
              <button onClick={() => setShowNewDemande(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Nouvelle demande
              </button>
            )}
            {activeTab === "succession" && (
              <button onClick={() => setShowNewPoste(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
                <Plus className="w-4 h-4" /> Nouveau poste critique
              </button>
            )}
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {[
            { key: "parcours",   label: "Parcours",         icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { key: "demandes",   label: "Demandes",         icon: <Award      className="w-3.5 h-3.5" /> },
            { key: "succession", label: "Plan de succession",icon: <Shield     className="w-3.5 h-3.5" /> },
            { key: "talents",    label: "Talents clés",     icon: <Star       className="w-3.5 h-3.5" /> },
          ].map(({ key, label, icon }) => (
            <button key={key} onClick={() => setActiveTab(key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ════════════ PARCOURS ════════════ */}
        {activeTab === "parcours" && (
          <>
            {/* Stats par type */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setTypeFilt(typeFilt === key ? "" : key)}
                  className={`p-4 rounded-xl border text-left transition-all ${typeFilt === key ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md w-fit mb-2 ${cfg.badge}`}>{cfg.icon} <span className="text-xs font-medium">{cfg.label}</span></div>
                  <p className="text-2xl font-bold text-slate-900">{mouvStats[key] ?? 0}</p>
                </button>
              ))}
            </div>

            {/* Filtres */}
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Rechercher un collaborateur…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <select value={anneeFilt} onChange={(e) => { setAnneeFilt(e.target.value); setPage(1); }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Toutes années</option>
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Timeline mouvements */}
            {mouvLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : mouvements.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun mouvement de carrière enregistré</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {mouvements.map((m) => <MouvementRow key={m.id} mouvement={m} />)}
                </div>
              </div>
            )}

            {mouvMeta && mouvMeta.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{mouvMeta.total} mouvements</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
                  <span className="px-3 py-1.5 text-sm text-slate-600">{page}/{mouvMeta.totalPages}</span>
                  <button disabled={page >= mouvMeta.totalPages} onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════ DEMANDES DE MOUVEMENT ════════════ */}
        {activeTab === "demandes" && (
          <>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUT_DEMANDE_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setDemandeStatutFilt(demandeStatutFilt === key ? "" : key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    demandeStatutFilt === key ? "ring-1 ring-indigo-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
                  }`}>
                  {cfg.label} ({demandesStats[key] ?? 0})
                </button>
              ))}
            </div>

            {demandesLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : demandes.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Award className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune demande de mouvement de carrière</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {demandes.map((d) => <DemandeRow key={d.id} demande={d} onRefetch={refetchDemandes} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════ PLAN DE SUCCESSION ════════════ */}
        {activeTab === "succession" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Postes critiques", value: succStats.total,    icon: <Briefcase className="w-4 h-4" />, badge: "bg-slate-100 text-slate-700" },
                { label: "Couverts",         value: succStats.couverts, icon: <Shield    className="w-4 h-4" />, badge: "bg-emerald-100 text-emerald-700" },
                { label: "Sans successeur",  value: succStats.critiques,icon: <Target    className="w-4 h-4" />, badge: "bg-red-100 text-red-700" },
                { label: "Talents identifiés",value: succStats.talents, icon: <Star      className="w-4 h-4" />, badge: "bg-amber-100 text-amber-700" },
              ].map(({ label, value, icon, badge }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md w-fit mb-2 ${badge}`}>{icon}<span className="text-xs font-medium">{label}</span></div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            {succLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : postes.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Shield className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun poste critique défini</p>
                <button onClick={() => setShowNewPoste(true)}
                  className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Créer un poste critique
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {postes.map((p) => <PosteCard key={p.id} poste={p} onManage={() => setSelectedPoste(p)} onRefetch={refetchSucc} />)}
              </div>
            )}
          </>
        )}

        {/* ════════════ TALENTS CLÉS ════════════ */}
        {activeTab === "talents" && (
          <>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-600 font-medium">
                {talentsRes?.total ?? 0} talent{(talentsRes?.total ?? 0) > 1 ? "s" : ""} identifié{(talentsRes?.total ?? 0) > 1 ? "s" : ""}
              </p>
            </div>

            {talentsLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
              </div>
            ) : talents.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
                <Star className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucun talent clé identifié</p>
                <p className="text-xs mt-1">Marquez des successeurs comme &quot;Talent clé&quot; dans le plan de succession</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {talents.map((t) => <TalentCard key={t.profilRH.id} talent={t} />)}
              </div>
            )}
          </>
        )}
      </div>

      {showNewMouvement && (
        <MouvementModal
          onClose={() => setShowNewMouvement(false)}
          onCreated={() => { setShowNewMouvement(false); refetchMouv(); }} />
      )}
      {showNewDemande && (
        <DemandeModal
          onClose={() => setShowNewDemande(false)}
          onCreated={() => { setShowNewDemande(false); refetchDemandes(); }} />
      )}
      {showNewPoste && (
        <PosteModal
          onClose={() => setShowNewPoste(false)}
          onCreated={() => { setShowNewPoste(false); refetchSucc(); }} />
      )}
      {selectedPoste && (
        <GererSuccesseursModal
          poste={selectedPoste}
          onClose={() => setSelectedPoste(null)}
          onUpdated={() => { setSelectedPoste(null); refetchSucc(); refetchTalents(); }} />
      )}
    </div>
  );
}

// ── Ligne mouvement ────────────────────────────────────────────────────────────

function MouvementRow({ mouvement: m }: { mouvement: Mouvement }) {
  const [open, setOpen] = useState(false);
  const cfg  = m.type ? (TYPE_CONFIG[m.type] ?? null) : null;
  const memb = m.profilRH.gestionnaire.member;

  return (
    <div>
      <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        {/* Indicateur couleur */}
        <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${cfg?.color ?? "bg-slate-200"}`} />
        <Avatar nom={memb.nom} prenom={memb.prenom} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/dashboard/admin/rh/collaborateurs/${m.profilRH.id}`} onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-slate-800 hover:text-indigo-600">
              {memb.prenom} {memb.nom}
            </Link>
            <span className="text-xs text-slate-400 font-mono">{m.profilRH.matricule}</span>
            {cfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
            {m.ancienneFonction && <span className="line-through text-slate-400">{m.ancienneFonction}</span>}
            {(m.ancienneFonction || m.nouvelleFonction) && <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />}
            {m.nouvelleFonction && <span className="font-medium text-slate-700">{m.nouvelleFonction}</span>}
            {m.nouveauDepartement && <span className="text-slate-400">· {m.nouveauDepartement}</span>}
            <span className="text-slate-300">· {formatDate(m.createdAt)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-300">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {open && (
        <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 text-xs">
            {m.ancienneFonction  && <div><p className="text-slate-400 mb-0.5">Ancienne fonction</p><p className="font-medium text-slate-700">{m.ancienneFonction}</p></div>}
            {m.nouvelleFonction  && <div><p className="text-slate-400 mb-0.5">Nouvelle fonction</p><p className="font-medium text-slate-700">{m.nouvelleFonction}</p></div>}
            {m.ancienDepartement && <div><p className="text-slate-400 mb-0.5">Ancien département</p><p className="font-medium text-slate-700">{m.ancienDepartement}</p></div>}
            {m.nouveauDepartement&& <div><p className="text-slate-400 mb-0.5">Nouveau département</p><p className="font-medium text-slate-700">{m.nouveauDepartement}</p></div>}
            {m.ancienManager  && <div><p className="text-slate-400 mb-0.5">Ancien manager</p><p className="font-medium text-slate-700">{m.ancienManager.prenom} {m.ancienManager.nom}</p></div>}
            {m.nouveauManager && <div><p className="text-slate-400 mb-0.5">Nouveau manager</p><p className="font-medium text-slate-700">{m.nouveauManager.prenom} {m.nouveauManager.nom}</p></div>}
            {m.ancienSalaire  !== null && <div><p className="text-slate-400 mb-0.5">Ancien salaire</p><p className="font-medium text-slate-700">{Number(m.ancienSalaire).toLocaleString()} FCFA</p></div>}
            {m.nouveauSalaire !== null && <div><p className="text-slate-400 mb-0.5">Nouveau salaire</p><p className="font-medium text-slate-700">{Number(m.nouveauSalaire).toLocaleString()} FCFA</p></div>}
          </div>
          {m.motif && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-0.5">Motif</p>
              <p className="text-sm text-slate-700">{m.motif}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Card poste critique ────────────────────────────────────────────────────────

function PosteCard({ poste: p, onManage, onRefetch }: { poste: PosteCritique; onManage: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/carrieres/plan-succession/${p.id}`, "PATCH");
  const couvert = p.successeurs.length >= p.nbSuccesseursRequis;
  const danger  = p.successeurs.length === 0;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${danger ? "border-red-200" : couvert ? "border-emerald-200" : "border-slate-200"}`}>
      <div className={`px-5 py-3 border-b flex items-start justify-between gap-2 ${danger ? "bg-red-50" : couvert ? "bg-emerald-50" : "bg-slate-50"}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-800 text-sm">{p.titre}</p>
            {!p.actif && <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">Inactif</span>}
          </div>
          {p.departement && <p className="text-xs text-slate-400 mt-0.5">{p.departement}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${danger ? "bg-red-100 text-red-700" : couvert ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {p.successeurs.length}/{p.nbSuccesseursRequis}
          </span>
          <button onClick={async () => {
            const r = await mutate({ actif: !p.actif });
            if (r) { toast.success(p.actif ? "Poste désactivé" : "Poste activé"); onRefetch(); }
          }} disabled={loading} className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50">
            {p.actif ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {p.description && <p className="text-xs text-slate-500 mb-2">{p.description}</p>}
        {p.successeurs.length === 0 && (
          <p className="text-xs text-red-500 italic">Aucun successeur identifié — poste non couvert</p>
        )}
        {p.successeurs.map((s) => {
          const rcfg = READINESS_CONFIG[s.readiness];
          const m    = s.profilRH.gestionnaire.member;
          return (
            <div key={s.id} className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-lg">
              <Avatar nom={m.nom} prenom={m.prenom} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{m.prenom} {m.nom}</p>
                <p className="text-xs text-slate-400 truncate">{s.profilRH.fonction ?? s.profilRH.departement ?? ""}</p>
              </div>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${rcfg?.badge}`}>
                {rcfg?.short ?? s.readiness}
              </span>
              {s.estTalentCle && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />}
            </div>
          );
        })}
        <button onClick={onManage}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 mt-1">
          <Users className="w-3.5 h-3.5" /> Gérer les successeurs
        </button>
      </div>
    </div>
  );
}

// ── Card talent clé ────────────────────────────────────────────────────────────

function TalentCard({ talent: t }: { talent: Talent }) {
  const m    = t.profilRH.gestionnaire.member;
  const rcfg = READINESS_CONFIG[t.readiness];
  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <Avatar nom={m.nom} prenom={m.prenom} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{m.prenom} {m.nom}</p>
          <p className="text-xs text-slate-400 truncate">{t.profilRH.fonction ?? "—"} · {t.profilRH.departement ?? "—"}</p>
        </div>
        <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />
      </div>
      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Préparation</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rcfg?.badge}`}>{rcfg?.label ?? t.readiness}</span>
        </div>
        {t.profilRH.planCarriere?.prochainPosteVise && (
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <p className="text-xs text-slate-600 truncate">{t.profilRH.planCarriere.prochainPosteVise}</p>
          </div>
        )}
        {t.postes.length > 0 && (
          <div>
            <p className="text-xs text-slate-400 mb-1">Successeur potentiel pour :</p>
            <div className="flex flex-wrap gap-1">
              {t.postes.map((p) => (
                <span key={p.id} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{p.titre}</span>
              ))}
            </div>
          </div>
        )}
        {t.profilRH.competences.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {t.profilRH.competences.slice(0, 3).map((c, i) => (
              <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{c.competence.nom}</span>
            ))}
          </div>
        )}
        <Link href={`/dashboard/admin/rh/collaborateurs/${t.profilRH.id}`}
          className="flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 pt-1">
          Voir le profil <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

// ── Modal nouveau mouvement ────────────────────────────────────────────────────

function MouvementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/carrieres/mouvements", "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", type: "PROMOTION",
    ancienneFonction: "", nouvelleFonction: "",
    ancienDepartement: "", nouveauDepartement: "",
    ancienSalaire: "", nouveauSalaire: "",
    motif: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type) { toast.error("Collaborateur et type requis"); return; }
    const result = await mutate({
      profilRHId:        Number(form.profilRHId),
      type:              form.type,
      ancienneFonction:  form.ancienneFonction   || undefined,
      nouvelleFonction:  form.nouvelleFonction   || undefined,
      ancienDepartement: form.ancienDepartement  || undefined,
      nouveauDepartement:form.nouveauDepartement || undefined,
      ancienSalaire:     form.ancienSalaire      ? Number(form.ancienSalaire)  : undefined,
      nouveauSalaire:    form.nouveauSalaire     ? Number(form.nouveauSalaire) : undefined,
      motif:             form.motif              || undefined,
    });
    if (result) { toast.success("Mouvement enregistré"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau mouvement de carrière</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <EField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </EField>

          <EField label="Type de mouvement *">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => set("type", k)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                    form.type === k ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </EField>

          <div className="grid grid-cols-2 gap-3">
            <EField label="Ancienne fonction">
              <input value={form.ancienneFonction} onChange={(e) => set("ancienneFonction", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Technicien" />
            </EField>
            <EField label="Nouvelle fonction">
              <input value={form.nouvelleFonction} onChange={(e) => set("nouvelleFonction", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Chef d'équipe" />
            </EField>
            <EField label="Ancien département">
              <input value={form.ancienDepartement} onChange={(e) => set("ancienDepartement", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Commercial" />
            </EField>
            <EField label="Nouveau département">
              <input value={form.nouveauDepartement} onChange={(e) => set("nouveauDepartement", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Direction" />
            </EField>
            <EField label="Ancien salaire (FCFA)">
              <input type="number" value={form.ancienSalaire} onChange={(e) => set("ancienSalaire", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="150000" />
            </EField>
            <EField label="Nouveau salaire (FCFA)">
              <input type="number" value={form.nouveauSalaire} onChange={(e) => set("nouveauSalaire", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="200000" />
            </EField>
          </div>

          <EField label="Motif / Contexte">
            <textarea value={form.motif} onChange={(e) => set("motif", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Raison du mouvement, contexte…" />
          </EField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ligne demande de mouvement de carrière ─────────────────────────────────────

function DemandeRow({ demande: d, onRefetch }: { demande: DemandeCarriere; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/carrieres/demandes/${d.id}`, "PATCH");
  const cfg    = TYPE_CONFIG[d.type] ?? null;
  const statutCfg = STATUT_DEMANDE_CONFIG[d.statut] ?? STATUT_DEMANDE_CONFIG.EN_ATTENTE;
  const member = d.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    let commentaire: string | undefined;
    if (action === "REJETER") {
      commentaire = window.prompt("Motif du refus (facultatif) :") ?? undefined;
    }
    const result = await mutate({ action, commentaire });
    if (result) { toast.success("Demande mise à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
      <Avatar nom={member.nom} prenom={member.prenom} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{member.prenom} {member.nom}</span>
          <span className="text-xs text-slate-400 font-mono">{d.profilRH.matricule}</span>
          {cfg && <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutCfg.badge}`}>{statutCfg.label}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
          {d.nouvelleFonction && <span>→ {d.nouvelleFonction}</span>}
          {d.nouveauDepartement && <span>→ {d.nouveauDepartement}</span>}
          {d.nouveauSalaire != null && <span>→ {new Intl.NumberFormat("fr-FR").format(d.nouveauSalaire)} FCFA</span>}
        </div>
        {d.motif && <p className="text-xs text-slate-400 mt-0.5 italic">{d.motif}</p>}
        {d.commentaireRefus && <p className="text-xs text-red-500 mt-0.5">Motif refus : {d.commentaireRefus}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {d.statut === "EN_ATTENTE" && (
          <button disabled={loading} onClick={() => doAction("VALIDER_RH")}
            className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50">Valider RH</button>
        )}
        {(d.statut === "EN_ATTENTE" || d.statut === "VALIDE_RH") && (
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

// ── Modal nouvelle demande de mouvement de carrière ────────────────────────────

function DemandeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/carrieres/demandes", "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", type: "PROMOTION",
    nouvelleFonction: "", nouveauDepartement: "", nouveauSalaire: "",
    motif: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type) { toast.error("Collaborateur et type requis"); return; }
    const result = await mutate({
      profilRHId:         Number(form.profilRHId),
      type:               form.type,
      nouvelleFonction:   form.nouvelleFonction   || undefined,
      nouveauDepartement: form.nouveauDepartement || undefined,
      nouveauSalaire:     form.nouveauSalaire     ? Number(form.nouveauSalaire) : undefined,
      motif:              form.motif              || undefined,
    });
    if (result) { toast.success("Demande soumise"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de mouvement</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <EField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </EField>

          <EField label="Type de mouvement *">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TYPE_CONFIG).map(([k, cfg]) => (
                <button key={k} type="button" onClick={() => set("type", k)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-all ${
                    form.type === k ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </EField>

          <div className="grid grid-cols-2 gap-3">
            <EField label="Nouvelle fonction">
              <input value={form.nouvelleFonction} onChange={(e) => set("nouvelleFonction", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Chef d'équipe" />
            </EField>
            <EField label="Nouveau département">
              <input value={form.nouveauDepartement} onChange={(e) => set("nouveauDepartement", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Direction" />
            </EField>
            <EField label="Nouveau salaire (FCFA)">
              <input type="number" value={form.nouveauSalaire} onChange={(e) => set("nouveauSalaire", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="200000" />
            </EField>
          </div>

          <EField label="Motif / Contexte">
            <textarea value={form.motif} onChange={(e) => set("motif", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Raison de la demande, contexte…" />
          </EField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal nouveau poste critique ───────────────────────────────────────────────

function PosteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/carrieres/plan-succession", "POST");
  const [form, setForm] = useState({ titre: "", departement: "", description: "", nbSuccesseursRequis: "2" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titre.trim()) { toast.error("Titre requis"); return; }
    const result = await mutate({
      titre:               form.titre,
      departement:         form.departement    || null,
      description:         form.description   || null,
      nbSuccesseursRequis: Number(form.nbSuccesseursRequis),
    });
    if (result) { toast.success("Poste critique créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau poste critique</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <EField label="Titre du poste *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: Directeur Commercial" />
          </EField>
          <div className="grid grid-cols-2 gap-3">
            <EField label="Département">
              <input value={form.departement} onChange={(e) => set("departement", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ex: Commercial" />
            </EField>
            <EField label="Successeurs requis">
              <input type="number" min={1} max={10} value={form.nbSuccesseursRequis}
                onChange={(e) => set("nbSuccesseursRequis", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </EField>
          </div>
          <EField label="Description">
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Rôle stratégique, responsabilités clés…" />
          </EField>
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

// ── Modal gérer successeurs ────────────────────────────────────────────────────

function GererSuccesseursModal({ poste: p, onClose, onUpdated }: { poste: PosteCritique; onClose: () => void; onUpdated: () => void }) {
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [successeurs, setSuccesseurs] = useState(p.successeurs);
  const [showAdd,     setShowAdd]     = useState(false);
  const [addForm,     setAddForm]     = useState({ profilRHId: "", readiness: "EN_DEVELOPPEMENT", estTalentCle: false, notes: "" });
  const [saving,      setSaving]      = useState(false);

  const handleAdd = async () => {
    if (!addForm.profilRHId || !addForm.readiness) { toast.error("Collaborateur et readiness requis"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rh/carrieres/plan-succession/${p.id}/successeurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profilRHId:   Number(addForm.profilRHId),
          readiness:    addForm.readiness,
          estTalentCle: addForm.estTalentCle,
          notes:        addForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setSuccesseurs((prev) => {
        const idx = prev.findIndex((s) => s.profilRH.id === data.data.profilRHId);
        return idx >= 0 ? prev.map((s, i) => i === idx ? data.data : s) : [...prev, data.data];
      });
      setShowAdd(false);
      setAddForm({ profilRHId: "", readiness: "EN_DEVELOPPEMENT", estTalentCle: false, notes: "" });
      toast.success("Successeur ajouté");
    } finally { setSaving(false); }
  };

  const handleToggleTalent = async (s: typeof successeurs[0]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rh/carrieres/plan-succession/${p.id}/successeurs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilRHId: s.profilRH.id, readiness: s.readiness, estTalentCle: !s.estTalentCle, notes: s.notes }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      setSuccesseurs((prev) => prev.map((x) => x.profilRH.id === s.profilRH.id ? { ...x, estTalentCle: !s.estTalentCle } : x));
      toast.success(s.estTalentCle ? "Talent retiré" : "Marqué talent clé");
    } finally { setSaving(false); }
  };

  const handleRemove = async (profilRHId: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rh/carrieres/plan-succession/${p.id}/successeurs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilRHId }),
      });
      if (!res.ok) { toast.error("Erreur"); return; }
      setSuccesseurs((prev) => prev.filter((s) => s.profilRH.id !== profilRHId));
      toast.success("Successeur retiré");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{p.titre}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{successeurs.length}/{p.nbSuccesseursRequis} successeur(s) requis</p>
          </div>
          <button onClick={() => { onUpdated(); onClose(); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {successeurs.length === 0 && !showAdd && (
            <div className="text-center py-8 text-slate-400">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun successeur</p>
            </div>
          )}

          {successeurs.map((s) => {
            const m    = s.profilRH.gestionnaire.member;
            const rcfg = READINESS_CONFIG[s.readiness];
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl">
                <Avatar nom={m.nom} prenom={m.prenom} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.prenom} {m.nom}</p>
                  <p className="text-xs text-slate-400">{s.profilRH.fonction ?? s.profilRH.departement ?? ""}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rcfg?.badge}`}>{rcfg?.short}</span>
                <button onClick={() => handleToggleTalent(s)} disabled={saving} title={s.estTalentCle ? "Retirer talent clé" : "Marquer talent clé"}
                  className="disabled:opacity-50">
                  <Star className={`w-4 h-4 ${s.estTalentCle ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-300"}`} />
                </button>
                <button onClick={() => handleRemove(s.profilRH.id)} disabled={saving}
                  className="text-slate-300 hover:text-red-400 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {!showAdd ? (
            <button onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-sm text-indigo-600 font-medium border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50">
              <Plus className="w-4 h-4" /> Ajouter un successeur
            </button>
          ) : (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
              <EField label="Collaborateur *">
                <select value={addForm.profilRHId} onChange={(e) => setAddForm((f) => ({ ...f, profilRHId: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  <option value="">— Sélectionner —</option>
                  {collabs.filter((c) => !successeurs.some((s) => s.profilRH.id === c.id))
                    .map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
                </select>
              </EField>
              <EField label="Niveau de préparation *">
                <select value={addForm.readiness} onChange={(e) => setAddForm((f) => ({ ...f, readiness: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500">
                  {Object.entries(READINESS_CONFIG).map(([k, cfg]) => <option key={k} value={k}>{cfg.label}</option>)}
                </select>
              </EField>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={addForm.estTalentCle}
                  onChange={(e) => setAddForm((f) => ({ ...f, estTalentCle: e.target.checked }))}
                  className="rounded border-slate-300" />
                <Star className="w-3.5 h-3.5 text-amber-400" /> Talent clé
              </label>
              <EField label="Notes">
                <input value={addForm.notes} onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Observations…" />
              </EField>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)}
                  className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Ajouter
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>Mise à jour : maintenant</span>
          </div>
          <button onClick={() => { onUpdated(); onClose(); }}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}
