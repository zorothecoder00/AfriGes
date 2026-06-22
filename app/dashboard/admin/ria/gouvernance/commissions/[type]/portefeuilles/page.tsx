"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, Briefcase, TrendingUp, Users } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface Portefeuille {
  id: number; reference: string; nom: string | null;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  rendementMoyen: number; actif: boolean;
  profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } };
}
interface PfResponse { data: Portefeuille[]; meta: { total: number } }

interface FinData {
  rendementParRegion: { label: string; totalFinance: number; totalRecouvre: number; rendement: number }[];
  rendementParPDV: { label: string; totalFinance: number; totalRecouvre: number; rendement: number }[];
}

const FINANCE_CONFIG = {
  title: "Analyse des Portefeuilles",
  sub:   "Vue par investisseur, région et agence",
  guard: "finance",
};
const AUDIT_CONFIG = {
  title: "Contrôle des Portefeuilles",
  sub:   "Vérification fonds investis, utilisés, récupérés",
  guard: "audit-controle",
};

export default function PortefeuillesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const isAudit   = type === "audit-controle";
  const isFinance = type === "finance";
  const config    = isAudit ? AUDIT_CONFIG : FINANCE_CONFIG;

  const { data: pfData, loading: pfLoading } = useApi<PfResponse>(`/api/admin/ria/portefeuilles?limit=50&_r=${refresh}`);
  // Rendements segmentés (région/PDV) : nécessitent le mode complet du dashboard
  // (jointure client coûteuse). On ne le charge donc que pour la commission Finance
  // qui les affiche ; l'audit n'en a pas besoin → on évite cette requête lourde.
  const { data: finRes } = useApi<{ data: FinData }>(isFinance ? `/api/admin/ria/dashboard?_r=${refresh}` : null);
  const finData = finRes?.data;

  if (!isFinance && !isAudit) return (
    <div className="p-6 text-center text-slate-400 text-sm">Section non disponible pour cette commission.</div>
  );

  const pfs = pfData?.data ?? [];
  const toNum = (v: unknown) => Number(v ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{config.title}</h1>
          <p className="text-sm text-slate-500">{config.sub}</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{pfData?.meta.total ?? 0}</p>
          <p className="text-xs text-slate-500">Portefeuilles total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{pfs.filter(p => p.actif).length}</p>
          <p className="text-xs text-slate-500">Actifs</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(pfs.reduce((s, p) => s + toNum(p.capitalInvesti), 0))}
          </p>
          <p className="text-xs text-slate-500">Capital total investi</p>
        </div>
      </div>

      {/* Table portefeuilles */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Par investisseur</h2>
        </div>
        {pfLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Référence</th>
                  <th className="px-4 py-3 text-left">Investisseur</th>
                  <th className="px-4 py-3 text-right">Capital investi</th>
                  <th className="px-4 py-3 text-right">Disponible</th>
                  <th className="px-4 py-3 text-right">Engagé</th>
                  {isFinance && <th className="px-4 py-3 text-right">Rendement</th>}
                  {isAudit && <th className="px-4 py-3 text-right">Taux utilisation</th>}
                  <th className="px-4 py-3 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pfs.map(p => {
                  const inv  = toNum(p.capitalInvesti);
                  const eng  = toNum(p.capitalEngage);
                  const tauxUtil = inv > 0 ? (eng / inv * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.reference}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {p.profilRIA.gestionnaire.member.prenom} {p.profilRIA.gestionnaire.member.nom}
                        {p.nom && <span className="text-xs text-slate-400 ml-1">({p.nom})</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(inv)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{formatCurrency(toNum(p.capitalDisponible))}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(eng)}</td>
                      {isFinance && <td className="px-4 py-3 text-right text-blue-600">{toNum(p.rendementMoyen).toFixed(2)}%</td>}
                      {isAudit && (
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${tauxUtil > 90 ? "text-rose-600" : tauxUtil > 70 ? "text-amber-600" : "text-emerald-600"}`}>
                            {tauxUtil.toFixed(1)}%
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {p.actif ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analyse par région */}
      {isFinance && finData?.rendementParRegion && finData.rendementParRegion.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800">Par région</h2>
          </div>
          <div className="space-y-3">
            {finData.rendementParRegion.map(r => (
              <div key={r.label} className="flex items-center gap-4">
                <p className="text-sm text-slate-700 w-40 truncate">{r.label}</p>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, r.rendement)}%` }} />
                </div>
                <p className="text-sm font-medium text-slate-800 w-16 text-right">{r.rendement.toFixed(1)}%</p>
                <p className="text-xs text-slate-400 w-28 text-right">{formatCurrency(r.totalFinance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analyse par PDV */}
      {isFinance && finData?.rendementParPDV && finData.rendementParPDV.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-800">Par agence / PDV</h2>
          </div>
          <div className="space-y-3">
            {finData.rendementParPDV.map(r => (
              <div key={r.label} className="flex items-center gap-4">
                <p className="text-sm text-slate-700 w-40 truncate">{r.label}</p>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, r.rendement)}%` }} />
                </div>
                <p className="text-sm font-medium text-slate-800 w-16 text-right">{r.rendement.toFixed(1)}%</p>
                <p className="text-xs text-slate-400 w-28 text-right">{formatCurrency(r.totalFinance)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
