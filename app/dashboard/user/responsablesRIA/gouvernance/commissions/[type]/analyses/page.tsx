"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw, Plus, Lightbulb, ChevronDown, ChevronUp,
  ArrowUpRight, Search,
} from "lucide-react";

interface Analyse {
  id: number; reference: string; statut: string;
  constat: string; analyse: string; indicateurActuel: string | null; objectifCible: string | null;
  recommandation: string | null; recommandationDetail: string | null;
  analyste: { id: number; nom: string; prenom: string };
  rapport: { id: number; titre: string; typeCommission: string; periode: string | null } | null;
  resolution: { id: number; numero: string; titre: string; statut: string } | null;
}
interface Data { data: Analyse[] }

const CONSTAT_LABELS: Record<string, string> = {
  LENTEUR: "Lenteur", DOUBLON: "Doublon", PERTE: "Perte", SURCOUT: "Surcoût", RISQUE: "Risque", AUTRE: "Autre",
};
const RECO_LABELS: Record<string, string> = {
  VALIDATION_NUMERIQUE: "Validation numérique", CIRCUIT_SIMPLIFIE: "Circuit simplifié",
  AUTOMATISATION_CONTROLES: "Automatisation de certains contrôles", AUTRE: "Autre",
};
const STATUT_STYLE: Record<string, string> = {
  OUVERTE: "bg-blue-50 text-blue-700", EN_COURS: "bg-amber-50 text-amber-700", TRAITEE: "bg-emerald-50 text-emerald-700",
};

function CreateModal({ defaultRapportId, onClose, onDone }: { defaultRapportId?: string; onClose: () => void; onDone: () => void }) {
  const [constat, setConstat] = useState("LENTEUR");
  const [analyse, setAnalyse] = useState("");
  const [indicateurActuel, setIndicateurActuel] = useState("");
  const [objectifCible, setObjectifCible] = useState("");
  const [recommandation, setRecommandation] = useState("");
  const [recommandationDetail, setRecommandationDetail] = useState("");
  const { mutate, loading } = useMutation("/api/membreCommission/analyses-optimisation", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({
      rapportId: defaultRapportId || undefined,
      constat, analyse, indicateurActuel: indicateurActuel || undefined, objectifCible: objectifCible || undefined,
      recommandation: recommandation || undefined, recommandationDetail: recommandationDetail || undefined,
    }) as { id?: number; reference?: string } | null;
    if (res?.id) { toast.success(`Analyse ${res.reference} créée`); onDone(); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-violet-600" /> Nouvelle analyse d&apos;optimisation</h2>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Constat *</label>
            <select value={constat} onChange={e => setConstat(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              {Object.entries(CONSTAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Analyse *</label>
            <textarea value={analyse} onChange={e => setAnalyse(e.target.value)} required rows={2}
              placeholder="Ex: Le délai moyen d'approbation est de 12 jours."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Indicateur actuel</label>
              <input value={indicateurActuel} onChange={e => setIndicateurActuel(e.target.value)} placeholder="Ex: 12 jours"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Objectif cible</label>
              <input value={objectifCible} onChange={e => setObjectifCible(e.target.value)} placeholder="Ex: 3 jours"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Recommandation</label>
            <select value={recommandation} onChange={e => setRecommandation(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="">—</option>
              {Object.entries(RECO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Détail recommandation</label>
            <textarea value={recommandationDetail} onChange={e => setRecommandationDetail(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || !analyse}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer l'analyse"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnalyseRow({ item, expanded, onToggle, onSaved }: { item: Analyse; expanded: boolean; onToggle: () => void; onSaved: () => void }) {
  const { mutate, loading } = useMutation(`/api/membreCommission/analyses-optimisation/${item.id}`, "PATCH");
  const { mutate: transformer, loading: transforming } = useMutation(`/api/membreCommission/analyses-optimisation/${item.id}/transformer-suggestion`, "POST");

  async function avancerStatut(statut: string) {
    const res = await mutate({ statut });
    if (res) { toast.success("Statut mis à jour"); onSaved(); }
  }
  async function transformerEnSuggestion() {
    const res = await transformer({});
    if (res) { toast.success("Transformée en suggestion"); onSaved(); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50">
        <div className="flex items-center gap-3 text-left">
          <span className="text-xs font-mono text-slate-400">{item.reference}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[item.statut]}`}>{item.statut.replace("_", " ")}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-700">{CONSTAT_LABELS[item.constat]}</span>
          <span className="text-sm text-slate-700 line-clamp-1">{item.analyse}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-xs text-slate-400">Indicateur actuel</span><p className="text-slate-700">{item.indicateurActuel ?? "—"}</p></div>
            <div><span className="text-xs text-slate-400">Objectif cible</span><p className="text-slate-700">{item.objectifCible ?? "—"}</p></div>
          </div>
          {item.recommandation && (
            <div>
              <span className="text-xs text-slate-400">Recommandation</span>
              <p className="text-slate-700">{RECO_LABELS[item.recommandation] ?? item.recommandation}</p>
              {item.recommandationDetail && <p className="text-sm text-slate-500 mt-0.5">{item.recommandationDetail}</p>}
            </div>
          )}
          <p className="text-xs text-slate-400">Analyste: {item.analyste.prenom} {item.analyste.nom}{item.rapport && ` · Rapport: ${item.rapport.titre}`}</p>

          {item.resolution ? (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              <ArrowUpRight className="w-3.5 h-3.5" /> Transformée en suggestion {item.resolution.numero} — {item.resolution.titre}
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {item.statut === "OUVERTE" && (
                <button onClick={() => avancerStatut("EN_COURS")} disabled={loading}
                  className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50">Mettre en cours</button>
              )}
              <button onClick={transformerEnSuggestion} disabled={transforming}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                <ArrowUpRight className="w-3.5 h-3.5" /> Transformer en suggestion
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalysesOptimisationPage() {
  const { type } = useParams() as { type: string };
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatut, setFilterStatut] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  const { data, loading, refetch } = useApi<Data>(`/api/membreCommission/analyses-optimisation?${params.toString()}`);

  useEffect(() => {
    if (searchParams.get("rapportId")) setShowCreate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  function done() { setShowCreate(false); refetch(); }

  const items = data?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-violet-600" /> Analyses d&apos;Optimisation</h1>
          <p className="text-sm text-slate-500">Identifier lenteurs, doublons, pertes, surcoûts, risques à partir des rapports reçus.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            <option value="OUVERTE">Ouverte</option>
            <option value="EN_COURS">En cours</option>
            <option value="TRAITEE">Traitée</option>
          </select>
          <button onClick={() => refetch()} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nouvelle analyse
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune analyse d&apos;optimisation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(it => (
            <AnalyseRow key={it.id} item={it} expanded={expandedId === it.id}
              onToggle={() => setExpandedId(expandedId === it.id ? null : it.id)}
              onSaved={() => refetch()} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal defaultRapportId={searchParams.get("rapportId") ?? undefined} onClose={() => setShowCreate(false)} onDone={done} />
      )}
    </div>
  );
}
