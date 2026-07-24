"use client";

import Link from "next/link";
import {
  Loader2, LayoutDashboard, Wallet, ShoppingCart, Clock,
  TrendingUp, Truck, Ship, AlertTriangle, Building2, Info,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";

interface MoisAchat { label: string; valeur: number; nb: number }
interface FournisseurEval {
  id: number; nom: string; code: string | null; noteGlobale: number | null;
  tauxRespectDelais: number | null; tauxQualite: number | null; echantillon: number;
}
interface ReseauPDV { pointDeVenteId: number; nom: string; code: string; valeurEngagee: number; nbPO: number }
interface DashboardData {
  achats: {
    valeurEngageeTotal: number; nbPOEnCours: number; valeurCeMois: number; nbPOCeMois: number;
    tauxLivraisonATemps: number | null; evolutionMensuelle: MoisAchat[];
  };
  fournisseurs: { actifs: number; topEvalues: FournisseurEval[]; aRisque: FournisseurEval[] };
  importations: { total: number; parStatut: Record<string, number>; ecartMoyenJours: number | null };
  reseau: ReseauPDV[];
  finances: { engagementFournisseurs: number; nonDisponible: string[] };
}

const STATUT_IMPORT_LABEL: Record<string, string> = {
  PREPARATION: "Préparation", EXPEDIEE: "Expédiée", EN_TRANSIT: "En transit",
  DOUANE: "Douane", LIVREE: "Livrée", RECEPTIONNEE: "Réceptionnée",
};
// Ordre fixe reflétant la progression du pipeline import (pas un statut bon/mauvais).
const STATUT_IMPORT_ORDRE = ["PREPARATION", "EXPEDIEE", "EN_TRANSIT", "DOUANE", "LIVREE", "RECEPTIONNEE"];
const STATUT_IMPORT_STYLE: Record<string, string> = {
  PREPARATION: "bg-slate-100 text-slate-600", EXPEDIEE: "bg-sky-100 text-sky-700",
  EN_TRANSIT: "bg-blue-100 text-blue-700", DOUANE: "bg-amber-100 text-amber-700",
  LIVREE: "bg-indigo-100 text-indigo-700", RECEPTIONNEE: "bg-emerald-100 text-emerald-700",
};

function Kpi({ icon, label, value, subtitle, tone }: {
  icon: React.ReactNode; label: string; value: string; subtitle?: string; tone: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg mb-2 ${tone}`}>{icon}</div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Section({ title, icon, empty, emptyLabel, children }: {
  title: string; icon: React.ReactNode; empty: boolean; emptyLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-800 flex items-center gap-2">{icon} {title}</h3></div>
      {empty ? <div className="py-10 text-center text-sm text-gray-400">{emptyLabel}</div> : <div className="p-5">{children}</div>}
    </div>
  );
}

// Barre horizontale fine, coins arrondis, une seule teinte par job (magnitude) —
// couleur définie par l'appelant, jamais par rang.
function BarRow({ label, sub, value, valueLabel, pct, color }: {
  label: string; sub?: string; value: number; valueLabel: string; pct: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0">
        <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
      </div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, value > 0 ? 3 : 0)}%` }} />
      </div>
      <div className="w-28 shrink-0 text-right text-sm font-semibold text-gray-700">{valueLabel}</div>
    </div>
  );
}

export default function DashboardSupplyChainPage() {
  const { data, loading } = useApi<DashboardData>("/api/logistique/dashboard");

  const maxMois = data ? Math.max(1, ...data.achats.evolutionMensuelle.map((m) => m.valeur)) : 1;
  const maxFournisseur = data ? Math.max(1, ...data.fournisseurs.topEvalues.map((f) => f.noteGlobale ?? ((f.tauxRespectDelais ?? 50) + (f.tauxQualite ?? 50)) / 2)) : 1;
  const maxReseau = data ? Math.max(1, ...data.reseau.map((r) => r.valeurEngagee)) : 1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <RetourApprovisionnement label="Retour à l'approvisionnement" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700" />

        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" /> Tableau de bord Supply Chain
          </h2>
          <p className="text-sm text-gray-400">Achats, fournisseurs, importations et réseau — 6 derniers mois.</p>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={<Wallet className="w-5 h-5" />} tone="bg-blue-50 text-blue-600"
                label="Engagement fournisseurs" value={formatCurrency(data.achats.valeurEngageeTotal)}
                subtitle={`${data.achats.nbPOEnCours} PO en cours`} />
              <Kpi icon={<ShoppingCart className="w-5 h-5" />} tone="bg-violet-50 text-violet-600"
                label="Achats ce mois-ci" value={formatCurrency(data.achats.valeurCeMois)}
                subtitle={`${data.achats.nbPOCeMois} bon(s) de commande`} />
              <Kpi icon={<Clock className="w-5 h-5" />} tone="bg-emerald-50 text-emerald-600"
                label="Livraisons à temps" value={data.achats.tauxLivraisonATemps != null ? `${data.achats.tauxLivraisonATemps}%` : "—"}
                subtitle="Réceptions vs date prévue" />
              <Kpi icon={<Building2 className="w-5 h-5" />} tone="bg-cyan-50 text-cyan-600"
                label="Fournisseurs actifs" value={String(data.fournisseurs.actifs)} />
            </div>

            {/* Évolution mensuelle des achats */}
            <Section title="Évolution des achats" icon={<TrendingUp className="w-4 h-4 text-blue-600" />} empty={data.achats.evolutionMensuelle.every((m) => m.nb === 0)} emptyLabel="Aucun bon de commande sur la période.">
              <div className="space-y-2.5">
                {data.achats.evolutionMensuelle.map((m) => (
                  <BarRow key={m.label} label={m.label} sub={`${m.nb} PO`} value={m.valeur}
                    valueLabel={formatCurrency(m.valeur)} pct={(m.valeur / maxMois) * 100} color="bg-blue-500" />
                ))}
              </div>
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top fournisseurs */}
              <Section title="Meilleurs fournisseurs" icon={<Truck className="w-4 h-4 text-emerald-600" />} empty={data.fournisseurs.topEvalues.length === 0} emptyLabel="Pas encore assez de données d'évaluation.">
                <div className="space-y-2.5">
                  {data.fournisseurs.topEvalues.map((f) => {
                    const score = f.noteGlobale ?? ((f.tauxRespectDelais ?? 50) + (f.tauxQualite ?? 50)) / 2;
                    return (
                      <BarRow key={f.id} label={f.nom} sub={f.code ?? undefined} value={score}
                        valueLabel={`${Math.round(score)}/100`} pct={(score / maxFournisseur) * 100} color="bg-emerald-500" />
                    );
                  })}
                </div>
              </Section>

              {/* Répartition par agence (pas de GPS -> liste, pas de carte) */}
              <Section title="Engagement par agence" icon={<Building2 className="w-4 h-4 text-cyan-600" />} empty={data.reseau.length === 0} emptyLabel="Aucun bon de commande rattaché à une agence.">
                <div className="space-y-2.5">
                  {data.reseau.slice(0, 6).map((r) => (
                    <BarRow key={r.pointDeVenteId} label={r.nom} sub={`${r.nbPO} PO`} value={r.valeurEngagee}
                      valueLabel={formatCurrency(r.valeurEngagee)} pct={(r.valeurEngagee / maxReseau) * 100} color="bg-cyan-500" />
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                  <Info className="w-3.5 h-3.5 shrink-0" /> Pas de coordonnées géographiques en base — répartition par liste, pas de carte.
                </p>
              </Section>
            </div>

            {/* Fournisseurs à risque */}
            <Section title="Fournisseurs à risque" icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} empty={data.fournisseurs.aRisque.length === 0} emptyLabel="Aucun fournisseur en dessous du seuil (70%) sur délais ou qualité.">
              <table className="w-full text-sm">
                <thead className="text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left py-2 font-semibold">Fournisseur</th>
                    <th className="text-right py-2 font-semibold">Respect délais</th>
                    <th className="text-right py-2 font-semibold">Qualité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.fournisseurs.aRisque.map((f) => (
                    <tr key={f.id}>
                      <td className="py-2.5">
                        <Link href={`/dashboard/user/logistiquesApprovisionnements/fournisseurs`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{f.nom}</Link>
                      </td>
                      <td className="py-2.5 text-right"><span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700">{f.tauxRespectDelais != null ? `${f.tauxRespectDelais}%` : "—"}</span></td>
                      <td className="py-2.5 text-right"><span className="px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-700">{f.tauxQualite != null ? `${f.tauxQualite}%` : "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* Importations */}
            <Section title="Importations en cours" icon={<Ship className="w-4 h-4 text-indigo-600" />} empty={data.importations.total === 0} emptyLabel="Aucune importation suivie.">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {STATUT_IMPORT_ORDRE.filter((s) => data.importations.parStatut[s]).map((s) => (
                  <span key={s} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUT_IMPORT_STYLE[s]}`}>
                    {STATUT_IMPORT_LABEL[s]} · {data.importations.parStatut[s]}
                  </span>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                Écart moyen ETA / arrivée réelle : {" "}
                <span className="font-semibold text-gray-800">
                  {data.importations.ecartMoyenJours != null
                    ? `${data.importations.ecartMoyenJours > 0 ? "+" : ""}${data.importations.ecartMoyenJours} j`
                    : "—"}
                </span>
              </p>
            </Section>

            {/* Finances — écart CDC assumé */}
            <Section title="Finances" icon={<Wallet className="w-4 h-4 text-blue-600" />} empty={false} emptyLabel="">
              <p className="text-sm text-gray-600">
                Engagement fournisseurs (PO ouverts) : <span className="font-semibold text-gray-900">{formatCurrency(data.finances.engagementFournisseurs)}</span>
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
                {data.finances.nonDisponible.map((item) => (
                  <p key={item} className="text-[11px] text-gray-400 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" /> {item}</p>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
