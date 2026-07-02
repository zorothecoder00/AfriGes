"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus, X, Save, Trash2,
  DollarSign, CheckCircle, Clock, CreditCard, ArrowLeft,
  ChevronDown, ChevronUp, ShieldCheck, Eye, Info,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

interface Composant { id?: number; type: string; libelle: string; montant: number; isRetenue: boolean }

interface FichePaie {
  id: number; mois: number; annee: number;
  salaireBase: number; totalBrut: number; totalRetenues: number; netAPayer: number;
  statut: string; notes: string | null; createdAt: string;
  composants: Composant[];
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
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

// ── Constantes ───────────────────────────────────────────────────────────────

const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = Array.from({ length: 3 }, (_, i) => ANNEE_COURANTE - i);

const STATUT_CFG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  BROUILLON:   { label: "Brouillon",   badge: "bg-slate-100 text-slate-600",    icon: <Clock       className="w-3 h-3" /> },
  CONTROLE:    { label: "En contrôle", badge: "bg-yellow-100 text-yellow-700",  icon: <ShieldCheck className="w-3 h-3" /> },
  VALIDE:      { label: "Validée",     badge: "bg-blue-100 text-blue-700",      icon: <CheckCircle className="w-3 h-3" /> },
  EN_PAIEMENT: { label: "En paiement", badge: "bg-purple-100 text-purple-700",  icon: <CreditCard  className="w-3 h-3" /> },
  PAYE:        { label: "Payée",       badge: "bg-emerald-100 text-emerald-700",icon: <CreditCard  className="w-3 h-3" /> },
};

const TYPE_COMPOSANT_OPTS = [
  { value: "SALAIRE_BASE",           label: "Salaire de base",         isRetenue: false },
  { value: "PRIME_PERFORMANCE",      label: "Prime de performance",    isRetenue: false },
  { value: "PRIME_ANCIENNETE",       label: "Prime d'ancienneté",      isRetenue: false },
  { value: "PRIME_TRANSPORT",        label: "Prime de transport",      isRetenue: false },
  { value: "PRIME_LOGEMENT",         label: "Prime de logement",       isRetenue: false },
  { value: "PRIME_FONCTION",         label: "Prime de fonction",       isRetenue: false },
  { value: "COMMISSION",             label: "Commission",              isRetenue: false },
  { value: "BONUS",                  label: "Bonus",                   isRetenue: false },
  { value: "HEURES_SUPPLEMENTAIRES", label: "Heures supplémentaires",  isRetenue: false },
  { value: "AUTRE_GAIN",             label: "Autre gain",              isRetenue: false },
  { value: "DEDUCTION_ABSENCE",      label: "Déduction absence",       isRetenue: true  },
  { value: "COTISATION_RETRAITE",    label: "Cotisation retraite",     isRetenue: true  },
  { value: "COTISATION_SANTE",       label: "Cotisation santé",        isRetenue: true  },
  { value: "IMPOT_REVENU",           label: "Impôt sur le revenu",     isRetenue: true  },
  { value: "AVANCE_SUR_SALAIRE",     label: "Avance sur salaire",      isRetenue: true  },
  { value: "REMBOURSEMENT_PRET",     label: "Remboursement prêt",      isRetenue: true  },
  { value: "AUTRE_RETENUE",          label: "Autre retenue",           isRetenue: true  },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

// ── Page ────────────────────────────────────────────────────────────────────

export default function RHPaiePage() {
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

  const { data: res, loading, refetch } = useApi<FichesResponse>(`/api/responsableRH/paie?${params}`);
  const fiches = res?.data ?? [];
  const meta   = res?.meta;
  const stats  = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  // Fiches nécessitant action de contrôle
  const aControler = stats["CONTROLE"] ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">

        {/* En-tête */}
        <div>
          <Link href="/dashboard/user/responsablesRH" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Dashboard RH
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Paie & Rémunération</h1>
          <p className="text-sm text-slate-500 mt-0.5">Fiches de paie de votre équipe — Contrôle RH</p>
        </div>

        {/* Alerte contrôle en attente */}
        {aControler > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-800 font-medium">
              {aControler} fiche{aControler > 1 ? "s" : ""} en attente de votre contrôle RH
            </p>
            <button onClick={() => setStatut(statut === "CONTROLE" ? "" : "CONTROLE")}
              className="ml-auto text-xs font-medium text-yellow-700 hover:text-yellow-900 underline">
              Filtrer
            </button>
          </div>
        )}

        {/* Stats KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(STATUT_CFG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
              className={`p-3 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`p-1 rounded-md ${cfg.badge}`}>{cfg.icon}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* Filtres */}
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
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
            <DollarSign className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune fiche de paie</p>
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

      </div>

      {showCreate && <CreateFicheModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {selected   && <FicheDetailModal fiche={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />}
    </div>
  );
}

// ── Ligne fiche ───────────────────────────────────────────────────────────────

function FicheRow({ fiche, onOpen, onRefetch }: { fiche: FichePaie; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/responsableRH/paie/${fiche.id}`, "PATCH");
  const cfg    = STATUT_CFG[fiche.statut] ?? STATUT_CFG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;

  const doAction = async (action: string) => {
    const r = await mutate({ action });
    if (r) { toast.success("Statut mis à jour"); onRefetch(); }
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
          <>
            <button onClick={() => doAction("REFUSER_CONTROLE")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
              Refuser
            </button>
            <button onClick={() => doAction("VALIDER")} disabled={loading}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50">
              Valider ✓
            </button>
          </>
        )}
        {fiche.statut === "PAYE" && (
          <Link href={`/dashboard/user/responsablesRH/paie/${fiche.id}/bulletin`}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
            Bulletin
          </Link>
        )}
        <button onClick={onOpen} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Modal création ────────────────────────────────────────────────────────────

function CreateFicheModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/responsableRH/paie", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/responsableRH/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({ profilRHId: "", mois: String(new Date().getMonth() + 1), annee: String(ANNEE_COURANTE), salaireBase: "", notes: "" });
  const [composants, setComposants] = useState<Composant[]>([]);
  const [showComp,   setShowComp]   = useState(false);
  const [newComp,    setNewComp]    = useState({ type: "", libelle: "", montant: "", isRetenue: false });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const addComp = () => {
    if (!newComp.type || !newComp.montant) { toast.error("Type et montant obligatoires"); return; }
    const opt = TYPE_COMPOSANT_OPTS.find((o) => o.value === newComp.type);
    setComposants((prev) => [...prev, { type: newComp.type, libelle: newComp.libelle || (opt?.label ?? newComp.type), montant: Number(newComp.montant), isRetenue: opt?.isRetenue ?? false }]);
    setNewComp({ type: "", libelle: "", montant: "", isRetenue: false });
  };

  const totalBrut     = composants.filter((c) => !c.isRetenue).reduce((s, c) => s + c.montant, Number(form.salaireBase || 0));
  const totalRetenues = composants.filter((c) =>  c.isRetenue).reduce((s, c) => s + c.montant, 0);

  const handleSubmit = async () => {
    if (!form.profilRHId) { toast.error("Sélectionnez un collaborateur"); return; }
    const r = await mutate({ profilRHId: Number(form.profilRHId), mois: Number(form.mois), annee: Number(form.annee), salaireBase: Number(form.salaireBase || 0), composants, notes: form.notes || null });
    if (r) { toast.success("Fiche créée"); onCreated(); }
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                {MOIS_LABELS.slice(1).map((l, i) => <option key={i+1} value={i+1}>{l}</option>)}
              </select>
            </PField>
            <PField label="Année *">
              <select value={form.annee} onChange={(e) => set("annee", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </PField>
            <PField label="Salaire base">
              <input type="number" value={form.salaireBase} onChange={(e) => set("salaireBase", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </PField>
          </div>

          {/* Info retenues/gains auto */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-800">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>À la création : <strong>prime d&apos;ancienneté</strong> (% du salaire de base selon les années de service) et <strong>commissions</strong> (barème du rôle × activité) ajoutées en gains ; <strong>prêts</strong> + <strong>avances</strong> + <strong>absences</strong> (depuis les pointages) en retenues. Soldes prêts/avances décrémentés.</span>
          </div>

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

          <div className="p-4 bg-slate-50 rounded-xl space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Total brut</span><span>{fmt(totalBrut)} FCFA</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total retenues</span><span className="text-red-600">-{fmt(totalRetenues)} FCFA</span></div>
            <div className="flex justify-between border-t pt-1.5">
              <span className="font-bold text-slate-700">Net à payer</span>
              <span className="font-bold text-emerald-700">{fmt(totalBrut - totalRetenues)} FCFA</span>
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

// ── Modal détail ──────────────────────────────────────────────────────────────

function FicheDetailModal({ fiche, onClose, onUpdated }: { fiche: FichePaie; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/responsableRH/paie/${fiche.id}`, "PATCH");
  const cfg    = STATUT_CFG[fiche.statut] ?? STATUT_CFG.BROUILLON;
  const member = fiche.profilRH.gestionnaire.member;
  const gains  = fiche.composants.filter((c) => !c.isRetenue);
  const retenues = fiche.composants.filter((c) => c.isRetenue);

  const doAction = async (action: string) => {
    const r = await mutate({ action });
    if (r) { toast.success("Statut mis à jour"); onUpdated(); }
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
            <p className="text-xs text-slate-500 mt-0.5">{member.prenom} {member.nom} — {fiche.profilRH.matricule}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
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

          {/* Workflow info */}
          {fiche.statut === "CONTROLE" && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs font-semibold text-yellow-700 mb-1">Contrôle RH requis</p>
              <p className="text-xs text-yellow-600">Vérifiez les composants et validez ou refusez cette fiche.</p>
            </div>
          )}
          {fiche.notes && <p className="text-xs text-slate-400 italic">{fiche.notes}</p>}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2">
            {fiche.statut === "PAYE" && (
              <Link href={`/dashboard/user/responsablesRH/paie/${fiche.id}/bulletin`}
                className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
                Bulletin
              </Link>
            )}
            {fiche.statut === "CONTROLE" && (
              <button onClick={() => doAction("REFUSER_CONTROLE")} disabled={loading}
                className="px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
                Refuser
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Fermer</button>
            {fiche.statut === "BROUILLON" && (
              <button onClick={() => doAction("SOUMETTRE_CONTROLE")} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 disabled:opacity-50">
                <ShieldCheck className="w-4 h-4" /> Soumettre
              </button>
            )}
            {fiche.statut === "CONTROLE" && (
              <button onClick={() => doAction("VALIDER")} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Valider
              </button>
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
