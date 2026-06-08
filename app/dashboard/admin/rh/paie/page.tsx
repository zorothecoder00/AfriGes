"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus, X, Save,
  DollarSign, CheckCircle, Clock, CreditCard,
  ChevronDown, ChevronUp, User, Trash2, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Composant { id?: number; type: string; libelle: string; montant: number; isRetenue: boolean }

interface FichePaie {
  id:            number;
  mois:          number;
  annee:         number;
  salaireBase:   number;
  totalBrut:     number;
  totalRetenues: number;
  netAPayer:     number;
  statut:        string;
  fichierUrl:    string | null;
  notes:         string | null;
  createdAt:     string;
  composants:    Composant[];
  profilRH: {
    id: number; matricule: string;
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

// ── Constantes ─────────────────────────────────────────────────────────────────

const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i);

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-100 text-slate-600",    icon: <Clock       className="w-3.5 h-3.5" /> },
  VALIDE:    { label: "Validée",   badge: "bg-blue-100 text-blue-700",      icon: <CheckCircle className="w-3.5 h-3.5" /> },
  PAYE:      { label: "Payée",     badge: "bg-emerald-100 text-emerald-700",icon: <CreditCard  className="w-3.5 h-3.5" /> },
};

const TYPE_COMPOSANT_OPTS = [
  { value: "SALAIRE_BASE",           label: "Salaire de base",          isRetenue: false },
  { value: "PRIME_PERFORMANCE",      label: "Prime de performance",     isRetenue: false },
  { value: "PRIME_ANCIENNETE",       label: "Prime d'ancienneté",       isRetenue: false },
  { value: "PRIME_TRANSPORT",        label: "Prime de transport",       isRetenue: false },
  { value: "PRIME_LOGEMENT",         label: "Prime de logement",        isRetenue: false },
  { value: "HEURES_SUPPLEMENTAIRES", label: "Heures supplémentaires",   isRetenue: false },
  { value: "INDEMNITE_MISSION",      label: "Indemnité de mission",     isRetenue: false },
  { value: "AUTRE_GAIN",             label: "Autre gain",               isRetenue: false },
  { value: "DEDUCTION_ABSENCE",      label: "Déduction absence",        isRetenue: true  },
  { value: "COTISATION_RETRAITE",    label: "Cotisation retraite",      isRetenue: true  },
  { value: "COTISATION_SANTE",       label: "Cotisation santé",         isRetenue: true  },
  { value: "IMPOT_REVENU",           label: "Impôt sur le revenu",      isRetenue: true  },
  { value: "AVANCE_SUR_SALAIRE",     label: "Avance sur salaire",       isRetenue: true  },
  { value: "AUTRE_RETENUE",          label: "Autre retenue",            isRetenue: true  },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PaiePage() {
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
  params.set("page",  String(page));
  params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<FichesResponse>(`/api/admin/rh/paie?${params}`);
  const fiches = res?.data ?? [];
  const meta   = res?.meta;
  const stats  = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Paie & Rémunération</h1>
            <p className="text-sm text-slate-500 mt-0.5">Fiches de paie mensuelles des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Nouvelle fiche
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* ── Filtres ── */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher un collaborateur…"
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
        </div>

        {/* ── Liste ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : fiches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
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

        {/* ── Pagination ── */}
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

      </div>

      {showCreate && (
        <CreateFicheModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />
      )}
      {selected && (
        <FicheDetailModal fiche={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />
      )}
    </div>
  );
}

// ── Ligne fiche ────────────────────────────────────────────────────────────────

function FicheRow({ fiche, onOpen, onRefetch }: { fiche: FichePaie; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/${fiche.id}`, "PATCH");
  const cfg    = STATUT_CONFIG[fiche.statut] ?? STATUT_CONFIG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success(action === "VALIDER" ? "Fiche validée" : "Marquée comme payée"); onRefetch(); }
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
          <span>Brut : <b className="text-slate-700">{fmt(fiche.totalBrut)} FCFA</b></span>
          <span>Net : <b className="text-emerald-700">{fmt(fiche.netAPayer)} FCFA</b></span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100">
        {fiche.statut === "BROUILLON" && (
          <button onClick={() => doAction("VALIDER")} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
            Valider
          </button>
        )}
        {fiche.statut === "VALIDE" && (
          <button onClick={() => doAction("MARQUER_PAYE")} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">
            Marquer payée
          </button>
        )}
        <button onClick={onOpen} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
          Détail
        </button>
      </div>
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateFicheModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/paie", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({ profilRHId: "", mois: String(new Date().getMonth() + 1), annee: String(ANNEE_COURANTE), salaireBase: "", notes: "" });
  const [composants, setComposants] = useState<Composant[]>([]);
  const [showComp, setShowComp] = useState(false);
  const [newComp, setNewComp] = useState({ type: "", libelle: "", montant: "", isRetenue: false });

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
    const result = await mutate({
      profilRHId: Number(form.profilRHId),
      mois: Number(form.mois), annee: Number(form.annee),
      salaireBase: Number(form.salaireBase || 0),
      composants,
      notes: form.notes || null,
    });
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
          <div className="grid grid-cols-1 gap-4">
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
                <input type="number" value={form.salaireBase} onChange={(e) => set("salaireBase", e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </PField>
            </div>
          </div>

          {/* Composants */}
          <div>
            <button onClick={() => setShowComp((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              {showComp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Composants de salaire ({composants.length})
            </button>
            {showComp && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                {composants.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.isRetenue ? "bg-red-400" : "bg-emerald-400"}`} />
                    <span className="flex-1 text-slate-700">{c.libelle}</span>
                    <span className={`font-medium ${c.isRetenue ? "text-red-600" : "text-emerald-600"}`}>
                      {c.isRetenue ? "-" : "+"}{fmt(c.montant)}
                    </span>
                    <button onClick={() => setComposants((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {/* Ajouter */}
                <div className="flex gap-2 mt-3 border-t border-slate-200 pt-3">
                  <select value={newComp.type}
                    onChange={(e) => {
                      const opt = TYPE_COMPOSANT_OPTS.find((o) => o.value === e.target.value);
                      setNewComp((n) => ({ ...n, type: e.target.value, isRetenue: opt?.isRetenue ?? false, libelle: opt?.label ?? "" }));
                    }}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    <option value="">Type…</option>
                    {TYPE_COMPOSANT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input value={newComp.montant} onChange={(e) => setNewComp((n) => ({ ...n, montant: e.target.value }))}
                    type="number" placeholder="Montant"
                    className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                  <button onClick={addComp} className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Récapitulatif */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total brut</span><span className="font-medium">{fmt(totalBrut)} FCFA</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total retenues</span><span className="font-medium text-red-600">-{fmt(totalRetenues)} FCFA</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 mt-1.5">
              <span className="font-semibold text-slate-700">Net à payer</span>
              <span className="font-bold text-emerald-700">{fmt(netAPayer)} FCFA</span>
            </div>
          </div>

          <PField label="Notes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </PField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail ───────────────────────────────────────────────────────────────

function FicheDetailModal({ fiche, onClose, onUpdated }: { fiche: FichePaie; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/paie/${fiche.id}`, "PATCH");
  const [fichierUrl, setFichierUrl] = useState(fiche.fichierUrl ?? "");
  const cfg    = STATUT_CONFIG[fiche.statut] ?? STATUT_CONFIG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;
  const gains  = fiche.composants.filter((c) => !c.isRetenue);
  const retenues = fiche.composants.filter((c) => c.isRetenue);

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onUpdated(); }
  };

  const saveFichier = async () => {
    const result = await mutate({ fichierUrl: fichierUrl || null });
    if (result) { toast.success("Fichier lié"); onUpdated(); }
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
          {/* Gains */}
          {gains.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Gains</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
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
          {/* Retenues */}
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
          {/* Récap */}
          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm border border-slate-200">
            <div className="flex justify-between"><span className="text-slate-500">Total brut</span><span>{fmt(fiche.totalBrut)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total retenues</span><span className="text-red-600">-{fmt(fiche.totalRetenues)}</span></div>
            <div className="flex justify-between border-t pt-1.5 mt-1.5">
              <span className="font-bold text-slate-700">Net à payer</span>
              <span className="font-bold text-emerald-700">{fmt(fiche.netAPayer)} FCFA</span>
            </div>
          </div>
          {/* Fichier */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-1">Fichier PDF de la fiche</p>
            <div className="flex gap-2">
              <input value={fichierUrl} onChange={(e) => setFichierUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button onClick={saveFichier} disabled={loading}
                className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>
          {fiche.notes && <p className="text-xs text-slate-400">{fiche.notes}</p>}
          <p className="text-xs text-slate-400">Créée le {formatDate(fiche.createdAt)}</p>
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Fermer</button>
          <div className="flex gap-2">
            {fiche.statut === "BROUILLON" && (
              <button onClick={() => doAction("VALIDER")} disabled={loading}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
                Valider
              </button>
            )}
            {fiche.statut === "VALIDE" && (
              <>
                <button onClick={() => doAction("REPASSER_BROUILLON")} disabled={loading}
                  className="px-4 py-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                  Brouillon
                </button>
                <button onClick={() => doAction("MARQUER_PAYE")} disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Marquer payée
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
