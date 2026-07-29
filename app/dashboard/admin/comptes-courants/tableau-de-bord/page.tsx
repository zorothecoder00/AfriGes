"use client";

import Link from "next/link";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, Users, ChevronRight, ListChecks, UserCheck, UserX, Gauge,
  Scale, Building2, Zap,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";
import KpiCard from "@/components/ui/KpiCard";
import Badge from "@/components/ui/Badge";

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
  topAgences: { codeAgence: string; nbComptes: number; encours: number; totalDepose: number }[];
  clientsActifs: { id: number; numeroCompte: string; nbMouvements: number; solde: number; client: string }[];
}

type CCBadgeVariant = "success" | "warning" | "neutral" | "error";

const STATUT_VARIANT: Record<string, CCBadgeVariant> = {
  ACTIF: "success", SUSPENDU: "warning",
  CLOTURE: "neutral", DECEDE: "neutral",
  BLACKLIST: "error", FRAUDULEUX: "error",
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
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>
      <div className="p-6 max-w-screen-xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-emerald-600" /> Tableau de bord — Comptes Courants
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">États consolidés du portefeuille interne clients</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/comptes-courants/etats"
              className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium">
              <Scale className="w-4 h-4" /> États &amp; rapports
            </Link>
            <Link href="/dashboard/admin/comptes-courants"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-4 h-4" /> Liste des comptes
            </Link>
          </div>
        </div>

        {loading && !s ? (
          <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : !s ? (
          <p className="text-center py-20 text-slate-400">Aucune donnée.</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Total disponible" value={s.totaux.encoursGlobal} format={formatCurrency} icon={<Wallet size={18} />} accent="success" />
              <KpiCard label="Nombre de comptes" value={s.totaux.nbComptes} icon={<Users size={18} />} accent="purple" />
              <KpiCard label="Comptes actifs" value={s.totaux.comptesActifs} icon={<UserCheck size={18} />} accent="success" />
              <KpiCard label="Comptes inactifs" value={s.totaux.comptesInactifs} icon={<UserX size={18} />} accent="error" />
              <KpiCard label="Total des dépôts" value={s.totaux.totalDepose} format={formatCurrency} icon={<TrendingUp size={18} />} accent="teal" />
              <KpiCard label="Total des retraits" value={s.totaux.totalRetire} format={formatCurrency} icon={<TrendingDown size={18} />} accent="warning" />
              <KpiCard label="Total utilisé (achats)" value={s.totaux.totalUtilise} format={formatCurrency} icon={<ShoppingCart size={18} />} accent="primary" />
              <KpiCard label="Solde moyen" value={s.totaux.soldeMoyen} format={formatCurrency} icon={<Gauge size={18} />} accent="purple" />
              <KpiCard label="Mouvements" value={s.totaux.nbMouvements} icon={<Activity size={18} />} accent="neutral" />
              <div className={s.totaux.retraitsEnAttente > 0 ? "rounded-2xl ring-2 ring-amber-300" : ""}>
                <KpiCard label="Retraits en attente" value={s.totaux.retraitsEnAttente} icon={<Clock size={18} />} accent="warning" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Répartition par statut */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ListChecks className="w-4 h-4 text-slate-400" /> Comptes par statut</h3>
                <div className="space-y-2">
                  {s.parStatut.length === 0 && <p className="text-sm text-slate-400">Aucun compte.</p>}
                  {s.parStatut.map((p) => (
                    <div key={p.statut} className="flex items-center justify-between text-sm">
                      <Badge variant={STATUT_VARIANT[p.statut] ?? "neutral"}>
                        {STATUT_LABEL[p.statut] ?? p.statut}
                      </Badge>
                      <span className="text-slate-500">{p.nb} compte(s)</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(p.solde)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flux par nature */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-slate-400" /> Flux par nature (validés)</h3>
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-400 uppercase">
                    <tr><th className="text-left font-semibold pb-2">Nature</th><th className="text-center font-semibold pb-2">Nb</th><th className="text-right font-semibold pb-2">Montant net</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {s.mvtParNature.length === 0 && <tr><td colSpan={3} className="text-slate-400 py-3">Aucun mouvement.</td></tr>}
                    {s.mvtParNature.map((m) => (
                      <tr key={m.nature}>
                        <td className="py-2 text-slate-700">{NATURE_LABEL[m.nature] ?? m.nature}</td>
                        <td className="py-2 text-center text-slate-500">{m.nb}</td>
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-400" />
                  <h3 className="font-bold text-slate-800">Top 100 épargnants</h3>
                  <span className="text-xs text-slate-400">(par solde)</span>
                </div>
                {s.topComptes.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm">Aucun compte actif.</p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {s.topComptes.map((c, i) => (
                          <tr key={c.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 text-slate-400 w-8 text-xs">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-slate-800">{c.client}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{c.numeroCompte}</p>
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-emerald-700">{formatCurrency(c.solde)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="text-slate-300 hover:text-emerald-600">
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
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-teal-500" />
                  <h3 className="font-bold text-slate-800">Top dépôts du mois</h3>
                </div>
                {s.topDepotsMois.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm">Aucun dépôt ce mois-ci.</p>
                ) : (
                  <div className="max-h-[460px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {s.topDepotsMois.map((d, i) => (
                          <tr key={d.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 text-slate-400 w-8 text-xs">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-slate-800">{d.client}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{d.numeroCompte} · {d.nb} dépôt(s)</p>
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-teal-700">{formatCurrency(d.total)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <Link href={`/dashboard/admin/comptes-courants/${d.id}`} className="text-slate-300 hover:text-teal-600">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top agences (CDC §11) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-slate-800">Top agences</h3>
                  <span className="text-xs text-slate-400">(par encours)</span>
                </div>
                {s.topAgences.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm">Aucune agence.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-slate-400 uppercase border-b border-slate-100">
                        <tr>
                          <th className="text-left font-semibold py-2 px-4">Agence</th>
                          <th className="text-center font-semibold py-2 px-2">Comptes</th>
                          <th className="text-right font-semibold py-2 px-4">Encours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {s.topAgences.map((a) => (
                          <tr key={a.codeAgence} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{a.codeAgence}</td>
                            <td className="px-2 py-2.5 text-center text-slate-500">{a.nbComptes}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-indigo-700">{formatCurrency(a.encours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Clients les plus actifs (CDC §18) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-slate-800">Clients les plus actifs</h3>
                  <span className="text-xs text-slate-400">(par mouvements)</span>
                </div>
                {s.clientsActifs.length === 0 ? (
                  <p className="text-center py-10 text-slate-400 text-sm">Aucun mouvement.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-50">
                        {s.clientsActifs.map((c, i) => (
                          <tr key={c.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 text-slate-400 w-8 text-xs">{i + 1}</td>
                            <td className="px-2 py-2.5">
                              <p className="font-medium text-slate-800">{c.client}</p>
                              <p className="text-[11px] text-slate-400 font-mono">{c.numeroCompte}</p>
                            </td>
                            <td className="px-2 py-2.5 text-right font-bold text-amber-700">{c.nbMouvements} mvt</td>
                            <td className="px-3 py-2.5 text-right">
                              <Link href={`/dashboard/admin/comptes-courants/${c.id}`} className="text-slate-300 hover:text-amber-600">
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
      </ClienteleTabBar>
    </div>
  );
}
