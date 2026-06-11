"use client";

import { useState } from "react";
import { TrendingUp, RefreshCw, Calculator, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Distribution {
  id: number;
  portefeuilleId: number;
  mois: number;
  annee: number;
  capitalBase: number;
  tauxGenere: number;
  montantGenere: number;
  montantDistribue: number;
  montantReinvesti: number;
  montantFondSecurite: number;
  statut: "PLANIFIE" | "EN_ATTENTE_PAIEMENT" | "DISTRIBUE" | "REINVESTI";
  datePaiement: string | null;
  portefeuille: {
    reference: string;
    nom: string | null;
    profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } | null;
  };
}

interface DistribData {
  distributions: Distribution[];
  totaux: { genere: number; distribue: number; reinvesti: number; securite: number };
  total: number;
}

const STATUT_CONFIG = {
  PLANIFIE:           { label: "Planifié",          color: "bg-slate-100 text-slate-600", icon: Clock },
  EN_ATTENTE_PAIEMENT:{ label: "En attente",         color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  DISTRIBUE:          { label: "Distribué",          color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REINVESTI:          { label: "Réinvesti",          color: "bg-blue-100 text-blue-700",   icon: TrendingUp },
};

function fmt(n: number) { return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA"; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BeneficesPage() {
  const now = new Date();
  const [tab, setTab]     = useState<"calcul" | "distributions">("calcul");
  const [mois, setMois]   = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());

  const { data, loading, refetch } = useApi<DistribData>(`/api/admin/ria/benefices/distributions?mois=${mois}&annee=${annee}`);

  const { mutate: calculer, loading: calcLoading }   = useMutation<{ success: boolean; message: string; nbCrees: number }, { mois: number; annee: number }>("/api/admin/ria/benefices/calcul", "POST");
  const { mutate: distribuer, loading: distribLoading } = useMutation<{ success: boolean }, { id: number; action: "DISTRIBUER" }>("/api/admin/ria/benefices/distributions", "PATCH");

  async function handleCalculer() {
    const res = await calculer({ mois, annee });
    if (res?.success) { toast.success(res.message); refetch(); }
  }

  async function handleDistribuer(id: number) {
    const res = await distribuer({ id, action: "DISTRIBUER" });
    if (res?.success) { toast.success("Distribution effectuée"); refetch(); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bénéfices RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Calcul et distribution mensuelle des bénéfices</p>
        </div>
        <button onClick={refetch} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Sélecteur période */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Mois</label>
          <select value={mois} onChange={(e) => setMois(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString("fr-FR", { month: "long" })}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Année</label>
          <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["calcul", "distributions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {t === "calcul" ? "Déclencher le calcul" : `Distributions (${data?.total ?? 0})`}
          </button>
        ))}
      </div>

      {/* Tab Calcul */}
      {tab === "calcul" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Calculator className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-800">Calcul mensuel — {new Date(annee, mois - 1).toLocaleString("fr-FR", { month: "long", year: "numeric" })}</p>
              <p className="text-sm text-slate-500">Génère les distributions pour tous les portefeuilles actifs ayant du capital engagé.</p>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            Le calcul est <strong>idempotent</strong> : si une distribution existe déjà pour ce mois, elle est ignorée. Vous pouvez relancer sans risque.
          </div>
          <button onClick={handleCalculer} disabled={calcLoading}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            <Calculator className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
            Calculer les bénéfices — {new Date(annee, mois - 1).toLocaleString("fr-FR", { month: "long" })} {annee}
          </button>
        </div>
      )}

      {/* Tab Distributions */}
      {tab === "distributions" && (
        <div className="space-y-4">
          {/* Totaux */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Généré", value: data.totaux.genere,    color: "text-slate-800" },
                { label: "Distribué", value: data.totaux.distribue, color: "text-emerald-600" },
                { label: "Réinvesti", value: data.totaux.reinvesti, color: "text-blue-600" },
                { label: "Fonds séc.", value: data.totaux.securite, color: "text-amber-600" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className={`text-lg font-bold mt-1 ${kpi.color}`}>{fmt(kpi.value)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tableau */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-slate-400"><RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Portefeuille</th>
                      <th className="px-4 py-3 text-left">Investisseur</th>
                      <th className="px-4 py-3 text-right">Base</th>
                      <th className="px-4 py-3 text-right">Généré</th>
                      <th className="px-4 py-3 text-right">Distribué</th>
                      <th className="px-4 py-3 text-right">Réinvesti</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(!data?.distributions || data.distributions.length === 0) && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        Aucune distribution pour {new Date(annee, mois - 1).toLocaleString("fr-FR", { month: "long" })} {annee}. Lancez d&apos;abord le calcul.
                      </td></tr>
                    )}
                    {data?.distributions.map((d) => {
                      const cfg = STATUT_CONFIG[d.statut];
                      const SIcon = cfg.icon;
                      const investisseur = d.portefeuille.profilRIA?.gestionnaire?.member
                        ? `${d.portefeuille.profilRIA.gestionnaire.member.prenom} ${d.portefeuille.profilRIA.gestionnaire.member.nom}`
                        : "—";
                      return (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {d.portefeuille.reference}{d.portefeuille.nom ? ` — ${d.portefeuille.nom}` : ""}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{investisseur}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmt(Number(d.capitalBase))}</td>
                          <td className="px-4 py-3 text-right text-slate-800 font-medium">{fmt(Number(d.montantGenere))}</td>
                          <td className="px-4 py-3 text-right text-emerald-600">{fmt(Number(d.montantDistribue))}</td>
                          <td className="px-4 py-3 text-right text-blue-600">{fmt(Number(d.montantReinvesti))}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${cfg.color}`}>
                              <SIcon className="w-3 h-3" />{cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {d.statut === "PLANIFIE" && (
                              <button onClick={() => handleDistribuer(d.id)} disabled={distribLoading}
                                className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
                                Distribuer
                              </button>
                            )}
                            {d.statut === "DISTRIBUE" && (
                              <span className="text-xs text-slate-400">{d.datePaiement ? new Date(d.datePaiement).toLocaleDateString("fr-FR") : "—"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
