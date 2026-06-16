"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, UserCheck, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Investisseur {
  id: number;
  user: { nom: string; prenom: string; email: string };
  profilRIA: {
    gestionnaire: { member: { nom: string; prenom: string } };
    portefeuilles: {
      id: number; reference: string; capitalInvesti: number; capitalEngage: number;
      rendementMoyen: number; actif: boolean;
      affectations: { id: number; actif: boolean; financements: { statut: string }[] }[];
    }[];
  } | null;
}
interface InvResponse { data: Investisseur[]; meta: { total: number } }

export default function AgentsAuditPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<InvResponse>(`/api/admin/ria/investisseurs?limit=50&_r=${refresh}`);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const toNum = (v: unknown) => Number(v ?? 0);
  const items = data?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Contrôle des Agents (Investisseurs)</h1>
          <p className="text-sm text-slate-500">Vérification des activités et conformité des agents RIA</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{data?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Agents total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">
            {items.reduce((s, inv) => s + (inv.profilRIA?.portefeuilles.length ?? 0), 0)}
          </p>
          <p className="text-xs text-slate-500">Portefeuilles gérés</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700">
            {items.reduce((s, inv) => s + (inv.profilRIA?.portefeuilles.reduce((ps, p) => ps + p.affectations.filter(a => a.actif).length, 0) ?? 0), 0)}
          </p>
          <p className="text-xs text-slate-500">Clients actifs</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-slate-800">Agents & conformité</h2>
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
                  <th className="px-4 py-3 text-left">Agent</th>
                  <th className="px-4 py-3 text-right">Portefeuilles</th>
                  <th className="px-4 py-3 text-right">Capital investi</th>
                  <th className="px-4 py-3 text-right">Capital engagé</th>
                  <th className="px-4 py-3 text-right">Rendement moy.</th>
                  <th className="px-4 py-3 text-right">Clients actifs</th>
                  <th className="px-4 py-3 text-center">Alerte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map(inv => {
                  const pfs       = inv.profilRIA?.portefeuilles ?? [];
                  const investi   = pfs.reduce((s, p) => s + toNum(p.capitalInvesti), 0);
                  const engage    = pfs.reduce((s, p) => s + toNum(p.capitalEngage), 0);
                  const rendMoy   = pfs.length > 0 ? pfs.reduce((s, p) => s + toNum(p.rendementMoyen), 0) / pfs.length : 0;
                  const clients   = pfs.reduce((s, p) => s + p.affectations.filter(a => a.actif).length, 0);
                  const retards   = pfs.reduce((s, p) => s + p.affectations.reduce((as, a) => as + a.financements.filter(f => f.statut === "EN_RETARD").length, 0), 0);
                  const tauxUtil  = investi > 0 ? (engage / investi * 100) : 0;
                  const alerte    = retards > 0 || tauxUtil > 95;
                  return (
                    <tr key={inv.id} className={`hover:bg-slate-50 ${alerte ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{inv.user.prenom} {inv.user.nom}</p>
                        <p className="text-xs text-slate-400">{inv.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right">{pfs.length}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">{formatCurrency(investi)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(engage)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{rendMoy.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{clients}</td>
                      <td className="px-4 py-3 text-center">
                        {alerte
                          ? <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                          : <UserCheck className="w-4 h-4 text-emerald-400 mx-auto" />
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
