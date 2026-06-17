"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState, useMemo } from "react";
import { RefreshCw, AlertTriangle, Clock, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/format";

// Captured at module load — not during render, so no purity violation
const TODAY_MS = Date.now();

interface Financement {
  id: number; reference: string; montant: number; taux: number;
  statut: string; dateEcheance: string | null; montantRembourse: number;
  affectation: {
    client: { nom: string; prenom: string; telephone: string | null; commune: string | null };
    portefeuille: { reference: string };
  };
}
interface FResponse { data: Financement[]; meta: { total: number } }
interface EnrichedF extends Financement { jours: number }

const toNum = (v: unknown) => Number(v ?? 0);

const tranches = [
  { label: "1–30 jours",   filter: (j: number) => j >= 1  && j <= 30,  color: "bg-yellow-400" },
  { label: "31–90 jours",  filter: (j: number) => j >= 31 && j <= 90,  color: "bg-orange-400" },
  { label: "91–180 jours", filter: (j: number) => j >= 91 && j <= 180, color: "bg-red-400" },
  { label: ">180 jours",   filter: (j: number) => j > 180,             color: "bg-red-700" },
];

export default function CreancesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<FResponse>(`/api/admin/ria/financements?statut=EN_RETARD&limit=50&_r=${refresh}`);

  const items = useMemo<EnrichedF[]>(() =>
    (data?.data ?? []).map(f => ({
      ...f,
      jours: f.dateEcheance
        ? Math.max(0, Math.floor((TODAY_MS - new Date(f.dateEcheance).getTime()) / 86_400_000))
        : 0,
    })), [data]);

  if (type !== "finance") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Finance.</div>
  );

  const totalCreance = items.reduce((s, f) => s + (toNum(f.montant) - toNum(f.montantRembourse)), 0);
  const retardMoyen  = items.length > 0
    ? Math.round(items.reduce((s, f) => s + f.jours, 0) / items.length)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Analyse des Créances</h1>
          <p className="text-sm text-slate-500">Financements en retard — aging et plan de recouvrement</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{items.length}</p>
          <p className="text-xs text-rose-600">Créances en retard</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-rose-700">{formatCurrency(totalCreance)}</p>
          <p className="text-xs text-slate-500">Capital restant dû</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{retardMoyen}j</p>
          <p className="text-xs text-slate-500">Retard moyen</p>
        </div>
      </div>

      {/* Aging analysis */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Analyse de l&apos;ancienneté (aging)</h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {tranches.map(tr => {
            const group = items.filter(f => tr.filter(f.jours));
            const amt   = group.reduce((s, f) => s + (toNum(f.montant) - toNum(f.montantRembourse)), 0);
            return (
              <div key={tr.label} className="border border-slate-200 rounded-xl p-4">
                <div className={`w-3 h-3 rounded-full ${tr.color} mb-2`} />
                <p className="text-xs text-slate-500">{tr.label}</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{group.length}</p>
                <p className="text-xs text-slate-500">{formatCurrency(amt)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Liste créances */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500" />
          <h2 className="font-semibold text-slate-800">Créances à recouvrer</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-rose-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <FileText className="w-8 h-8 text-slate-300" />
            <p className="text-slate-500 text-sm">Aucune créance en retard</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Commune</th>
                  <th className="px-4 py-3 text-right">Capital dû</th>
                  <th className="px-4 py-3 text-right">Montant initial</th>
                  <th className="px-4 py-3 text-right">Retard</th>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(f => {
                  const du = toNum(f.montant) - toNum(f.montantRembourse);
                  return (
                    <tr key={f.id} className="hover:bg-rose-50/30">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{f.reference}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {f.affectation.client.prenom} {f.affectation.client.nom}
                        {f.affectation.client.telephone && (
                          <span className="block text-xs text-slate-400">{f.affectation.client.telephone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{f.affectation.client.commune ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-700">{formatCurrency(du)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(toNum(f.montant))}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${f.jours > 90 ? "text-red-700" : f.jours > 30 ? "text-orange-600" : "text-yellow-700"}`}>
                          {f.jours}j
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{f.affectation.portefeuille.reference}</td>
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
