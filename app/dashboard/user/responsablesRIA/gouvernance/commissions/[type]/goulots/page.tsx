"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Zap, AlertTriangle, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface DashData {
  tauxRemboursement: number; tauxDefaut: number;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  nbClientsFinances: number; scoreGlobalSante: number;
}
interface DepotStats { data: { statut: string }[] }
interface RetraitStats { data: { statut: string }[] }

export default function GoulotsPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: dash  } = useApi<DashData>(`/api/admin/ria/dashboard?_r=${refresh}`);
  const { data: depots } = useApi<DepotStats>(`/api/admin/ria/fonds/depots?limit=100&_r=${refresh}`);
  const { data: retraits} = useApi<RetraitStats>(`/api/admin/ria/fonds/retraits?limit=100&_r=${refresh}`);

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const deps  = depots?.data  ?? [];
  const rets  = retraits?.data ?? [];

  const depotsAttente  = deps.filter(d => d.statut === "EN_ATTENTE").length;
  const retraitsAttente= rets.filter(r => r.statut === "EN_ATTENTE").length;

  const tauxUtil = dash && toNum(dash.capitalInvesti) > 0
    ? (toNum(dash.capitalEngage) / toNum(dash.capitalInvesti) * 100)
    : 0;

  interface Goulot {
    id: string; label: string; impact: "CRITIQUE" | "HAUT" | "MOYEN";
    valeur: string; description: string; recommandation: string;
  }

  const goulots: Goulot[] = [];

  if (depotsAttente > 3) {
    goulots.push({
      id: "depot-queue",
      label: "File d&apos;attente des dépôts",
      impact: depotsAttente > 10 ? "CRITIQUE" : "HAUT",
      valeur: `${depotsAttente} en attente`,
      description: `${depotsAttente} dépôt(s) investisseur en attente de validation.`,
      recommandation: "Accélérer la validation des dépôts en affectant plus d&apos;agents admin.",
    });
  }
  if (retraitsAttente > 2) {
    goulots.push({
      id: "retrait-queue",
      label: "Retraits bloqués",
      impact: retraitsAttente > 5 ? "CRITIQUE" : "MOYEN",
      valeur: `${retraitsAttente} en attente`,
      description: `${retraitsAttente} retrait(s) investisseur en attente de paiement.`,
      recommandation: "Vérifier la trésorerie disponible et débloquer les retraits prioritaires.",
    });
  }
  if (dash && toNum(dash.tauxDefaut) > 5) {
    goulots.push({
      id: "defaut",
      label: "Taux de défaut élevé",
      impact: toNum(dash.tauxDefaut) > 10 ? "CRITIQUE" : "HAUT",
      valeur: `${toNum(dash.tauxDefaut).toFixed(1)}%`,
      description: "Le taux de défaut dépasse le seuil de tolérance (5%).",
      recommandation: "Renforcer l&apos;analyse de crédit et activer le plan de recouvrement.",
    });
  }
  if (tauxUtil > 90) {
    goulots.push({
      id: "capital",
      label: "Saturation du capital",
      impact: tauxUtil > 97 ? "CRITIQUE" : "HAUT",
      valeur: `${tauxUtil.toFixed(1)}% utilisé`,
      description: "Le capital disponible est presque épuisé, limitant de nouveaux financements.",
      recommandation: "Prioriser le recouvrement et accélérer l&apos;apport de nouveaux investisseurs.",
    });
  }
  if (dash && toNum(dash.tauxRemboursement) < 60) {
    goulots.push({
      id: "rembours",
      label: "Faible taux de remboursement",
      impact: toNum(dash.tauxRemboursement) < 40 ? "CRITIQUE" : "MOYEN",
      valeur: `${toNum(dash.tauxRemboursement).toFixed(1)}%`,
      description: "Le taux de remboursement global est insuffisant.",
      recommandation: "Revoir les critères d&apos;attribution et intensifier le suivi terrain.",
    });
  }

  const IMPACT_STYLE: Record<string, string> = {
    CRITIQUE: "border-rose-300 bg-rose-50",
    HAUT:     "border-orange-300 bg-orange-50",
    MOYEN:    "border-yellow-300 bg-yellow-50",
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Goulots d&apos;Étranglement</h1>
          <p className="text-sm text-slate-500">Identification des freins opérationnels et recommandations</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {dash && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-violet-700">{toNum(dash.scoreGlobalSante)}/100</p>
            <p className="text-xs text-slate-500">Score santé</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${toNum(dash.tauxDefaut) > 5 ? "text-rose-700" : "text-emerald-700"}`}>
              {toNum(dash.tauxDefaut).toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">Taux défaut</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${tauxUtil > 90 ? "text-rose-700" : "text-blue-700"}`}>
              {tauxUtil.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500">Capital utilisé</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className={`text-xl font-bold ${goulots.length > 0 ? "text-rose-700" : "text-emerald-600"}`}>{goulots.length}</p>
            <p className="text-xs text-slate-500">Goulots détectés</p>
          </div>
        </div>
      )}

      {goulots.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Zap className="w-10 h-10 text-emerald-400" />
          <p className="text-emerald-700 font-medium">Aucun goulot détecté — opérations fluides</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goulots.map(g => (
            <div key={g.id} className={`border rounded-xl p-5 ${IMPACT_STYLE[g.impact]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                    g.impact === "CRITIQUE" ? "text-rose-500" : g.impact === "HAUT" ? "text-orange-500" : "text-yellow-600"
                  }`} />
                  <div>
                    <p className="font-semibold text-slate-800">{g.label.replace(/&apos;/g, "'")}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{g.description.replace(/&apos;/g, "'")}</p>
                    <div className="mt-3 p-3 bg-white/70 rounded-lg border border-current/20">
                      <p className="text-xs font-medium text-slate-700 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" /> Recommandation
                      </p>
                      <p className="text-sm text-slate-600 mt-0.5">{g.recommandation.replace(/&apos;/g, "'")}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-slate-800">{g.valeur}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    g.impact === "CRITIQUE" ? "bg-rose-600 text-white" :
                    g.impact === "HAUT"     ? "bg-orange-500 text-white" :
                    "bg-yellow-500 text-white"
                  }`}>{g.impact}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capital disponible */}
      {dash && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Flux de trésorerie RIA</h2>
          <div className="space-y-3">
            {[
              { label: "Capital investi", val: toNum(dash.capitalInvesti), color: "bg-blue-400" },
              { label: "Capital engagé", val: toNum(dash.capitalEngage), color: "bg-amber-400" },
              { label: "Capital disponible", val: toNum(dash.capitalDisponible), color: "bg-emerald-400" },
            ].map(item => {
              const max = toNum(dash.capitalInvesti);
              return (
                <div key={item.label} className="flex items-center gap-4">
                  <p className="text-sm text-slate-700 w-36">{item.label}</p>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${max > 0 ? (item.val / max) * 100 : 0}%` }} />
                  </div>
                  <p className="text-sm font-medium text-slate-800 w-32 text-right">{formatCurrency(item.val)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
