"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Loader2, TrendingUp, TrendingDown, Users, Award, AlertTriangle } from "lucide-react";

/** Analytics marketing (CDC §7, Phase 7) — attribution, CLV, rétention, recommandations. */

interface Attribution { parTypeCampagne: { label: string; ca: number }[]; parSegmentClient: { label: string; ca: number }[]; parFamilleProduit: { label: string; ca: number }[] }
interface ClientCLV { clientId: number; caTotal: number; nbAchats: number; panierMoyen: number; clvEstime: number; client: { id: number; nom: string; prenom: string; segment: string } | null }
interface Retention { actifsPeriodePrecedente: number; retenus: number; tauxRetention: number | null; tauxChurn: number | null }
interface Recommandation { segment: string; nbClients: number; action: string; priorite: "HAUTE" | "NORMALE" }
interface LigneCanal { canal: string; leads: number; clients: number; ca: number; cout: number; cac: number | null; roi: number | null }
interface LigneProduit { produitId: number; nom: string; ventesApresCampagne: number; caApresCampagne: number; nbPromotionsCoupons: number; margeUnitaire: number | null; rotation: number | null; stockDisponible: number }
interface AnalyticsData {
  attribution: Attribution; clv: ClientCLV[]; retention: Retention; compteurs: Record<string, number>;
  recommandations: Recommandation[]; parCanal: LigneCanal[]; produits: LigneProduit[]; modele: string;
}

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");
const SEGMENT_LABEL: Record<string, string> = {
  CHAMPIONS: "Champions", FIDELES: "Fidèles", GROS_ACHETEURS: "Gros acheteurs", NOUVEAUX: "Nouveaux",
  A_RISQUE: "À risque", DORMANTS: "Dormants", PERDUS: "Perdus",
};
const MODELE_LABEL: Record<string, string> = {
  CAMPAIGN_BASED: "Campagne (défaut)", FIRST_TOUCH: "Premier contact", LAST_TOUCH: "Dernier contact", LINEAR: "Linéaire (réparti)",
};

function Barres({ items, max }: { items: { label: string; ca: number }[]; max: number }) {
  if (items.length === 0) return <p className="text-xs text-slate-400">Aucune donnée sur la période</p>;
  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-xs text-slate-600 mb-0.5">
            <span>{it.label}</span><span className="font-semibold">{fmt(it.ca)} F</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-fuchsia-500 rounded-full" style={{ width: `${max > 0 ? (it.ca / max) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsMarketing() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modele, setModele] = useState("CAMPAIGN_BASED");

  const charger = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/marketing/analytics?modele=${modele}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setData(j.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [modele]);

  useEffect(() => { charger(); }, [charger]);

  if (loading && !data) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!data) return null;

  const maxType = Math.max(1, ...data.attribution.parTypeCampagne.map((i) => i.ca));
  const maxSegment = Math.max(1, ...data.attribution.parSegmentClient.map((i) => i.ca));
  const maxFamille = Math.max(1, ...data.attribution.parFamilleProduit.map((i) => i.ca));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-fuchsia-600" /> Analytics</h2>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Modèle d&apos;attribution
          <select value={modele} onChange={(e) => setModele(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
            {Object.entries(MODELE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>

      {/* Rétention */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Clients actifs (période préc.)</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{data.retention.actifsPeriodePrecedente}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Taux de rétention</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{data.retention.tauxRetention === null ? "—" : `${data.retention.tauxRetention.toFixed(0)}%`}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Taux de churn</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{data.retention.tauxChurn === null ? "—" : `${data.retention.tauxChurn.toFixed(0)}%`}</p>
        </div>
      </div>

      {/* Attribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">CA par type de campagne</h3>
          <Barres items={data.attribution.parTypeCampagne} max={maxType} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">CA par segment client</h3>
          <Barres items={data.attribution.parSegmentClient} max={maxSegment} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">CA par famille produit</h3>
          <Barres items={data.attribution.parFamilleProduit} max={maxFamille} />
        </div>
      </div>

      {/* Recommandations */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> Recommandations (segmentation RFM)</h3>
        {data.recommandations.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune recommandation pour l&apos;instant</p>
        ) : (
          <div className="space-y-2">
            {data.recommandations.map((r) => (
              <div key={r.segment} className="flex items-start gap-3 px-3 py-2.5 bg-slate-50 rounded-xl">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${r.priorite === "HAUTE" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
                  {SEGMENT_LABEL[r.segment] ?? r.segment} · {r.nbClients}
                </span>
                <p className="text-xs text-slate-600">{r.action}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top clients CLV */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5"><Award className="w-4 h-4 text-fuchsia-500" /> Top clients (valeur vie estimée)</h3>
        {data.clv.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune donnée pour l&apos;instant</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left py-1.5 font-semibold">Client</th>
                  <th className="text-right py-1.5 font-semibold">CA total</th>
                  <th className="text-right py-1.5 font-semibold">Achats</th>
                  <th className="text-right py-1.5 font-semibold">Panier moyen</th>
                  <th className="text-right py-1.5 font-semibold">CLV estimée (12 mois)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.clv.map((c) => (
                  <tr key={c.clientId}>
                    <td className="py-1.5 text-slate-700">{c.client ? `${c.client.prenom} ${c.client.nom}` : `Client #${c.clientId}`}</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(c.caTotal)} F</td>
                    <td className="py-1.5 text-right text-slate-600">{c.nbAchats}</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(c.panierMoyen)} F</td>
                    <td className="py-1.5 text-right font-semibold text-fuchsia-700">{fmt(c.clvEstime)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analyse par canal */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Analyse par canal</h3>
        {data.parCanal.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune donnée pour l&apos;instant</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left py-1.5 font-semibold">Canal</th>
                  <th className="text-right py-1.5 font-semibold">Leads</th>
                  <th className="text-right py-1.5 font-semibold">Clients</th>
                  <th className="text-right py-1.5 font-semibold">CA</th>
                  <th className="text-right py-1.5 font-semibold">Coût</th>
                  <th className="text-right py-1.5 font-semibold">CAC</th>
                  <th className="text-right py-1.5 font-semibold">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.parCanal.map((c) => (
                  <tr key={c.canal}>
                    <td className="py-1.5 text-slate-700 font-medium">{c.canal}</td>
                    <td className="py-1.5 text-right text-slate-600">{c.leads}</td>
                    <td className="py-1.5 text-right text-slate-600">{c.clients}</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(c.ca)} F</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(c.cout)} F</td>
                    <td className="py-1.5 text-right text-slate-600">{c.cac === null ? "—" : `${fmt(c.cac)} F`}</td>
                    <td className={`py-1.5 text-right font-semibold ${c.roi !== null && c.roi >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{c.roi === null ? "—" : `${c.roi.toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analyse produits */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Produits — promotion & performance après campagne</h3>
        {data.produits.length === 0 ? (
          <p className="text-xs text-slate-400">Aucune donnée pour l&apos;instant</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-400 uppercase tracking-wide">
                <tr>
                  <th className="text-left py-1.5 font-semibold">Produit</th>
                  <th className="text-right py-1.5 font-semibold">Ventes (campagne)</th>
                  <th className="text-right py-1.5 font-semibold">CA (campagne)</th>
                  <th className="text-right py-1.5 font-semibold">Promos/coupons</th>
                  <th className="text-right py-1.5 font-semibold">Marge unitaire</th>
                  <th className="text-right py-1.5 font-semibold">Rotation</th>
                  <th className="text-right py-1.5 font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.produits.map((p) => (
                  <tr key={p.produitId}>
                    <td className="py-1.5 text-slate-700 font-medium">{p.nom}</td>
                    <td className="py-1.5 text-right text-slate-600">{p.ventesApresCampagne}</td>
                    <td className="py-1.5 text-right text-slate-600">{fmt(p.caApresCampagne)} F</td>
                    <td className="py-1.5 text-right text-slate-600">{p.nbPromotionsCoupons}</td>
                    <td className="py-1.5 text-right text-slate-600">{p.margeUnitaire === null ? "—" : `${fmt(p.margeUnitaire)} F`}</td>
                    <td className={`py-1.5 text-right ${p.rotation !== null && p.rotation < 0.2 ? "text-amber-600 font-semibold" : "text-slate-600"}`}>{p.rotation === null ? "—" : p.rotation}</td>
                    <td className="py-1.5 text-right text-slate-600">{p.stockDisponible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">Rotation faible (&lt; 0,2) mise en évidence en orange. Produits complémentaires/saisonniers non couverts (aucune donnée catalogue disponible pour ces axes).</p>
          </div>
        )}
      </div>
    </div>
  );
}
