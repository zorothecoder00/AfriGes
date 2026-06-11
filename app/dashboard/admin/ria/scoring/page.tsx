"use client";

import { useState, useMemo } from "react";
import {
  BarChart2, RefreshCw, Search, CheckCircle2,
  AlertTriangle, TrendingDown, Shield, Info,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type ClasseRisque = "A" | "B" | "C" | "D" | "E";

interface AffectationScore {
  id: number;
  portefeuilleId: number;
  portefeuille: { reference: string; nom: string | null; investisseur: string };
  client: {
    id: number;
    nom: string;
    telephone: string | null;
    niveauRisque: string | null;
    scoreSolvabilite: number | null;
  };
  classeRisque: ClasseRisque;
  _classeCalculee: ClasseRisque;
  pourcentage: number;
  montantAlloue: number;
  actif: boolean;
  dateDebut: string;
  nbFinancements: number;
  totalFinance: number;
  totalRembourse: number;
  totalEncours: number;
  tauxRecouvrement: number;
}

interface ScoringData {
  affectations: AffectationScore[];
  repartition: Record<ClasseRisque, number>;
  total: number;
}

// ── Config classes ─────────────────────────────────────────────────────────────

const CLASSE_CONFIG: Record<ClasseRisque, { label: string; desc: string; color: string; bg: string; icon: React.ElementType; barColor: string }> = {
  A: { label: "A — Excellent",    desc: "Aucun retard, paiements honorés à temps",      color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-300",  icon: CheckCircle2,   barColor: "bg-emerald-500" },
  B: { label: "B — Bon",          desc: "Retards ponctuels < 7 jours",                   color: "text-blue-700",    bg: "bg-blue-50 border-blue-300",        icon: Shield,         barColor: "bg-blue-500" },
  C: { label: "C — Moyen",        desc: "Retards fréquents ou 7-15 jours",               color: "text-amber-700",   bg: "bg-amber-50 border-amber-300",      icon: Info,           barColor: "bg-amber-500" },
  D: { label: "D — Faible",       desc: "Retards > 15 jours ou impayés partiels",        color: "text-orange-700",  bg: "bg-orange-50 border-orange-300",    icon: AlertTriangle,  barColor: "bg-orange-500" },
  E: { label: "E — Défaillant",   desc: "Défaut de paiement ou retard > 30 jours",      color: "text-red-700",     bg: "bg-red-50 border-red-400",          icon: TrendingDown,   barColor: "bg-red-500" },
};

const BADGE: Record<ClasseRisque, string> = {
  A: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  B: "bg-blue-100 text-blue-800 border border-blue-300",
  C: "bg-amber-100 text-amber-800 border border-amber-300",
  D: "bg-orange-100 text-orange-800 border border-orange-300",
  E: "bg-red-100 text-red-800 border border-red-400",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const [search, setSearch]       = useState("");
  const [filtreClasse, setFiltreClasse] = useState<ClasseRisque | "TOUS">("TOUS");
  const [filtrePF, setFiltrePF]   = useState<string>("");

  const { data, loading, error, refetch } = useApi<ScoringData>("/api/admin/ria/scoring");
  const { mutate: recalculer, loading: recalcLoading } = useMutation<{ success: boolean; message?: string; nbMaj: number; nbTotal: number }, Record<string, never>>("/api/admin/ria/scoring", "POST");

  async function handleRecalculer() {
    const res = await recalculer({});
    if (res?.success) {
      toast.success(res.message ?? "Scores recalculés");
      refetch();
    } else {
      toast.error("Erreur lors du recalcul");
    }
  }

  const portefeuilles = useMemo(() => {
    if (!data) return [];
    const seen = new Set<number>();
    return data.affectations
      .filter((a) => { if (seen.has(a.portefeuilleId)) return false; seen.add(a.portefeuilleId); return true; })
      .map((a) => ({ id: a.portefeuilleId, ref: a.portefeuille.reference, nom: a.portefeuille.nom }));
  }, [data]);

  const affectationsFiltrees = useMemo(() => {
    if (!data) return [];
    let list = [...data.affectations];
    if (filtreClasse !== "TOUS") list = list.filter((a) => a.classeRisque === filtreClasse);
    if (filtrePF) list = list.filter((a) => String(a.portefeuilleId) === filtrePF);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.client.nom.toLowerCase().includes(q) || a.portefeuille.reference.toLowerCase().includes(q));
    }
    return list;
  }, [data, filtreClasse, filtrePF, search]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" /> Chargement du scoring…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-red-600">Erreur de chargement. <button onClick={refetch} className="underline">Réessayer</button></div>
    );
  }

  const maxRepartition = Math.max(...Object.values(data.repartition), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── En-tête ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Scoring Clients RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Classement A→E basé sur le comportement de remboursement</p>
        </div>
        <button
          onClick={handleRecalculer}
          disabled={recalcLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalcLoading ? "animate-spin" : ""}`} />
          Recalculer les scores
        </button>
      </div>

      {/* ── Répartition par classe ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-emerald-600" />
          <span className="font-medium text-slate-700 text-sm">Répartition par classe de risque</span>
          <span className="ml-auto text-xs text-slate-400">{data.total} affectation(s)</span>
        </div>
        <div className="space-y-2.5">
          {(["A", "B", "C", "D", "E"] as ClasseRisque[]).map((cls) => {
            const cfg   = CLASSE_CONFIG[cls];
            const count = data.repartition[cls] ?? 0;
            const pct   = data.total > 0 ? (count / data.total) * 100 : 0;
            const Icon  = cfg.icon;
            return (
              <div key={cls} className="flex items-center gap-3">
                <button
                  onClick={() => setFiltreClasse(filtreClasse === cls ? "TOUS" : cls)}
                  className={`flex items-center gap-1.5 w-32 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${
                    filtreClasse === cls ? cfg.bg + " " + cfg.color : "border-transparent text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cls}
                  <span className="ml-auto text-slate-400">{count}</span>
                </button>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${cfg.barColor}`}
                    style={{ width: `${(count / maxRepartition) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Légende des classes ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(["A", "B", "C", "D", "E"] as ClasseRisque[]).map((cls) => {
          const cfg = CLASSE_CONFIG[cls];
          return (
            <div key={cls} className={`rounded-lg border p-3 ${cfg.bg}`}>
              <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{cfg.desc}</p>
            </div>
          );
        })}
      </div>

      {/* ── Filtres ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher client, portefeuille…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <select
          value={filtreClasse}
          onChange={(e) => setFiltreClasse(e.target.value as ClasseRisque | "TOUS")}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
        >
          <option value="TOUS">Toutes les classes</option>
          {(["A", "B", "C", "D", "E"] as ClasseRisque[]).map((c) => (
            <option key={c} value={c}>{CLASSE_CONFIG[c].label}</option>
          ))}
        </select>
        <select
          value={filtrePF}
          onChange={(e) => setFiltrePF(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
        >
          <option value="">Tous les portefeuilles</option>
          {portefeuilles.map((pf) => (
            <option key={pf.id} value={String(pf.id)}>{pf.ref}{pf.nom ? ` — ${pf.nom}` : ""}</option>
          ))}
        </select>
      </div>

      {/* ── Tableau ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Portefeuille</th>
                <th className="px-4 py-3 text-left">Investisseur</th>
                <th className="px-4 py-3 text-center">Classe actuelle</th>
                <th className="px-4 py-3 text-center">Calculée</th>
                <th className="px-4 py-3 text-right">Financé</th>
                <th className="px-4 py-3 text-right">Taux recouvr.</th>
                <th className="px-4 py-3 text-right">Encours</th>
                <th className="px-4 py-3 text-center">Score solvab.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {affectationsFiltrees.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Aucun résultat</td></tr>
              )}
              {affectationsFiltrees.map((aff) => {
                const diverge = aff.classeRisque !== aff._classeCalculee;
                return (
                  <tr key={aff.id} className={`hover:bg-slate-50 ${diverge ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{aff.client.nom}</p>
                      {aff.client.telephone && <p className="text-xs text-slate-400">{aff.client.telephone}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {aff.portefeuille.reference}
                      {aff.portefeuille.nom ? ` — ${aff.portefeuille.nom}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{aff.portefeuille.investisseur}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${BADGE[aff.classeRisque]}`}>
                        {aff.classeRisque}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${BADGE[aff._classeCalculee]}`}>
                        {aff._classeCalculee}
                      </span>
                      {diverge && (
                        <p className="text-xs text-amber-600 mt-0.5">À mettre à jour</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(aff.totalFinance)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${aff.tauxRecouvrement >= 80 ? "bg-emerald-500" : aff.tauxRecouvrement >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, aff.tauxRecouvrement)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600">{aff.tauxRecouvrement.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(aff.totalEncours)}</td>
                    <td className="px-4 py-3 text-center">
                      {aff.client.scoreSolvabilite !== null ? (
                        <span className={`text-xs font-medium ${
                          aff.client.scoreSolvabilite >= 75 ? "text-emerald-600" :
                          aff.client.scoreSolvabilite >= 50 ? "text-amber-600" : "text-red-600"
                        }`}>
                          {aff.client.scoreSolvabilite.toFixed(0)}/100
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {affectationsFiltrees.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            {affectationsFiltrees.length} affectation(s) affichée(s)
            {affectationsFiltrees.filter((a) => a.classeRisque !== a._classeCalculee).length > 0 && (
              <span className="ml-2 text-amber-600">
                · {affectationsFiltrees.filter((a) => a.classeRisque !== a._classeCalculee).length} à recalculer
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
