"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus, X, Save, Trash2,
  DollarSign, CheckCircle, Clock, CreditCard, ArrowLeft,
  ChevronDown, ChevronUp, User, Eye, BarChart2,
  Send, Settings, TrendingUp, Banknote,
  ShieldCheck, Play, Info, Download,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Composant { id?: number; type: string; libelle: string; montant: number; isRetenue: boolean }

interface FichePaie {
  id: number; mois: number; annee: number;
  salaireBase: number; totalBrut: number; totalRetenues: number; netAPayer: number;
  statut: string; fichierUrl: string | null; notes: string | null; createdAt: string;
  modePaiement: string | null;
  composants: Composant[];
  profilRH: {
    id: number; matricule: string; fonction?: string; departement?: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
}

interface FichesResponse {
  data: FichePaie[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

interface Avance {
  id: number; montant: number; montantRestant: number; statut: string;
  motif: string | null; echeancesMois: number; createdAt: string;
  profilRH: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } };
}

interface Pret {
  id: number; montant: number; montantRestant: number; montantMensuel: number;
  tauxInteret: number; dureesMois: number; statut: string; notes: string | null; createdAt: string;
  profilRH: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } };
}

interface ListResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface GrilleSalariale { id: number; categorie: string; niveau: string; salaireMin: number; salaireMax: number; salaireBase: number }
interface TypeComposant   { id: number; code: string; libelle: string; type: string; description: string | null }
interface Bareme          { id: number; nom: string; type: string; valeur: number | null; paliers: unknown }

interface DashboardData {
  annee: number; moisCourant: number;
  masseMensuelle: { mois: number; netAPayer: number; totalBrut: number; totalRetenues: number }[];
  totauxAnnee: { netAPayer: number; totalBrut: number; totalRetenues: number };
  statuts: Record<string, number>;
  avancesEnCours: { count: number; montantTotal: number };
  pretsEnCours: { count: number; montantTotal: number };
  parDepartement: Record<string, number>;
  composantsMoisCourant?: Record<string, number>;
}

interface OrdreItem {
  id: number; mois: number; annee: number; netAPayer: number;
  statut: string; modePaiement: string | null;
  profilRH: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } };
}

// ── Constantes ───────────────────────────────────────────────────────────────

const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i);

const STATUT_CFG: Record<string, { label: string; badge: string; icon: React.ReactNode; short: string }> = {
  BROUILLON:   { label: "Brouillon",    badge: "bg-slate-100 text-slate-600",    icon: <Clock       className="w-3 h-3" />, short: "Brouillon" },
  CONTROLE:    { label: "En contrôle",  badge: "bg-yellow-100 text-yellow-700",  icon: <ShieldCheck className="w-3 h-3" />, short: "Contrôle" },
  VALIDE:      { label: "Validée",      badge: "bg-blue-100 text-blue-700",      icon: <CheckCircle className="w-3 h-3" />, short: "Validée" },
  EN_PAIEMENT: { label: "En paiement",  badge: "bg-purple-100 text-purple-700",  icon: <Send        className="w-3 h-3" />, short: "Paiement" },
  PAYE:        { label: "Payée",        badge: "bg-emerald-100 text-emerald-700",icon: <CreditCard  className="w-3 h-3" />, short: "Payée" },
};

const AVANCE_STATUT: Record<string, string> = {
  EN_ATTENTE: "bg-yellow-100 text-yellow-700",
  APPROUVE:   "bg-blue-100 text-blue-700",
  REJETE:     "bg-red-100 text-red-600",
  REMBOURSE:  "bg-emerald-100 text-emerald-700",
};

const PRET_STATUT: Record<string, string> = {
  EN_COURS:  "bg-blue-100 text-blue-700",
  SOLDE:     "bg-emerald-100 text-emerald-700",
  EN_DEFAUT: "bg-red-100 text-red-600",
};

const TYPE_COMPOSANT_OPTS = [
  { value: "SALAIRE_BASE",            label: "Salaire de base",         isRetenue: false },
  { value: "PRIME_PERFORMANCE",       label: "Prime de performance",    isRetenue: false },
  { value: "PRIME_ANCIENNETE",        label: "Prime d'ancienneté",      isRetenue: false },
  { value: "PRIME_TRANSPORT",         label: "Prime de transport",      isRetenue: false },
  { value: "PRIME_LOGEMENT",          label: "Prime de logement",       isRetenue: false },
  { value: "PRIME_FONCTION",          label: "Prime de fonction",       isRetenue: false },
  { value: "PRIME_RESPONSABILITE",    label: "Prime de responsabilité", isRetenue: false },
  { value: "COMMISSION",              label: "Commission",              isRetenue: false },
  { value: "BONUS",                   label: "Bonus",                   isRetenue: false },
  { value: "PRIME_EXCEPTIONNELLE",    label: "Prime exceptionnelle",    isRetenue: false },
  { value: "HEURES_SUPPLEMENTAIRES",  label: "Heures supplémentaires",  isRetenue: false },
  { value: "INDEMNITE_MISSION",       label: "Indemnité de mission",    isRetenue: false },
  { value: "AUTRE_GAIN",              label: "Autre gain",              isRetenue: false },
  { value: "DEDUCTION_ABSENCE",       label: "Déduction absence",       isRetenue: true  },
  { value: "DEDUCTION_RETARD",        label: "Déduction retard",        isRetenue: true  },
  { value: "COTISATION_RETRAITE",     label: "Cotisation retraite",     isRetenue: true  },
  { value: "COTISATION_SANTE",        label: "Cotisation santé",        isRetenue: true  },
  { value: "IMPOT_REVENU",            label: "Impôt sur le revenu",     isRetenue: true  },
  { value: "AVANCE_SUR_SALAIRE",      label: "Avance sur salaire",      isRetenue: true  },
  { value: "REMBOURSEMENT_PRET",      label: "Remboursement prêt",      isRetenue: true  },
  { value: "SANCTION_FINANCIERE",     label: "Sanction financière",     isRetenue: true  },
  { value: "AUTRE_RETENUE",           label: "Autre retenue",           isRetenue: true  },
];

const TABS = [
  { id: "fiches",   label: "Fiches de paie", icon: <DollarSign className="w-4 h-4" /> },
  { id: "avances",  label: "Avances & Prêts",icon: <Banknote   className="w-4 h-4" /> },
  { id: "ordres",   label: "Paiements",       icon: <Send       className="w-4 h-4" /> },
  { id: "config",   label: "Configuration",   icon: <Settings   className="w-4 h-4" /> },
  { id: "dashboard",label: "Tableau de bord", icon: <TrendingUp className="w-4 h-4" /> },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

// ── Page principale ───────────────────────────────────────────────────────────

export default function PaiePage() {
  const [activeTab, setActiveTab] = useState("fiches");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto space-y-5">

        {/* En-tête */}
        <div>
          <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Dashboard RH
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Paie & Rémunération</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion complète des salaires, avances, prêts et bulletins</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Contenu de l'onglet actif */}
        {activeTab === "fiches"    && <FichesTab />}
        {activeTab === "avances"   && <AvancesPretsTab />}
        {activeTab === "ordres"    && <OrdresPaiementTab />}
        {activeTab === "config"    && <ConfigTab />}
        {activeTab === "dashboard" && <DashboardTab />}

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — FICHES DE PAIE
// ════════════════════════════════════════════════════════════════════════════

function FichesTab() {
  const [statut, setStatut] = useState("");
  const [annee,  setAnnee]  = useState(String(ANNEE_COURANTE));
  const [mois,   setMois]   = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState<FichePaie | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (annee)  params.set("annee",  annee);
  if (mois)   params.set("mois",   mois);
  if (search) params.set("search", search);
  params.set("page", String(page));
  params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<FichesResponse>(`/api/admin/rh/paie?${params}`);
  const fiches = res?.data ?? [];
  const meta   = res?.meta;
  const stats  = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  return (
    <div className="space-y-5">
      {/* Stats KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUT_CFG).map(([key, cfg]) => (
          <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
            className={`p-3 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`p-1 rounded-md ${cfg.badge}`}>{cfg.icon}</span>
            </div>
            <p className="text-xl font-bold text-slate-900">{stats[key] ?? 0}</p>
            <p className="text-xs text-slate-500">{cfg.short}</p>
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select value={annee} onChange={(e) => { setAnnee(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes années</option>
            {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={mois} onChange={(e) => { setMois(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Tous mois</option>
            {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
          </select>
        </div>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Nouvelle fiche
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : fiches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
          <DollarSign className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune fiche de paie trouvée</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {fiches.map((f) => (
              <FicheRow key={f.id} fiche={f} onOpen={() => setSelected(f)} onRefetch={refetch} />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{meta.total} fiches</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
            <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
          </div>
        </div>
      )}

      {showCreate && <CreateFicheModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {selected   && <FicheDetailModal fiche={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />}
    </div>
  );
}

function FicheRow({ fiche, onOpen, onRefetch }: { fiche: FichePaie; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/${fiche.id}`, "PATCH");
  const cfg    = STATUT_CFG[fiche.statut] ?? STATUT_CFG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    const result = await mutate({ action, ...extra });
    if (result) { toast.success("Statut mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/admin/rh/collaborateurs/${fiche.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-emerald-600">
            {member.prenom} {member.nom}
          </Link>
          <span className="text-xs text-slate-400 font-mono">{fiche.profilRH.matricule}</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>{MOIS_LABELS[fiche.mois]} {fiche.annee}</span>
          <span>Brut : <b className="text-slate-700">{fmt(fiche.totalBrut)}</b></span>
          <span>Net : <b className="text-emerald-700">{fmt(fiche.netAPayer)} FCFA</b></span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
        {fiche.statut === "BROUILLON" && (
          <button onClick={() => doAction("SOUMETTRE_CONTROLE")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50">
            Contrôle
          </button>
        )}
        {fiche.statut === "CONTROLE" && (
          <button onClick={() => doAction("VALIDER")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
            Valider
          </button>
        )}
        {fiche.statut === "VALIDE" && (
          <button onClick={() => doAction("METTRE_EN_PAIEMENT")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50">
            Paiement
          </button>
        )}
        {fiche.statut === "EN_PAIEMENT" && (
          <button onClick={() => doAction("MARQUER_PAYE")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
            Marquer payée
          </button>
        )}
        <button onClick={onOpen} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function CreateFicheModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/paie", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({ profilRHId: "", mois: String(new Date().getMonth() + 1), annee: String(ANNEE_COURANTE), salaireBase: "", notes: "" });
  const [composants, setComposants] = useState<Composant[]>([]);
  const [showComp,   setShowComp]   = useState(false);
  const [newComp,    setNewComp]    = useState({ type: "", libelle: "", montant: "", isRetenue: false });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addComp = () => {
    if (!newComp.type || !newComp.montant) { toast.error("Type et montant obligatoires"); return; }
    const opt = TYPE_COMPOSANT_OPTS.find((o) => o.value === newComp.type);
    setComposants((prev) => [...prev, { type: newComp.type, libelle: newComp.libelle || (opt?.label ?? newComp.type), montant: Number(newComp.montant), isRetenue: opt?.isRetenue ?? newComp.isRetenue }]);
    setNewComp({ type: "", libelle: "", montant: "", isRetenue: false });
  };

  const totalBrut     = composants.filter((c) => !c.isRetenue).reduce((s, c) => s + c.montant, Number(form.salaireBase || 0));
  const totalRetenues = composants.filter((c) =>  c.isRetenue).reduce((s, c) => s + c.montant, 0);
  const netAPayer     = totalBrut - totalRetenues;

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.mois || !form.annee) { toast.error("Collaborateur, mois et année obligatoires"); return; }
    const result = await mutate({ profilRHId: Number(form.profilRHId), mois: Number(form.mois), annee: Number(form.annee), salaireBase: Number(form.salaireBase || 0), composants, notes: form.notes || null });
    if (result) { toast.success("Fiche créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle fiche de paie</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <PField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </PField>
          <div className="grid grid-cols-3 gap-3">
            <PField label="Mois *">
              <select value={form.mois} onChange={(e) => set("mois", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
              </select>
            </PField>
            <PField label="Année *">
              <select value={form.annee} onChange={(e) => set("annee", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </PField>
            <PField label="Salaire de base">
              <input type="number" value={form.salaireBase} onChange={(e) => set("salaireBase", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
          </div>

          {/* Info retenues auto */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-800">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>À la création : <strong>commissions</strong> (barème du rôle × activité : ventes, crédits, packs, recouvrements) ajoutées en gains ; <strong>prêts</strong> + <strong>avances</strong> + <strong>absences</strong> (depuis les pointages) en retenues. Soldes prêts/avances décrémentés.</span>
          </div>

          {/* Composants */}
          <div>
            <button onClick={() => setShowComp((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              {showComp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Composants ({composants.length})
            </button>
            {showComp && (
              <div className="space-y-2 p-4 bg-slate-50 rounded-xl">
                {composants.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${c.isRetenue ? "bg-red-400" : "bg-emerald-400"}`} />
                    <span className="flex-1 text-slate-700">{c.libelle}</span>
                    <span className={`font-medium ${c.isRetenue ? "text-red-600" : "text-emerald-600"}`}>{c.isRetenue ? "-" : "+"}{fmt(c.montant)}</span>
                    <button onClick={() => setComposants((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <select value={newComp.type}
                    onChange={(e) => {
                      const opt = TYPE_COMPOSANT_OPTS.find((o) => o.value === e.target.value);
                      setNewComp((n) => ({ ...n, type: e.target.value, isRetenue: opt?.isRetenue ?? false, libelle: opt?.label ?? "" }));
                    }}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none">
                    <option value="">Type…</option>
                    {TYPE_COMPOSANT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={newComp.montant} onChange={(e) => setNewComp((n) => ({ ...n, montant: e.target.value }))}
                    type="number" placeholder="Montant"
                    className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none" />
                  <button onClick={addComp} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Récap */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total brut</span><span className="font-medium">{fmt(totalBrut)} FCFA</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total retenues</span><span className="font-medium text-red-600">-{fmt(totalRetenues)} FCFA</span></div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-semibold text-slate-700">Net à payer</span>
              <span className="font-bold text-emerald-700">{fmt(netAPayer)} FCFA</span>
            </div>
          </div>

          <PField label="Notes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
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

function FicheDetailModal({ fiche, onClose, onUpdated }: { fiche: FichePaie; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/${fiche.id}`, "PATCH");
  const [fichierUrl,    setFichierUrl]    = useState(fiche.fichierUrl ?? "");
  const [modePaiement,  setModePaiement]  = useState(fiche.modePaiement ?? "VIREMENT");
  const cfg    = STATUT_CFG[fiche.statut] ?? STATUT_CFG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;
  const gains  = fiche.composants.filter((c) => !c.isRetenue);
  const retenues = fiche.composants.filter((c) => c.isRetenue);

  const doAction = async (action: string, extra?: Record<string, unknown>) => {
    const result = await mutate({ action, ...extra });
    if (result) { toast.success("Statut mis à jour"); onUpdated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{MOIS_LABELS[fiche.mois]} {fiche.annee}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <User className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500">{member.prenom} {member.nom} — {fiche.profilRH.matricule}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {gains.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Gains</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Salaire de base</span><span className="font-medium text-slate-700">{fmt(fiche.salaireBase)}</span>
                </div>
                {gains.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{c.libelle}</span>
                    <span className="font-medium text-emerald-700">+{fmt(c.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {retenues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Retenues</p>
              <div className="space-y-1">
                {retenues.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{c.libelle}</span>
                    <span className="font-medium text-red-600">-{fmt(c.montant)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm border border-slate-200">
            <div className="flex justify-between"><span className="text-slate-500">Total brut</span><span>{fmt(fiche.totalBrut)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total retenues</span><span className="text-red-600">-{fmt(fiche.totalRetenues)}</span></div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-bold text-slate-700">Net à payer</span>
              <span className="font-bold text-emerald-700">{fmt(fiche.netAPayer)} FCFA</span>
            </div>
          </div>

          {fiche.statut === "VALIDE" && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Mode de paiement</p>
              <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="VIREMENT">Virement bancaire</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="ESPECES">Espèces</option>
                <option value="CHEQUE">Chèque</option>
              </select>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Fichier PDF</p>
            <div className="flex gap-2">
              <input value={fichierUrl} onChange={(e) => setFichierUrl(e.target.value)} placeholder="https://…"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={async () => { const r = await mutate({ fichierUrl: fichierUrl || null }); if (r) { toast.success("Fichier lié"); onUpdated(); } }} disabled={loading}
                className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Save className="w-4 h-4" /></button>
            </div>
          </div>

          {fiche.notes && <p className="text-xs text-slate-400 italic">{fiche.notes}</p>}
          <p className="text-xs text-slate-400">Créée le {formatDate(fiche.createdAt)}</p>
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2">
            {(fiche.statut === "PAYE" || fiche.statut === "EN_PAIEMENT") && (
              <Link href={`/dashboard/admin/rh/paie/${fiche.id}/bulletin`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
                Bulletin
              </Link>
            )}
            {(fiche.statut === "VALIDE" || fiche.statut === "CONTROLE") && (
              <button onClick={() => doAction("REPASSER_BROUILLON")} disabled={loading}
                className="px-3 py-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                Brouillon
              </button>
            )}
            {fiche.statut === "CONTROLE" && (
              <button onClick={() => doAction("REFUSER_CONTROLE")} disabled={loading}
                className="px-3 py-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
                Refuser
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Fermer</button>
            {fiche.statut === "BROUILLON" && (
              <button onClick={() => doAction("SOUMETTRE_CONTROLE")} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50">
                <ShieldCheck className="w-4 h-4" /> Contrôle
              </button>
            )}
            {fiche.statut === "CONTROLE" && (
              <button onClick={() => doAction("VALIDER")} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Valider
              </button>
            )}
            {fiche.statut === "VALIDE" && (
              <button onClick={() => doAction("METTRE_EN_PAIEMENT", { modePaiement })} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Mettre en paiement
              </button>
            )}
            {fiche.statut === "EN_PAIEMENT" && (
              <button onClick={() => doAction("MARQUER_PAYE")} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Marquer payée
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — AVANCES & PRÊTS
// ════════════════════════════════════════════════════════════════════════════

function AvancesPretsTab() {
  const [sub, setSub] = useState<"avances" | "prets">("avances");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit bg-slate-100 rounded-lg p-1">
        {(["avances", "prets"] as const).map((s) => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${sub === s ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-800"}`}>
            {s === "avances" ? "Avances sur salaire" : "Prêts employés"}
          </button>
        ))}
      </div>
      {sub === "avances" ? <AvancesSubTab /> : <PretsSubTab />}
    </div>
  );
}

function AvancesSubTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [statutFilter, setStatutFilter] = useState("");

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  params.set("limit", "30");

  const { data: res, loading, refetch } = useApi<ListResponse<Avance>>(`/api/admin/rh/paie/avances?${params}`);
  const avances = res?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Tous statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="APPROUVE">Approuvée</option>
          <option value="REJETE">Rejetée</option>
          <option value="REMBOURSE">Remboursée</option>
        </select>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 ml-auto">
          <Plus className="w-4 h-4" /> Nouvelle avance
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : avances.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-12 text-slate-400">
          <Banknote className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">Aucune avance</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {avances.map((a) => <AvanceRow key={a.id} avance={a} onRefetch={refetch} />)}
        </div>
      )}

      {showCreate && <AvanceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function AvanceRow({ avance, onRefetch }: { avance: Avance; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/avances/${avance.id}`, "PATCH");
  const member = avance.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    const r = await mutate({ action });
    if (r) { toast.success("Avance mise à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</span>
          <span className="text-xs text-slate-400 font-mono">{avance.profilRH.matricule}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${AVANCE_STATUT[avance.statut] ?? "bg-slate-100 text-slate-600"}`}>{avance.statut.replace("_", " ")}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>Montant : <b className="text-slate-700">{fmt(avance.montant)} FCFA</b></span>
          {avance.montantRestant > 0 && avance.statut === "APPROUVE" && (
            <span>Restant : <b className="text-orange-600">{fmt(avance.montantRestant)} FCFA</b></span>
          )}
          {avance.motif && <span>{avance.motif}</span>}
          <span>{formatDate(avance.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
        {avance.statut === "EN_ATTENTE" && (
          <>
            <button onClick={() => doAction("APPROUVER")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
              Approuver
            </button>
            <button onClick={() => doAction("REJETER")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
              Rejeter
            </button>
          </>
        )}
        {avance.statut === "APPROUVE" && (
          <button onClick={() => doAction("REMBOURSER")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
            Solder
          </button>
        )}
      </div>
    </div>
  );
}

function AvanceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/paie/avances", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const [form, setForm] = useState({ profilRHId: "", montant: "", motif: "", echeancesMois: "1" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.montant) { toast.error("Collaborateur et montant obligatoires"); return; }
    const r = await mutate({ profilRHId: Number(form.profilRHId), montant: Number(form.montant), motif: form.motif || null, echeancesMois: Number(form.echeancesMois) });
    if (r) { toast.success("Avance créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle avance sur salaire</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <PField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </PField>
          <div className="grid grid-cols-2 gap-3">
            <PField label="Montant *">
              <input type="number" value={form.montant} onChange={(e) => set("montant", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
            <PField label="Échéances (mois)">
              <input type="number" min="1" value={form.echeancesMois} onChange={(e) => set("echeancesMois", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
          </div>
          <PField label="Motif">
            <input value={form.motif} onChange={(e) => set("motif", e.target.value)} placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
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

function PretsSubTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [statutFilter, setStatutFilter] = useState("");

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  params.set("limit", "30");

  const { data: res, loading, refetch } = useApi<ListResponse<Pret>>(`/api/admin/rh/paie/prets?${params}`);
  const prets = res?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Tous statuts</option>
          <option value="EN_COURS">En cours</option>
          <option value="SOLDE">Soldé</option>
          <option value="EN_DEFAUT">En défaut</option>
        </select>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 ml-auto">
          <Plus className="w-4 h-4" /> Nouveau prêt
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : prets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-12 text-slate-400">
          <CreditCard className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">Aucun prêt</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {prets.map((p) => <PretRow key={p.id} pret={p} onRefetch={refetch} />)}
        </div>
      )}

      {showCreate && <PretModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
    </div>
  );
}

function PretRow({ pret, onRefetch }: { pret: Pret; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/prets/${pret.id}`, "PATCH");
  const member = pret.profilRH.gestionnaire.member;
  const progres = Math.round(((pret.montant - pret.montantRestant) / pret.montant) * 100);

  const doAction = async (action: string) => {
    const r = await mutate({ action });
    if (r) { toast.success("Prêt mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</span>
          <span className="text-xs text-slate-400 font-mono">{pret.profilRH.matricule}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRET_STATUT[pret.statut] ?? "bg-slate-100 text-slate-600"}`}>{pret.statut.replace("_", " ")}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>Capital : <b className="text-slate-700">{fmt(pret.montant)} FCFA</b></span>
          <span>Restant : <b className={pret.statut === "EN_DEFAUT" ? "text-red-600" : "text-orange-600"}>{fmt(pret.montantRestant)} FCFA</b></span>
          <span>Mensualité : <b className="text-slate-700">{fmt(pret.montantMensuel)}</b></span>
          <span>{pret.dureesMois} mois / {pret.tauxInteret}%</span>
        </div>
        {pret.statut === "EN_COURS" && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 bg-slate-200 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${progres}%` }} />
            </div>
            <span className="text-xs text-slate-400">{progres}%</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
        {pret.statut === "EN_COURS" && (
          <>
            <button onClick={() => doAction("SOLDER")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
              Solder
            </button>
            <button onClick={() => doAction("EN_DEFAUT")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
              Défaut
            </button>
          </>
        )}
        {(pret.statut === "EN_DEFAUT" || pret.statut === "SOLDE") && (
          <button onClick={() => doAction("REACTIVER")} disabled={loading}
            className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
            Réactiver
          </button>
        )}
      </div>
    </div>
  );
}

function PretModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/paie/prets", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const [form, setForm] = useState({ profilRHId: "", montant: "", tauxInteret: "0", dureesMois: "12", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const capital    = Number(form.montant || 0);
  const taux       = Number(form.tauxInteret || 0);
  const duree      = Number(form.dureesMois || 1);
  const totalDu    = capital * (1 + taux / 100);
  const mensualite = duree > 0 ? Math.ceil(totalDu / duree) : 0;

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.montant || !form.dureesMois) { toast.error("Collaborateur, montant et durée obligatoires"); return; }
    const r = await mutate({ profilRHId: Number(form.profilRHId), montant: capital, tauxInteret: taux, dureesMois: duree, notes: form.notes || null });
    if (r) { toast.success("Prêt créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau prêt employé</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <PField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </PField>
          <div className="grid grid-cols-3 gap-3">
            <PField label="Montant *">
              <input type="number" value={form.montant} onChange={(e) => set("montant", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
            <PField label="Taux (%)">
              <input type="number" min="0" step="0.1" value={form.tauxInteret} onChange={(e) => set("tauxInteret", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
            <PField label="Durée (mois)">
              <input type="number" min="1" value={form.dureesMois} onChange={(e) => set("dureesMois", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
          </div>
          {capital > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm flex justify-between">
              <span className="text-slate-500">Mensualité estimée</span>
              <span className="font-bold text-slate-800">{fmt(mensualite)} FCFA</span>
            </div>
          )}
          <PField label="Notes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
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

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — ORDRES DE PAIEMENT
// ════════════════════════════════════════════════════════════════════════════

interface ListeGroupe { fiches: OrdreItem[]; total: number; count: number }
interface OrdresRes { data: OrdreItem[]; total: number; listes: Record<string, ListeGroupe> }

const MODES_PAIEMENT = [
  { key: "VIREMENT",     label: "Virement bancaire", icon: Banknote,   dot: "bg-blue-500",    head: "bg-blue-50 border-blue-200",       text: "text-blue-700" },
  { key: "MOBILE_MONEY", label: "Mobile Money",      icon: CreditCard, dot: "bg-amber-500",   head: "bg-amber-50 border-amber-200",     text: "text-amber-700" },
  { key: "ESPECES",      label: "Espèces",           icon: DollarSign, dot: "bg-emerald-500", head: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
] as const;

function OrdresPaiementTab() {
  const [mois,   setMois]   = useState(String(new Date().getMonth() + 1));
  const [annee,  setAnnee]  = useState(String(ANNEE_COURANTE));
  const [selected,   setSelected]   = useState<number[]>([]);
  const [assignMode, setAssignMode] = useState("VIREMENT");

  const { mutate: patch, loading: working } = useMutation("/api/admin/rh/paie/ordres-paiement", "PATCH");

  const params = new URLSearchParams({ statut: "EN_PAIEMENT" });
  if (mois)  params.set("mois",  mois);
  if (annee) params.set("annee", annee);

  const { data: res, loading, refetch } = useApi<OrdresRes>(`/api/admin/rh/paie/ordres-paiement?${params}`);
  const listes = res?.listes;
  const total  = res?.total ?? 0;
  const nonAffecte = listes?.NON_AFFECTE;

  const toggle = (id: number) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const affecter = async () => {
    if (selected.length === 0) { toast.error("Sélectionnez au moins une fiche"); return; }
    const r = await patch({ ids: selected, modePaiement: assignMode, action: "AFFECTER" });
    if (r) { toast.success("Mode de paiement affecté"); setSelected([]); refetch(); }
  };

  const payerListe = async (mode: string, fiches: OrdreItem[]) => {
    if (fiches.length === 0) return;
    if (!confirm(`Marquer ${fiches.length} fiche(s) « ${mode} » comme payée(s) ?`)) return;
    const r = await patch({ ids: fiches.map((f) => f.id), modePaiement: mode, action: "PAYER" });
    if (r) { toast.success(`Liste ${mode} : ${fiches.length} fiche(s) payée(s)`); refetch(); }
  };

  const pdfUrl = (mode: string) => `/api/admin/rh/paie/ordres-paiement/liste?mode=${mode}&mois=${mois}&annee=${annee}`;

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="flex gap-3 flex-wrap items-center">
        <select value={mois} onChange={(e) => setMois(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
        </select>
        <select value={annee} onChange={(e) => setAnnee(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
        {total > 0 && (
          <div className="ml-auto bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 text-sm">
            <span className="text-purple-700">Total à décaisser — {MOIS_LABELS[Number(mois)]} {annee} : </span>
            <span className="font-bold text-purple-900">{fmt(total)} FCFA</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : total === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-12 text-slate-400">
          <Send className="w-8 h-8 mb-2 opacity-30" /><p className="text-sm">Aucune fiche en attente de paiement</p>
        </div>
      ) : (
        <>
          {/* À affecter — assignation du mode de paiement */}
          {nonAffecte && nonAffecte.count > 0 && (
            <div className="bg-white border border-amber-300 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-amber-50 border-b border-amber-200">
                <Info className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">À affecter ({nonAffecte.count}) — {fmt(nonAffecte.total)} FCFA</span>
                <div className="flex items-center gap-2 ml-auto">
                  <select value={assignMode} onChange={(e) => setAssignMode(e.target.value)}
                    className="border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                    {MODES_PAIEMENT.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <button onClick={affecter} disabled={working || selected.length === 0}
                    className="px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                    Affecter ({selected.length})
                  </button>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {nonAffecte.fiches.map((o) => {
                  const m = o.profilRH.gestionnaire.member;
                  return (
                    <label key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">{m.prenom} {m.nom}</div>
                        <div className="text-xs text-slate-400">{o.profilRH.matricule}</div>
                      </div>
                      <div className="text-sm font-bold text-slate-900">{fmt(o.netAPayer)} FCFA</div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Les 3 listes par mode */}
          {MODES_PAIEMENT.map((m) => {
            const g = listes?.[m.key];
            const Icon = m.icon;
            return (
              <div key={m.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className={`flex flex-wrap items-center gap-3 px-5 py-3 border-b ${m.head}`}>
                  <Icon className={`w-4 h-4 ${m.text}`} />
                  <span className={`text-sm font-semibold ${m.text}`}>{m.label}</span>
                  <span className="text-xs text-slate-500">({g?.count ?? 0})</span>
                  <span className="text-sm font-bold text-slate-800 ml-2">{fmt(g?.total ?? 0)} FCFA</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <a href={pdfUrl(m.key)} target="_blank" rel="noreferrer"
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${m.head} ${m.text} hover:opacity-80 ${(g?.count ?? 0) === 0 ? "pointer-events-none opacity-40" : ""}`}>
                      <Download className="w-3.5 h-3.5" /> Liste PDF
                    </a>
                    <button onClick={() => g && payerListe(m.key, g.fiches)} disabled={working || (g?.count ?? 0) === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40">
                      <CreditCard className="w-3.5 h-3.5" /> Marquer payée
                    </button>
                  </div>
                </div>
                {(g?.count ?? 0) === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">Aucune fiche affectée à ce mode.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {g!.fiches.map((o) => {
                      const mb = o.profilRH.gestionnaire.member;
                      return (
                        <div key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                          <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-800">{mb.prenom} {mb.nom}</div>
                            <div className="text-xs text-slate-400">{o.profilRH.matricule} — {MOIS_LABELS[o.mois]} {o.annee}</div>
                          </div>
                          <div className="text-sm font-bold text-slate-900">{fmt(o.netAPayer)} FCFA</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

function ConfigTab() {
  const [sub, setSub] = useState<"grilles" | "types" | "baremes">("grilles");
  return (
    <div className="space-y-4">
      <div className="flex gap-1 w-fit bg-slate-100 rounded-lg p-1">
        {([["grilles", "Grilles salariales"], ["types", "Types de composants"], ["baremes", "Barèmes commissions"]] as const).map(([s, l]) => (
          <button key={s} onClick={() => setSub(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${sub === s ? "bg-white shadow-sm text-slate-900" : "text-slate-600 hover:text-slate-800"}`}>
            {l}
          </button>
        ))}
      </div>
      {sub === "grilles"  && <GrillesSubTab />}
      {sub === "types"    && <TypesSubTab />}
      {sub === "baremes"  && <BaremesSubTab />}
    </div>
  );
}

function GrillesSubTab() {
  const { data: res, loading, refetch } = useApi<{ data: GrilleSalariale[] }>("/api/admin/rh/paie/config/grilles");
  const { mutate, loading: saving } = useMutation("/api/admin/rh/paie/config/grilles", "POST");
  const grilles = res?.data ?? [];
  const [form, setForm] = useState({ id: "", categorie: "", niveau: "", salaireMin: "", salaireMax: "", salaireBase: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => setForm({ id: "", categorie: "", niveau: "", salaireMin: "", salaireMax: "", salaireBase: "" });

  const edit = (g: GrilleSalariale) => setForm({ id: String(g.id), categorie: g.categorie, niveau: g.niveau, salaireMin: String(g.salaireMin), salaireMax: String(g.salaireMax), salaireBase: String(g.salaireBase) });

  const handleSave = async () => {
    if (!form.categorie || !form.niveau) { toast.error("Catégorie et niveau obligatoires"); return; }
    const body: Record<string, unknown> = { categorie: form.categorie, niveau: form.niveau, salaireMin: Number(form.salaireMin), salaireMax: Number(form.salaireMax), salaireBase: Number(form.salaireBase) };
    if (form.id) body.id = Number(form.id);
    const r = await mutate(body);
    if (r) { toast.success(form.id ? "Grille mise à jour" : "Grille créée"); reset(); refetch(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Grilles existantes</span>
          <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
        ) : grilles.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Aucune grille</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {grilles.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{g.categorie} — {g.niveau}</div>
                  <div className="text-xs text-slate-400">{fmt(g.salaireMin)} – {fmt(g.salaireMax)} FCFA · Base : {fmt(g.salaireBase)}</div>
                </div>
                <button onClick={() => edit(g)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">{form.id ? "Modifier la grille" : "Nouvelle grille"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <PField label="Catégorie *"><input value={form.categorie} onChange={(e) => set("categorie", e.target.value)} placeholder="Ex: Cadre" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
          <PField label="Niveau *"><input value={form.niveau} onChange={(e) => set("niveau", e.target.value)} placeholder="Ex: Senior" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
          <PField label="Salaire min"><input type="number" value={form.salaireMin} onChange={(e) => set("salaireMin", e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
          <PField label="Salaire max"><input type="number" value={form.salaireMax} onChange={(e) => set("salaireMax", e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
          <PField label="Salaire de base"><input type="number" value={form.salaireBase} onChange={(e) => set("salaireBase", e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
        </div>
        <div className="flex gap-2">
          {form.id && <button onClick={reset} className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><X className="w-3.5 h-3.5" /></button>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 ml-auto">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {form.id ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypesSubTab() {
  const { data: res, loading, refetch } = useApi<{ data: TypeComposant[] }>("/api/admin/rh/paie/config/types");
  const { mutate, loading: saving } = useMutation("/api/admin/rh/paie/config/types", "POST");
  const types = res?.data ?? [];
  const [form, setForm] = useState({ id: "", code: "", libelle: "", type: "GAIN", description: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => setForm({ id: "", code: "", libelle: "", type: "GAIN", description: "" });

  const edit = (t: TypeComposant) => setForm({ id: String(t.id), code: t.code, libelle: t.libelle, type: t.type, description: t.description ?? "" });

  const handleSave = async () => {
    if (!form.code || !form.libelle) { toast.error("Code et libellé obligatoires"); return; }
    const body: Record<string, unknown> = { code: form.code, libelle: form.libelle, type: form.type, description: form.description || null };
    if (form.id) body.id = Number(form.id);
    const r = await mutate(body);
    if (r) { toast.success(form.id ? "Type mis à jour" : "Type créé"); reset(); refetch(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Types de composants</span>
          <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
        ) : types.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Aucun type personnalisé</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {types.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === "GAIN" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{t.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{t.libelle}</div>
                  <div className="text-xs text-slate-400 font-mono">{t.code}</div>
                </div>
                <button onClick={() => edit(t)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">{form.id ? "Modifier le type" : "Nouveau type"}</h3>
        <div className="grid grid-cols-2 gap-3">
          <PField label="Code *"><input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="EX_CODE" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
          <PField label="Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="GAIN">Gain</option>
              <option value="RETENUE">Retenue</option>
            </select>
          </PField>
        </div>
        <PField label="Libellé *"><input value={form.libelle} onChange={(e) => set("libelle", e.target.value)} placeholder="Ex: Prime terrain" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
        <PField label="Description"><input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optionnel" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
        <div className="flex gap-2">
          {form.id && <button onClick={reset} className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><X className="w-3.5 h-3.5" /></button>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 ml-auto">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {form.id ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BaremesSubTab() {
  const { data: res, loading, refetch } = useApi<{ data: Bareme[] }>("/api/admin/rh/paie/config/commissions");
  const { mutate, loading: saving } = useMutation("/api/admin/rh/paie/config/commissions", "POST");
  const baremes = res?.data ?? [];
  const [form, setForm] = useState({ id: "", nom: "", type: "FIXE", valeur: "", paliers: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const reset = () => setForm({ id: "", nom: "", type: "FIXE", valeur: "", paliers: "" });

  const edit = (b: Bareme) => setForm({ id: String(b.id), nom: b.nom, type: b.type, valeur: b.valeur != null ? String(b.valeur) : "", paliers: b.paliers ? JSON.stringify(b.paliers, null, 2) : "" });

  const handleSave = async () => {
    if (!form.nom) { toast.error("Nom obligatoire"); return; }
    let paliers = undefined;
    if (form.type === "PALIER" && form.paliers) {
      try { paliers = JSON.parse(form.paliers); } catch { toast.error("Paliers JSON invalide"); return; }
    }
    const body: Record<string, unknown> = { nom: form.nom, type: form.type, valeur: form.valeur ? Number(form.valeur) : null, paliers };
    if (form.id) body.id = Number(form.id);
    const r = await mutate(body);
    if (r) { toast.success(form.id ? "Barème mis à jour" : "Barème créé"); reset(); refetch(); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Barèmes de commissions</span>
          <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><RefreshCw className="w-4 h-4 animate-spin mr-2" /> Chargement…</div>
        ) : baremes.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Aucun barème</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {baremes.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{b.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{b.nom}</div>
                  {b.valeur != null && <div className="text-xs text-slate-400">{b.type === "POURCENTAGE" ? `${b.valeur}%` : `${fmt(b.valeur)} FCFA`}</div>}
                </div>
                <button onClick={() => edit(b)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Eye className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">{form.id ? "Modifier le barème" : "Nouveau barème"}</h3>
        <PField label="Nom *"><input value={form.nom} onChange={(e) => set("nom", e.target.value)} placeholder="Ex: Commission vente standard" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></PField>
        <div className="grid grid-cols-2 gap-3">
          <PField label="Type">
            <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="FIXE">Fixe</option>
              <option value="POURCENTAGE">Pourcentage</option>
              <option value="PALIER">Palier</option>
            </select>
          </PField>
          <PField label={form.type === "POURCENTAGE" ? "Taux (%)" : "Valeur (FCFA)"}>
            <input type="number" value={form.valeur} onChange={(e) => set("valeur", e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
        </div>
        {form.type === "PALIER" && (
          <PField label='Paliers (JSON) — ex: [{"min":0,"max":100000,"taux":5}]'>
            <textarea value={form.paliers} onChange={(e) => set("paliers", e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
        )}
        <div className="flex gap-2">
          {form.id && <button onClick={reset} className="px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><X className="w-3.5 h-3.5" /></button>}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 ml-auto">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {form.id ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 5 — TABLEAU DE BORD
// ════════════════════════════════════════════════════════════════════════════

function DashboardTab() {
  const [annee, setAnnee] = useState(String(ANNEE_COURANTE));
  const { data: res, loading, refetch } = useApi<{ data: DashboardData }>(`/api/admin/rh/paie/dashboard?annee=${annee}`);
  const d = res?.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={annee} onChange={(e) => setAnnee(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : !d ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Aucune donnée</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Masse salariale (année)" value={`${fmt(d.totauxAnnee.netAPayer)} FCFA`} sub="Net cumulé" color="bg-emerald-50 text-emerald-700" icon={<TrendingUp className="w-5 h-5" />} />
            <KpiCard title="Total brut (année)" value={`${fmt(d.totauxAnnee.totalBrut)} FCFA`} sub="Avant retenues" color="bg-blue-50 text-blue-700" icon={<DollarSign className="w-5 h-5" />} />
            <KpiCard title="Avances en cours" value={`${d.avancesEnCours.count}`} sub={`${fmt(d.avancesEnCours.montantTotal)} FCFA restants`} color="bg-yellow-50 text-yellow-700" icon={<Banknote className="w-5 h-5" />} />
            <KpiCard title="Prêts en cours" value={`${d.pretsEnCours.count}`} sub={`${fmt(d.pretsEnCours.montantTotal)} FCFA restants`} color="bg-purple-50 text-purple-700" icon={<CreditCard className="w-5 h-5" />} />
          </div>

          {/* Statuts fiches */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Répartition des fiches {annee}</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUT_CFG).map(([key, cfg]) => (
                <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.badge}`}>
                  {cfg.icon}
                  <span className="text-sm font-medium">{d.statuts[key] ?? 0}</span>
                  <span className="text-xs">{cfg.short}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Graphe mensuel */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4" /> Masse salariale mensuelle {annee}
            </h3>
            <MasseMensuelleChart data={d.masseMensuelle} moisCourant={d.moisCourant} />
          </div>

          {/* Par département */}
          {Object.keys(d.parDepartement).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Par département — {MOIS_LABELS[d.moisCourant]}</h3>
              <div className="space-y-2">
                {(Object.entries(d.parDepartement) as [string, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([dept, val]) => {
                    const max = Math.max(...Object.values(d.parDepartement));
                    return (
                      <div key={dept} className="flex items-center gap-3">
                        <span className="text-sm text-slate-600 w-40 truncate">{dept}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2">
                          <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(val / max) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium text-slate-700 text-right w-36">{fmt(val)} FCFA</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Composants mois courant */}
          {Object.keys(d.composantsMoisCourant ?? {}).length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Composants — {MOIS_LABELS[d.moisCourant]}</h3>
              <div className="space-y-2">
                {(Object.entries(d.composantsMoisCourant ?? {}) as [string, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, val]) => {
                    const opt = TYPE_COMPOSANT_OPTS.find((o) => o.value === type);
                    return (
                      <div key={type} className="flex items-center justify-between py-1 border-b border-slate-50">
                        <span className="text-sm text-slate-600">{opt?.label ?? type}</span>
                        <span className="text-sm font-medium text-slate-800">{fmt(val)} FCFA</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MasseMensuelleChart({ data, moisCourant }: { data: DashboardData["masseMensuelle"]; moisCourant: number }) {
  const maxVal = Math.max(...data.map((m) => m.netAPayer), 1);
  return (
    <div className="flex items-end gap-1 h-36">
      {data.map((m) => {
        const h = Math.round((m.netAPayer / maxVal) * 100);
        const isCurrent = m.mois === moisCourant;
        return (
          <div key={m.mois} className="flex-1 flex flex-col items-center gap-1 group relative">
            {m.netAPayer > 0 && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {fmt(m.netAPayer)}
              </div>
            )}
            <div
              className={`w-full rounded-t transition-all ${isCurrent ? "bg-emerald-500" : m.netAPayer > 0 ? "bg-emerald-200 hover:bg-emerald-300" : "bg-slate-100"}`}
              style={{ height: `${Math.max(h, m.netAPayer > 0 ? 4 : 0)}%` }}
            />
            <span className={`text-xs ${isCurrent ? "text-emerald-700 font-medium" : "text-slate-400"}`}>{MOIS_LABELS[m.mois]}</span>
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ title, value, sub, color, icon }: { title: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`p-2 rounded-lg ${color}`}>{icon}</span>
      </div>
      <p className="text-lg font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs font-medium text-slate-600 mt-0.5">{title}</p>
      <p className="text-xs text-slate-400">{sub}</p>
    </div>
  );
}

// ── Helpers partagés ──────────────────────────────────────────────────────────

function PField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
