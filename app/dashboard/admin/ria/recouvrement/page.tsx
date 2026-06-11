"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle, Clock, CheckCircle2,
  RefreshCw, Search, ChevronDown, ChevronUp,
  AlertCircle, Activity, Plus, Phone, MapPin,
  FileText, HandshakeIcon, Shield, StickyNote, Zap,
  X, Calendar,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type NiveauAlerte = "AUCUN" | "J3" | "J7" | "J15" | "J30+";
type TabType = "globale" | "clients" | "alertes" | "actions";

interface FinancementRecouvrement {
  id: number;
  reference: string;
  montantFinance: number;
  montantRembourse: number;
  encours: number;
  statut: string;
  dateEcheance: string | null;
  joursRetard: number;
  niveauAlerte: NiveauAlerte;
  portefeuille: { id: number; reference: string; nom: string | null; investisseur: string };
  client: { id: number; nom: string; telephone: string | null; agentTerrain: string | null };
  creditReference: string | null;
  classeRisque: string;
}

interface StatsPF {
  portefeuilleId: number;
  reference: string;
  nom: string | null;
  investisseur: string;
  encours: number;
  rembourse: number;
  finance: number;
  enRetard: number;
  tauxRecouvrement: number;
}

interface RecouvrementData {
  stats: {
    totalEncours: number;
    totalRembourse: number;
    totalFinance: number;
    tauxRecouvrement: number;
    alertes: { j3: number; j7: number; j15: number; j30: number };
    nbFinancements: number;
  };
  statsParPortefeuille: StatsPF[];
  financements: FinancementRecouvrement[];
}

interface ActionRec {
  id: number;
  financementId: number;
  type: string;
  statut: string;
  notes: string | null;
  resultat: string | null;
  dateAction: string;
  dateRelance: string | null;
  effectuePar: { nom: string; prenom: string } | null;
  financement: {
    id: number;
    reference: string;
    statut: string;
    encours: number;
    client: { nom: string; prenom: string };
    portefeuille: { reference: string; nom: string | null };
  };
}

interface ActionsData { data: ActionRec[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALERTE_CONFIG: Record<NiveauAlerte, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  AUCUN: { label: "À jour",    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle2 },
  J3:    { label: "+3 jours",  color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     icon: Clock },
  J7:    { label: "+7 jours",  color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   icon: AlertCircle },
  J15:   { label: "+15 jours", color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: AlertTriangle },
  "J30+":{ label: "+30 jours", color: "text-red-900",     bg: "bg-red-100 border-red-400",        icon: AlertTriangle },
};

const CLASSE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-red-100 text-red-800",
};

const TYPE_ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  APPEL_TELEPHONIQUE: { label: "Appel téléphonique", icon: Phone,          color: "text-blue-600 bg-blue-50" },
  VISITE_TERRAIN:     { label: "Visite terrain",     icon: MapPin,          color: "text-purple-600 bg-purple-50" },
  MISE_EN_DEMEURE:    { label: "Mise en demeure",    icon: FileText,        color: "text-red-600 bg-red-50" },
  ACCORD_ECHEANCIER:  { label: "Accord échéancier",  icon: HandshakeIcon,   color: "text-emerald-600 bg-emerald-50" },
  SAISIE_GARANTIE:    { label: "Saisie garantie",    icon: Shield,          color: "text-orange-600 bg-orange-50" },
  NOTE_INTERNE:       { label: "Note interne",       icon: StickyNote,      color: "text-slate-600 bg-slate-50" },
};

const STATUT_ACTION: Record<string, { label: string; color: string }> = {
  EN_COURS:   { label: "En cours",   color: "bg-blue-100 text-blue-700" },
  RESOLU:     { label: "Résolu",     color: "bg-emerald-100 text-emerald-700" },
  SANS_SUITE: { label: "Sans suite", color: "bg-slate-100 text-slate-600" },
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " FCFA";
}
function pct(n: number) { return n.toFixed(1) + "%"; }
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Modal action ──────────────────────────────────────────────────────────────

interface ModalActionProps {
  financement: { id: number; reference: string; client: string };
  onClose: () => void;
  onSaved: () => void;
}

function ModalAction({ financement, onClose, onSaved }: ModalActionProps) {
  const [type, setType]               = useState("APPEL_TELEPHONIQUE");
  const [statut, setStatut]           = useState("EN_COURS");
  const [notes, setNotes]             = useState("");
  const [resultat, setResultat]       = useState("");
  const [dateRelance, setDateRelance] = useState("");

  const { mutate, loading } = useMutation<{ data: ActionRec }, Record<string, unknown>>(
    "/api/admin/ria/recouvrement/actions",
    "POST"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({
      financementId: financement.id,
      type,
      statut,
      notes:       notes.trim()      || null,
      resultat:    resultat.trim()   || null,
      dateRelance: dateRelance || null,
    });
    if (res) {
      toast.success("Action enregistrée");
      onSaved();
      onClose();
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Nouvelle action</h2>
            <p className="text-xs text-slate-400 mt-0.5">{financement.reference} — {financement.client}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type d&apos;action</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              required
            >
              {Object.entries(TYPE_ACTION_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Statut</label>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="EN_COURS">En cours</option>
              <option value="RESOLU">Résolu</option>
              <option value="SANS_SUITE">Sans suite</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Détails de l'action…"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Résultat</label>
            <input
              value={resultat}
              onChange={(e) => setResultat(e.target.value)}
              placeholder="Ex: Client a promis de payer le 15/07"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              <Calendar className="w-3 h-3 inline mr-1" />Date de relance
            </label>
            <input
              type="date"
              value={dateRelance}
              onChange={(e) => setDateRelance(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function RecouvrementPage() {
  const [tab, setTab]               = useState<TabType>("globale");
  const [search, setSearch]         = useState("");
  const [filtreAlerte, setFiltreAlerte] = useState<NiveauAlerte | "TOUS">("TOUS");
  const [filtrePF, setFiltrePF]     = useState<string>("");
  const [sortField, setSortField]   = useState<"joursRetard" | "encours">("joursRetard");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("desc");
  const [filtreAgent, setFiltreAgent] = useState<string>("");
  const [escaladeLoading, setEscaladeLoading] = useState(false);
  const [modalFin, setModalFin]     = useState<{ id: number; reference: string; client: string } | null>(null);
  const [filtreTypeAction, setFiltreTypeAction] = useState("");
  const [filtreStatutAction, setFiltreStatutAction] = useState("");

  const { data, loading, error, refetch }       = useApi<RecouvrementData>("/api/admin/ria/recouvrement");
  const { data: actData, loading: actLoading, refetch: refetchActions } =
    useApi<ActionsData>("/api/admin/ria/recouvrement/actions");

  const { mutate: escalade } = useMutation<{ enRetard: number; enDefaut: number }, Record<string, number>>(
    "/api/admin/ria/recouvrement/escalade",
    "POST"
  );

  const financementsFiltres = useMemo(() => {
    if (!data) return [];
    let list = [...data.financements];

    if (tab === "alertes") list = list.filter((f) => f.niveauAlerte !== "AUCUN");
    if (filtreAlerte !== "TOUS") list = list.filter((f) => f.niveauAlerte === filtreAlerte);
    if (filtrePF)     list = list.filter((f) => String(f.portefeuille.id) === filtrePF);
    if (filtreAgent)  list = list.filter((f) => f.client.agentTerrain === filtreAgent);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.client.nom.toLowerCase().includes(q) ||
          f.reference.toLowerCase().includes(q) ||
          (f.creditReference ?? "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const va = sortField === "joursRetard" ? a.joursRetard : a.encours;
      const vb = sortField === "joursRetard" ? b.joursRetard : b.encours;
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return list;
  }, [data, tab, filtreAlerte, filtrePF, filtreAgent, search, sortField, sortDir]);

  const actionsFiltrees = useMemo(() => {
    if (!actData?.data) return [];
    let list = [...actData.data];
    if (filtreTypeAction)   list = list.filter((a) => a.type === filtreTypeAction);
    if (filtreStatutAction) list = list.filter((a) => a.statut === filtreStatutAction);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.financement.client.nom.toLowerCase().includes(q) ||
          a.financement.client.prenom.toLowerCase().includes(q) ||
          a.financement.reference.toLowerCase().includes(q) ||
          (a.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [actData, filtreTypeAction, filtreStatutAction, search]);

  const agentsDisponibles = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    for (const f of data.financements) {
      if (f.client.agentTerrain) seen.add(f.client.agentTerrain);
    }
    return [...seen].sort();
  }, [data]);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  async function handleEscalade() {
    setEscaladeLoading(true);
    const res = await escalade({});
    setEscaladeLoading(false);
    if (res) {
      toast.success(`Escalade : ${res.enRetard} → EN_RETARD, ${res.enDefaut} → DEFAUT`);
      refetch();
    } else {
      toast.error("Erreur lors de l'escalade");
    }
  }

  function openModal(fin: FinancementRecouvrement) {
    setModalFin({ id: fin.id, reference: fin.reference, client: fin.client.nom });
  }

  const totalAlertesActives = data
    ? data.stats.alertes.j3 + data.stats.alertes.j7 + data.stats.alertes.j15 + data.stats.alertes.j30
    : 0;

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" /> Chargement du recouvrement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-red-600">
        Erreur de chargement.{" "}
        <button onClick={refetch} className="underline">Réessayer</button>
      </div>
    );
  }

  const { stats, statsParPortefeuille } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recouvrement RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivi des encours, retards et actions de recouvrement</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEscalade}
            disabled={escaladeLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
          >
            <Zap className="w-4 h-4" />
            {escaladeLoading ? "En cours…" : "Escalade auto"}
          </button>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Encours total</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{fmt(stats.totalEncours)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{stats.nbFinancements} financement(s)</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total recouvré</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{fmt(stats.totalRembourse)}</p>
          <p className="text-xs text-slate-400 mt-0.5">sur {fmt(stats.totalFinance)} financés</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Taux de recouvrement</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{pct(stats.tauxRecouvrement)}</p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${Math.min(100, stats.tauxRecouvrement)}%` }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 mb-2">Alertes retard</p>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span className="text-amber-600">+3j : {stats.alertes.j3}</span>
            <span className="text-orange-600">+7j : {stats.alertes.j7}</span>
            <span className="text-red-600">+15j : {stats.alertes.j15}</span>
            <span className="text-red-900 font-semibold">+30j : {stats.alertes.j30}</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["globale", "clients", "alertes", "actions"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "globale"  ? "Vue globale"
            : t === "clients" ? "Détail clients"
            : t === "alertes" ? `Alertes (${totalAlertesActives})`
            :                   `Actions (${actData?.data?.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* ── Vue globale ── */}
      {tab === "globale" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="font-medium text-slate-700 text-sm">Stats par portefeuille</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-right">Financé</th>
                  <th className="px-4 py-3 text-right">Recouvré</th>
                  <th className="px-4 py-3 text-right">Encours</th>
                  <th className="px-4 py-3 text-right">Taux</th>
                  <th className="px-4 py-3 text-center">En retard</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statsParPortefeuille.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun portefeuille</td></tr>
                )}
                {statsParPortefeuille.map((pf) => (
                  <tr key={pf.portefeuilleId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                    <td className="px-4 py-3 text-slate-600">{pf.investisseur}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(pf.finance)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(pf.rembourse)}</td>
                    <td className="px-4 py-3 text-right text-slate-800 font-medium">{fmt(pf.encours)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pf.tauxRecouvrement >= 80 ? "bg-emerald-500" : pf.tauxRecouvrement >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, pf.tauxRecouvrement)}%` }}
                          />
                        </div>
                        <span className="text-slate-700 text-xs">{pct(pf.tauxRecouvrement)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {pf.enRetard > 0 ? (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">{pf.enRetard}</span>
                      ) : (
                        <span className="text-emerald-500 text-xs">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Clients + Alertes ── */}
      {(tab === "clients" || tab === "alertes") && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher client, référence…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            {tab === "clients" && (
              <select
                value={filtreAlerte}
                onChange={(e) => setFiltreAlerte(e.target.value as NiveauAlerte | "TOUS")}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="TOUS">Tous les retards</option>
                <option value="AUCUN">À jour</option>
                <option value="J3">+3 jours</option>
                <option value="J7">+7 jours</option>
                <option value="J15">+15 jours</option>
                <option value="J30+">+30 jours</option>
              </select>
            )}
            <select
              value={filtrePF}
              onChange={(e) => setFiltrePF(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">Tous les portefeuilles</option>
              {statsParPortefeuille.map((pf) => (
                <option key={pf.portefeuilleId} value={String(pf.portefeuilleId)}>
                  {pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}
                </option>
              ))}
            </select>
            {agentsDisponibles.length > 0 && (
              <select
                value={filtreAgent}
                onChange={(e) => setFiltreAgent(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">Tous les agents terrain</option>
                {agentsDisponibles.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tableau */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Agent terrain</th>
                    <th className="px-4 py-3 text-left">Portefeuille</th>
                    <th className="px-4 py-3 text-left">Crédit</th>
                    <th className="px-4 py-3 text-center">Classe</th>
                    <th
                      className="px-4 py-3 text-right cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => toggleSort("encours")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Encours
                        {sortField === "encours" ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-center cursor-pointer hover:text-slate-700 select-none"
                      onClick={() => toggleSort("joursRetard")}
                    >
                      <span className="flex items-center justify-center gap-1">
                        Retard
                        {sortField === "joursRetard" ? (sortDir === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />) : null}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">Statut</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {financementsFiltres.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        {tab === "alertes" ? "Aucun retard détecté — tous les financements sont à jour." : "Aucun résultat."}
                      </td>
                    </tr>
                  )}
                  {financementsFiltres.map((f) => {
                    const alerte = ALERTE_CONFIG[f.niveauAlerte];
                    const AIcon  = alerte.icon;
                    return (
                      <tr key={f.id} className={`hover:bg-slate-50 ${f.niveauAlerte === "J30+" ? "bg-red-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{f.client.nom}</p>
                          {f.client.telephone && <p className="text-xs text-slate-400">{f.client.telephone}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {f.client.agentTerrain ?? <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{f.portefeuille.reference}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{f.creditReference ?? f.reference}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${CLASSE_COLOR[f.classeRisque] ?? "bg-slate-100 text-slate-600"}`}>
                            {f.classeRisque}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(f.encours)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs border rounded-full ${alerte.bg} ${alerte.color}`}>
                            <AIcon className="w-3 h-3" />
                            {f.joursRetard > 0 ? `${f.joursRetard}j` : alerte.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            f.statut === "ACTIF"     ? "bg-blue-100 text-blue-700"     :
                            f.statut === "EN_RETARD" ? "bg-orange-100 text-orange-700" :
                            f.statut === "DEFAUT"    ? "bg-red-100 text-red-700"       :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {f.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openModal(f)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                          >
                            <Plus className="w-3 h-3" /> Action
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {tab === "actions" && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher client, référence, notes…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <select
              value={filtreTypeAction}
              onChange={(e) => setFiltreTypeAction(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_ACTION_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={filtreStatutAction}
              onChange={(e) => setFiltreStatutAction(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUT_ACTION).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={refetchActions}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Liste */}
          {actLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <RefreshCw className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          )}
          {!actLoading && actionsFiltrees.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
              Aucune action enregistrée. Utilisez le bouton &laquo; Action &raquo; dans l&apos;onglet Détail clients.
            </div>
          )}
          <div className="space-y-2">
            {actionsFiltrees.map((a) => {
              const tcfg = TYPE_ACTION_CONFIG[a.type] ?? { label: a.type, icon: StickyNote, color: "text-slate-600 bg-slate-50" };
              const TIcon = tcfg.icon;
              const scfg  = STATUT_ACTION[a.statut] ?? { label: a.statut, color: "bg-slate-100 text-slate-600" };
              return (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-lg ${tcfg.color}`}>
                        <TIcon className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{tcfg.label}</p>
                        <p className="text-xs text-slate-500">
                          {a.financement.client.prenom} {a.financement.client.nom}{" "}
                          — <span className="font-mono">{a.financement.reference}</span>{" "}
                          — {a.financement.portefeuille.reference}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${scfg.color}`}>{scfg.label}</span>
                      <span className="text-xs text-slate-400">{fmtDate(a.dateAction)}</span>
                    </div>
                  </div>
                  {(a.notes || a.resultat || a.dateRelance) && (
                    <div className="mt-3 pl-11 space-y-1">
                      {a.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 rounded px-2 py-1">{a.notes}</p>
                      )}
                      {a.resultat && (
                        <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                          Résultat : {a.resultat}
                        </p>
                      )}
                      {a.dateRelance && (
                        <p className="text-xs text-blue-700">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          Relance prévue : {fmtDate(a.dateRelance)}
                        </p>
                      )}
                    </div>
                  )}
                  {a.effectuePar && (
                    <p className="mt-2 pl-11 text-xs text-slate-400">
                      Par : {a.effectuePar.prenom} {a.effectuePar.nom}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modal action ── */}
      {modalFin && (
        <ModalAction
          financement={modalFin}
          onClose={() => setModalFin(null)}
          onSaved={refetchActions}
        />
      )}
    </div>
  );
}
