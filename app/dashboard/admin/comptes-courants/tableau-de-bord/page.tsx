"use client";

import Link from "next/link";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, Users, ChevronRight, ListChecks, UserCheck, UserX, Gauge,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";

interface Stats {
  totaux: {
    nbComptes: number; comptesActifs: number; comptesInactifs: number;
    encoursGlobal: number; totalDepose: number; totalRetire: number;
    totalUtilise: number; soldeMoyen: number; nbMouvements: number; retraitsEnAttente: number;
  };
  parStatut: { statut: string; nb: number; solde: number }[];
  mvtParNature: { nature: string; nb: number; montant: number }[];
  mvtDuMois: { nature: string; nb: number; montant: number }[];
  topComptes: { id: number; numeroCompte: string; solde: number; nbMouvements: number; client: string }[];
  topDepotsMois: { id: number; numeroCompte: string; client: string; total: number; nb: number }[];
}

const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700", SUSPENDU: "bg-amber-100 text-amber-700",
  CLOTURE: "bg-gray-100 text-gray-600", DECEDE: "bg-slate-200 text-slate-700",
  BLACKLIST: "bg-red-100 text-red-700", FRAUDULEUX: "bg-rose-100 text-rose-700",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};
const NATURE_LABEL: Record<string, string> = {
  DEPOT: "Dépôts", RETRAIT: "Retraits", PAIEMENT_CREDIT: "Paiements crédit",
  PAIEMENT_COMPTANT: "Paiements comptant", CORRECTION: "Corrections",
  ANNULATION: "Annulations", TRANSFERT: "Transferts",
};

export default function TableauBordCCPage() {
  const { data: res, loading } = useApi<{ data: Stats }>("/api/comptes-courants/stats");
  const s = res?.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 max-w-screen-xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-600" /> Tableau de bord — Comptes Courants
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">États consolidés du portefeuille interne clients</p>
          </div>
          <Link href="/dashboard/admin/comptes-courants"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Liste des comptes
          </Link>
        </div>

        {loading && !s ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : !s ? (
          <p className="text-center py-20 text-gray-400">Aucune donnée.</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Total disponible" value={formatCurrency(s.totaux.encoursGlobal)} icon={<Wallet className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
              <Kpi label="Nombre de comptes" value={String(s.totaux.nbComptes)} icon={<Users className="w-5 h-5 text-violet-600" />} bg="bg-violet-50" />
              <Kpi label="Comptes actifs" value={String(s.totaux.comptesActifs)} icon={<UserCheck className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
              <Kpi label="Comptes inactifs" value={String(s.totaux.comptesInactifs)} icon={<UserX className="w-5 h-5 text-rose-600" />} bg="bg-rose-50" />
              <Kpi label="Total des dépôts" value={formatCurrency(s.totaux.totalDepose)} icon={<TrendingUp className="w-5 h-5 text-teal-600" />} bg="bg-teal-50" />
              <Kpi label="Total des retraits" value={formatCurrency(s.totaux.totalRetire)} icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
              <Kpi label="Total utilisé (achats)" value={formatCurrency(s.totaux.totalUtilise)} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} bg="bg-blue-50" />
              <Kpi label="Solde moyen" value={formatCurrency(s.totaux.soldeMoyen)} icon={<Gauge className="w-5 h-5 text-indigo-600" />} bg="bg-indigo-50" />
              <Kpi label="Mouvements" value={String(s.totaux.nbMouvements)} icon={<Activity className="w-5 h-5 text-slate-600" />} bg="bg-slate-100" />
              <Kpi label="Retraits en attente" value={String(s.totaux.retraitsEnAttente)} icon={<Clock className="w-5 h-5 text-amber-600" />} bg="bg-amber-50"
                highlight={s.totaux.retraitsEnAttente > 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Répartition par statut */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><ListChecks className="w-4 h-4 text-gray-400" /> Comptes par statut</h3>
                <div className="space-y-2">
                  {s.parStatut.length === 0 && <p className="text-sm text-gray-400">Aucun compte.</p>}
                  {s.parStatut.map((p) => (
                    <div key={p.statut} className="flex items-center justify-between text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[p.statut] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUT_LABEL[p.statut] ?? p.statut}
                      </span>
                      <span className="text-gray-500">{p.nb} compte(s)</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(p.solde)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flux par nature */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-gray-400" /> Flux par nature (validés)</h3>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                    <tr><th className="text-left font-semibold pb-2">Nature</th><th className="text-center font-semibold pb-2">Nb</th><th className="text-right font-semibold pb-2">Montant net</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {s.mvtParNature.length === 0 && <tr><td colSpan={3} className="text-gray-400 py-3">Aucun mouvement.</td></tr>}
                    {s.mvtParNature.map((m) => (
                      <tr key={m.nature}>
                        <td className="py-2 text-gray-700">{NATURE_LABEL[m.nature] ?? m.nature}</td>
                        <td className="py-2 text-center text-gray-500">{m.nb}</td>
                        <td className={`py-2 text-right font-semibold ${m.montant < 0 ? "text-orange-600" : "text-emerald-600"}`}>
                          {m.montant < 0 ? "−" : "+"} {formatCurrency(Math.abs(m.montant))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 100 épargnants */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-gray-400" />
                  <h3 className="font-bold text-gray-800">Top 100 épargnants</h3>
                  <span className="text-xs text-gray-400">(par solde)</span>
                </div>
                {s.topComptes.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">Aucun compte actif.</p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {s.topComptes.map((c, i) => (
                          <tr key={c.id} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-gray-400 w-8 text-xs">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-gray-800">{c.client}</p>
                              <p className="text-[11px] text-gray-400 font-mono">{c.numeroCompte}</p>
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-emerald-700">{formatCurrency(c.solde)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="text-gray-300 hover:text-emerald-600">
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Top dépôts du mois */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-500" />
                  <h3 className="font-bold text-gray-800">Top dépôts du mois</h3>
                </div>
                {s.topDepotsMois.length === 0 ? (
                  <p className="text-center py-10 text-gray-400 text-sm">Aucun dépôt ce mois-ci.</p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {s.topDepotsMois.map((d, i) => (
                          <tr key={d.id} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-gray-400 w-8 text-xs">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-gray-800">{d.client}</p>
                              <p className="text-[11px] text-gray-400 font-mono">{d.numeroCompte} · {d.nb} dépôt(s)</p>
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-teal-700">{formatCurrency(d.total)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <Link href={`/dashboard/admin/comptes-courants/${d.id}`} className="text-gray-300 hover:text-teal-600">
                                <ChevronRight className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, bg, highlight }: { label: string; value: string; icon: React.ReactNode; bg: string; highlight?: boolean }) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 shadow-sm ${highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"}`}>
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-gray-900 text-lg">{value}</p></div>
    </div>
  );
}
