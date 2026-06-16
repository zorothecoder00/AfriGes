"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Truck, Package, CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Depot {
  id: number; montant: number; statut: string; createdAt: string;
  investisseur: { gestionnaire: { member: { nom: string; prenom: string } } };
  portefeuille: { reference: string };
}
interface DepResponse { data: Depot[]; meta: { total: number } }

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: "bg-yellow-50 text-yellow-700",
  VALIDE:     "bg-emerald-50 text-emerald-700",
  REJETE:     "bg-red-50 text-red-700",
};

export default function ApprovisionnmentsPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<DepResponse>(`/api/admin/ria/fonds/depots?limit=50&_r=${refresh}`);

  if (type !== "operations-terrain") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Opérations Terrain.</div>
  );

  const items = data?.data ?? [];
  const toNum = (v: unknown) => Number(v ?? 0);

  const totalValide  = items.filter(d => d.statut === "VALIDE").reduce((s, d) => s + toNum(d.montant), 0);
  const totalAttente = items.filter(d => d.statut === "EN_ATTENTE").reduce((s, d) => s + toNum(d.montant), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Approvisionnements</h1>
          <p className="text-sm text-slate-500">Flux de fonds entrants — dépôts investisseurs</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Truck className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-slate-800">{data?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Dépôts total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalValide)}</p>
          <p className="text-xs text-slate-500">Validés</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totalAttente)}</p>
          <p className="text-xs text-slate-500">En attente</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalValide + totalAttente)}</p>
          <p className="text-xs text-slate-500">Volume total</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-500" />
          <h2 className="font-semibold text-slate-800">Journal des dépôts</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-left">Portefeuille</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(d.createdAt).toLocaleDateString("fr")}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {d.investisseur.gestionnaire.member.prenom} {d.investisseur.gestionnaire.member.nom}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{d.portefeuille.reference}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(toNum(d.montant))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[d.statut] ?? "bg-slate-50 text-slate-600"}`}>
                        {d.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
