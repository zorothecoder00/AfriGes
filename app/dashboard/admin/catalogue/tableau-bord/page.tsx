"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, LayoutDashboard, Package, Wallet, AlertTriangle, TrendingUp,
  PackageX, RefreshCw, Moon, Calendar,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { STATUT_STOCK_LABEL, type StatutStock } from "@/lib/catalogueStats";

interface Metrique {
  produitId: number; nom: string; codeProduit: string | null; stockActuel: number;
  valeurStock: number; quantiteVendue: number; consoJournaliere: number;
  joursDeStock: number | null; dateRupture: string | null; rotation: number;
  statutStock: StatutStock; quantiteReappro: number;
}
interface Synthese {
  produitsActifs: number; valeurStockTotale: number; enRupture: number; enCritique: number;
  enFaible: number; dormants: number; aReapprovisionner: number;
}
interface StatsData {
  params: { periodeJours: number; horizonJours: number; seuilRuptureJours: number };
  synthese: Synthese; topVentes: Metrique[]; reappro: Metrique[]; alertes: Metrique[]; dormants: Metrique[];
}

const STATUT_STYLE: Record<StatutStock, string> = {
  RUPTURE: "bg-rose-100 text-rose-700", CRITIQUE: "bg-orange-100 text-orange-700",
  FAIBLE: "bg-amber-100 text-amber-700", OK: "bg-emerald-100 text-emerald-700", DORMANT: "bg-slate-100 text-slate-500",
};

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2 ${tone}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function dateCourte(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CatalogueTableauBordPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState(30);
  const [horizon, setHorizon] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ periode: String(periode), horizon: String(horizon) });
      const r = await fetch(`/api/admin/catalogue/stats?${q}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setData(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [periode, horizon]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><LayoutDashboard className="w-6 h-6 text-blue-600" /> Tableau de bord catalogue</h2>
            <p className="text-sm text-gray-400">Rotation, jours de stock, ruptures probables et suggestions de réapprovisionnement.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-gray-500">Période
              <select value={periode} onChange={(e) => setPeriode(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
                {[7, 14, 30, 60, 90].map((d) => <option key={d} value={d}>{d} j</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-gray-500">Horizon réappro
              <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
                {[7, 14, 30, 45, 60].map((d) => <option key={d} value={d}>{d} j</option>)}
              </select>
            </label>
          </div>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <Kpi icon={<Package className="w-5 h-5" />} tone="bg-blue-50 text-blue-600" label="Produits actifs" value={String(data.synthese.produitsActifs)} />
              <Kpi icon={<Wallet className="w-5 h-5" />} tone="bg-emerald-50 text-emerald-600" label="Valeur du stock" value={formatCurrency(data.synthese.valeurStockTotale)} />
              <Kpi icon={<PackageX className="w-5 h-5" />} tone="bg-rose-50 text-rose-600" label="En rupture" value={String(data.synthese.enRupture)} />
              <Kpi icon={<AlertTriangle className="w-5 h-5" />} tone="bg-orange-50 text-orange-600" label="Critiques" value={String(data.synthese.enCritique)} />
              <Kpi icon={<AlertTriangle className="w-5 h-5" />} tone="bg-amber-50 text-amber-600" label="Faibles" value={String(data.synthese.enFaible)} />
              <Kpi icon={<Moon className="w-5 h-5" />} tone="bg-slate-100 text-slate-500" label="Dormants" value={String(data.synthese.dormants)} />
              <Kpi icon={<RefreshCw className="w-5 h-5" />} tone="bg-violet-50 text-violet-600" label="À réappro." value={String(data.synthese.aReapprovisionner)} />
            </div>

            {/* Suggestions de réapprovisionnement */}
            <Section title="Suggestions de réapprovisionnement" icon={<RefreshCw className="w-4 h-4 text-violet-600" />} empty={data.reappro.length === 0} emptyLabel="Aucun réapprovisionnement nécessaire.">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                    <th className="text-center px-4 py-2.5 font-semibold">État</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Stock</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Conso/j</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Jours restants</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Rupture prévue</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Qté à commander</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.reappro.map((m) => (
                    <tr key={m.produitId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5"><Link href={`/dashboard/admin/catalogue/produits/${m.produitId}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{m.nom}</Link><span className="block text-[11px] text-gray-400 font-mono">{m.codeProduit ?? "—"}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUT_STYLE[m.statutStock]}`}>{STATUT_STOCK_LABEL[m.statutStock]}</span></td>
                      <td className="px-4 py-2.5 text-right">{m.stockActuel}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{m.consoJournaliere}</td>
                      <td className="px-4 py-2.5 text-right">{m.joursDeStock != null ? `${m.joursDeStock} j` : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500"><span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{dateCourte(m.dateRupture)}</span></td>
                      <td className="px-4 py-2.5 text-right font-bold text-violet-700">{m.quantiteReappro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Alertes rupture / critique */}
            <Section title="Alertes stock" icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} empty={data.alertes.length === 0} emptyLabel="Aucune alerte de rupture ou stock critique.">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                    <th className="text-center px-4 py-2.5 font-semibold">État</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Stock</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Jours restants</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Rupture prévue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.alertes.map((m) => (
                    <tr key={m.produitId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-2.5"><Link href={`/dashboard/admin/catalogue/produits/${m.produitId}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{m.nom}</Link><span className="block text-[11px] text-gray-400 font-mono">{m.codeProduit ?? "—"}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUT_STYLE[m.statutStock]}`}>{STATUT_STOCK_LABEL[m.statutStock]}</span></td>
                      <td className="px-4 py-2.5 text-right">{m.stockActuel}</td>
                      <td className="px-4 py-2.5 text-right">{m.joursDeStock != null ? `${m.joursDeStock} j` : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">{dateCourte(m.dateRupture)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top ventes */}
              <Section title="Meilleures ventes" icon={<TrendingUp className="w-4 h-4 text-emerald-600" />} empty={data.topVentes.length === 0} emptyLabel="Aucune vente sur la période.">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Vendus</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Rotation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topVentes.map((m) => (
                      <tr key={m.produitId} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2.5"><Link href={`/dashboard/admin/catalogue/produits/${m.produitId}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{m.nom}</Link></td>
                        <td className="px-4 py-2.5 text-right font-semibold">{m.quantiteVendue}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{m.rotation}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>

              {/* Dormants */}
              <Section title="Produits dormants" icon={<Moon className="w-4 h-4 text-slate-500" />} empty={data.dormants.length === 0} emptyLabel="Aucun produit dormant.">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Stock</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Valeur immo.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.dormants.map((m) => (
                      <tr key={m.produitId} className="hover:bg-gray-50/60">
                        <td className="px-4 py-2.5"><Link href={`/dashboard/admin/catalogue/produits/${m.produitId}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{m.nom}</Link></td>
                        <td className="px-4 py-2.5 text-right">{m.stockActuel}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{formatCurrency(m.valeurStock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, empty, emptyLabel, children }: {
  title: string; icon: React.ReactNode; empty: boolean; emptyLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2"><h3 className="font-semibold text-gray-800 flex items-center gap-2">{icon} {title}</h3></div>
      {empty ? <div className="py-10 text-center text-sm text-gray-400">{emptyLabel}</div> : <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}
