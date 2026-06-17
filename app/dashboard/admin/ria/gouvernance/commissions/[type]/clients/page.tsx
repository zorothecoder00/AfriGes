"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Affectation {
  id: number; actif: boolean; classeRisque: string; dateDebut: string;
  client: {
    nom: string; prenom: string; telephone: string | null;
    commune: string | null; secteurActivite: string | null;
    pointDeVente: { nom: string } | null;
  };
  financements: { montantFinance: number; statut: string; montantRembourse: number }[];
}
interface AffResponse { data: Affectation[]; meta: { total: number } }

export default function ClientsAuditPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "RISQUE" | "RETARD">("ALL");
  const { data, loading } = useApi<AffResponse>(`/api/admin/ria/affectations?limit=100&_r=${refresh}`);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const all = data?.data ?? [];

  const filtered = all.filter(a => {
    if (filter === "RISQUE") return ["ELEVE", "TRES_ELEVE"].includes(a.classeRisque);
    if (filter === "RETARD") return a.financements.some(f => f.statut === "EN_RETARD");
    return true;
  });

  const anomalies = all.filter(a =>
    ["ELEVE", "TRES_ELEVE"].includes(a.classeRisque) ||
    a.financements.some(f => f.statut === "EN_RETARD")
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contrôle des Clients</h1>
          <p className="text-sm text-slate-500">Vérification des profils et comportements de remboursement</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{data?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Clients total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{all.filter(a => a.actif).length}</p>
          <p className="text-xs text-slate-500">Actifs</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${anomalies > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
          <p className={`text-2xl font-bold ${anomalies > 0 ? "text-rose-700" : "text-emerald-600"}`}>{anomalies}</p>
          <p className={`text-xs ${anomalies > 0 ? "text-rose-600" : "text-slate-500"}`}>Anomalies détectées</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {[
          { key: "ALL", label: "Tous", icon: Users },
          { key: "RISQUE", label: "Risque élevé", icon: AlertTriangle },
          { key: "RETARD", label: "En retard", icon: AlertTriangle },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
              filter === f.key ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}>
            <f.icon className="w-3.5 h-3.5" /> {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {filtered.length} client(s) {filter !== "ALL" ? `(filtre : ${filter})` : ""}
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">PDV</th>
                  <th className="px-4 py-3 text-right">Financé</th>
                  <th className="px-4 py-3 text-right">Recouvré</th>
                  <th className="px-4 py-3 text-right">Taux</th>
                  <th className="px-4 py-3 text-center">Risque</th>
                  <th className="px-4 py-3 text-center">État</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(a => {
                  const montant  = a.financements.reduce((s, f) => s + toNum(f.montantFinance), 0);
                  const recouvre = a.financements.reduce((s, f) => s + toNum(f.montantRembourse), 0);
                  const taux     = montant > 0 ? recouvre / montant * 100 : 0;
                  const enRetard = a.financements.some(f => f.statut === "EN_RETARD");
                  return (
                    <tr key={a.id} className={`hover:bg-slate-50 ${enRetard ? "bg-rose-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{a.client.prenom} {a.client.nom}</p>
                        <p className="text-xs text-slate-400">{a.client.commune ?? ""} {a.client.telephone ? `· ${a.client.telephone}` : ""}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{a.client.pointDeVente?.nom ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(montant)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(recouvre)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${taux >= 80 ? "text-emerald-600" : taux >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                          {taux.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.classeRisque === "FAIBLE" ? "bg-emerald-50 text-emerald-700" :
                          a.classeRisque === "MOYEN"  ? "bg-amber-50 text-amber-700" :
                          a.classeRisque === "ELEVE"  ? "bg-orange-50 text-orange-700" :
                          "bg-rose-50 text-rose-700"
                        }`}>
                          {a.classeRisque}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {enRetard
                          ? <AlertTriangle className="w-4 h-4 text-rose-500 mx-auto" />
                          : <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                        }
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
  );
}
