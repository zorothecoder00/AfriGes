"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Loader2, LayoutDashboard, Wallet, ShoppingCart, Clock,
  TrendingUp, TrendingDown, Truck, Ship, AlertTriangle, Building2, Info, ExternalLink, Sparkles, Map as MapIcon,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";

// Leaflet incompatible avec SSR
const StockCarte = dynamic(() => import("@/components/StockCarte"), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">Chargement de la carte…</div>,
});

interface MoisAchat { label: string; valeur: number; nb: number }
type Tendance = "AMELIORATION" | "STABLE" | "DEGRADATION" | "INSUFFISANT";
interface FournisseurEval {
  id: number; nom: string; code: string | null; noteGlobale: number | null;
  tauxRespectDelais: number | null; tauxQualite: number | null; echantillon: number;
  tendance: Tendance; deltaPoints: number | null;
}
interface ReseauPDV { pointDeVenteId: number; nom: string; code: string; latitude: number | null; longitude: number | null; regionNom: string; valeurEngagee: number; nbPO: number }
interface ReseauRegion { region: string; valeurEngagee: number; nbPO: number; nbSites: number }
interface RuptureAnticipee {
  produit: { id: number; nom: string; codeProduit: string | null };
  pointDeVente: { id: number; nom: string };
  quantite: number; quantiteRecommandee: number | null;
  fournisseurRecommande: { id: number; nom: string } | null;
  joursCouverture: number | null; niveau: "CRITIQUE" | "VIGILANCE" | "OK";
}
interface ProduitDormant { produitId: number; nom: string; codeProduit: string | null; quantite: number; valeur: number }
interface DashboardData {
  achats: {
    valeurEngageeTotal: number; nbPOEnCours: number; valeurCeMois: number; nbPOCeMois: number;
    tauxLivraisonATemps: number | null; evolutionMensuelle: MoisAchat[]; economieRealisee: number;
  };
  fournisseurs: { actifs: number; topEvalues: FournisseurEval[]; aRisque: FournisseurEval[] };
  importations: { total: number; parStatut: Record<string, number>; ecartMoyenJours: number | null };
  reseau: ReseauPDV[];
  reseauParRegion: ReseauRegion[];
  stocks: { valeurStockTotal: number; rotationStock: number | null; produitsDormants: { total: number; top: ProduitDormant[] } };
  previsions: { rupturesAnticipees: RuptureAnticipee[]; fournisseursEnDegradation: FournisseurEval[]; fournisseursEnAmelioration: FournisseurEval[] };
  finances: {
    engagementFournisseurs: number;
    facturesAPayer: { total: number; nbFactures: number; parFournisseur: { fournisseurId: number; nom: string; solde: number; nbFactures: number }[] };
    previsionsTresorerie: {
      sorties: { enRetard: number; sous30j: number; sous60j: number; sous90j: number; nonPlanifie: number };
      entrees: { enRetard: number; sous30j: number; sous60j: number; sous90j: number; nonPlanifie: number };
      totalEntreesEcheancier: number;
      ventesDirectesMoyenneMensuelle: number;
      positionNette: { enRetard: number; sous30j: number; sous60j: number; sous90j: number; nonPlanifie: number };
    };
  };
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
  const { data: res, loading } = useApi<{ data: DashboardData }>("/api/logistique/dashboard");
  const data = res?.data ?? null;

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
              <Kpi icon={<Wallet className="w-5 h-5" />} tone="bg-green-50 text-green-600"
                label="Économie réalisée" value={formatCurrency(data.achats.economieRealisee)}
                subtitle="Négociation RFQ, 6 derniers mois" />
              <Kpi icon={<Building2 className="w-5 h-5" />} tone="bg-indigo-50 text-indigo-600"
                label="Valeur du stock" value={formatCurrency(data.stocks.valeurStockTotal)} />
              <Kpi icon={<TrendingUp className="w-5 h-5" />} tone="bg-orange-50 text-orange-600"
                label="Rotation du stock" value={data.stocks.rotationStock != null ? `${data.stocks.rotationStock}×` : "—"}
                subtitle="Sorties 6 mois / valeur stock" />
              <Kpi icon={<AlertTriangle className="w-5 h-5" />} tone="bg-rose-50 text-rose-600"
                label="Produits dormants" value={String(data.stocks.produitsDormants.total)}
                subtitle="Aucune sortie depuis 3 mois" />
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

            {/* Carte géographique des stocks nationaux (CDC §14) */}
            <Section title="Carte du réseau" icon={<MapIcon className="w-4 h-4 text-cyan-600" />} empty={false} emptyLabel="">
              <div style={{ height: "360px" }}>
                <StockCarte sites={data.reseau} />
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Rayon proportionnel à l&apos;engagement fournisseurs · couleur par plateforme régionale.</p>
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top fournisseurs */}
              <Section title="Meilleurs fournisseurs" icon={<Truck className="w-4 h-4 text-emerald-600" />} empty={data.fournisseurs.topEvalues.length === 0} emptyLabel="Pas encore assez de données d'évaluation.">
                <div className="space-y-2.5">
                  {data.fournisseurs.topEvalues.map((f, i) => {
                    const score = f.noteGlobale ?? ((f.tauxRespectDelais ?? 50) + (f.tauxQualite ?? 50)) / 2;
                    return (
                      <BarRow key={`${f.id}-${i}`} label={f.nom} sub={f.code ?? undefined} value={score}
                        valueLabel={`${Math.round(score)}/100`} pct={(score / maxFournisseur) * 100} color="bg-emerald-500" />
                    );
                  })}
                </div>
              </Section>

              {/* Répartition par agence (géolocalisée si renseignée, §3/§4) */}
              <Section title="Engagement par agence" icon={<Building2 className="w-4 h-4 text-cyan-600" />} empty={data.reseau.length === 0} emptyLabel="Aucun bon de commande rattaché à une agence.">
                <div className="space-y-2.5">
                  {data.reseau.slice(0, 6).map((r, i) => (
                    <div key={`${r.pointDeVenteId}-${i}`} className="flex items-center gap-2">
                      <div className="flex-1">
                        <BarRow label={r.nom} sub={`${r.nbPO} PO`} value={r.valeurEngagee}
                          valueLabel={formatCurrency(r.valeurEngagee)} pct={(r.valeurEngagee / maxReseau) * 100} color="bg-cyan-500" />
                      </div>
                      {r.latitude != null && r.longitude != null && (
                        <a href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`} target="_blank" rel="noopener noreferrer"
                          title="Voir sur la carte" className="text-gray-400 hover:text-blue-600 shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                {data.reseau.every((r) => r.latitude == null) && (
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                    <Info className="w-3.5 h-3.5 shrink-0" /> Aucune coordonnée GPS renseignée sur ces sites — renseignez-les dans Admin &gt; PDV pour afficher les liens carte.
                  </p>
                )}
                {data.reseauParRegion.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Par région (plateforme régionale)</p>
                    <div className="space-y-2">
                      {data.reseauParRegion.map((r) => (
                        <div key={r.region} className="flex items-center justify-between text-xs text-gray-600">
                          <span>{r.region} <span className="text-gray-400">({r.nbSites} site{r.nbSites > 1 ? "s" : ""})</span></span>
                          <span className="font-semibold text-gray-800">{formatCurrency(r.valeurEngagee)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  {data.fournisseurs.aRisque.map((f, i) => (
                    <tr key={`${f.id}-${i}`}>
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

            {/* Prévisions & alertes anticipées (CDC §16 — projection statistique, pas de ML) */}
            <Section title="Prévisions & alertes anticipées" icon={<Sparkles className="w-4 h-4 text-amber-600" />}
              empty={data.previsions.rupturesAnticipees.length === 0 && data.previsions.fournisseursEnDegradation.length === 0 && data.previsions.fournisseursEnAmelioration.length === 0}
              emptyLabel="Aucun signal anticipé — stocks et fournisseurs stables sur la tendance récente.">
              {data.previsions.rupturesAnticipees.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ruptures anticipées (couverture projetée)</p>
                  <table className="w-full text-sm">
                    <thead className="text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left py-2 font-semibold">Produit</th>
                        <th className="text-left py-2 font-semibold">Site</th>
                        <th className="text-right py-2 font-semibold">Stock</th>
                        <th className="text-right py-2 font-semibold">Couverture</th>
                        <th className="text-right py-2 font-semibold">À commander</th>
                        <th className="text-left py-2 font-semibold">Fournisseur recommandé</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.previsions.rupturesAnticipees.map((r, i) => (
                        <tr key={`${r.produit.id}-${r.pointDeVente.id}-${i}`}>
                          <td className="py-2.5 font-medium text-gray-800">{r.produit.nom}</td>
                          <td className="py-2.5 text-gray-500">{r.pointDeVente.nom}</td>
                          <td className="py-2.5 text-right text-gray-700">{r.quantite}</td>
                          <td className="py-2.5 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.niveau === "CRITIQUE" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                              {r.joursCouverture != null ? `${r.joursCouverture} j` : "—"}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-gray-700">{r.quantiteRecommandee != null && r.quantiteRecommandee > 0 ? r.quantiteRecommandee : "—"}</td>
                          <td className="py-2.5 text-gray-500">{r.fournisseurRecommande?.nom ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(data.previsions.fournisseursEnDegradation.length > 0 || data.previsions.fournisseursEnAmelioration.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                  {data.previsions.fournisseursEnDegradation.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Fournisseurs en dégradation</p>
                      <div className="space-y-1.5">
                        {data.previsions.fournisseursEnDegradation.map((f, i) => (
                          <div key={`${f.id}-${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{f.nom}</span>
                            <span className="text-rose-600 font-semibold">{f.deltaPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.previsions.fournisseursEnAmelioration.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Fournisseurs en amélioration</p>
                      <div className="space-y-1.5">
                        {data.previsions.fournisseursEnAmelioration.map((f, i) => (
                          <div key={`${f.id}-${i}`} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{f.nom}</span>
                            <span className="text-emerald-600 font-semibold">+{f.deltaPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <Info className="w-3.5 h-3.5 shrink-0" /> Projection statistique (moyenne de consommation, tendance de délais) — pas un modèle de machine learning.
              </p>
            </Section>

            {/* Produits dormants (§14) */}
            {data.stocks.produitsDormants.total > 0 && (
              <Section title="Produits dormants" icon={<AlertTriangle className="w-4 h-4 text-rose-600" />} empty={false} emptyLabel="">
                <p className="text-xs text-gray-400 mb-2">{data.stocks.produitsDormants.total} produit(s) en stock sans aucune sortie depuis 3 mois — valeur immobilisée à examiner.</p>
                <table className="w-full text-sm">
                  <thead className="text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="text-left py-2 font-semibold">Produit</th>
                      <th className="text-right py-2 font-semibold">Stock</th>
                      <th className="text-right py-2 font-semibold">Valeur immobilisée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.stocks.produitsDormants.top.map((p) => (
                      <tr key={p.produitId}>
                        <td className="py-2.5 font-medium text-gray-800">{p.nom}</td>
                        <td className="py-2.5 text-right text-gray-700">{p.quantite}</td>
                        <td className="py-2.5 text-right text-gray-700">{formatCurrency(p.valeur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}

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

            {/* Finances */}
            <Section title="Finances" icon={<Wallet className="w-4 h-4 text-blue-600" />} empty={false} emptyLabel="">
              <p className="text-sm text-gray-600">
                Engagement fournisseurs (PO ouverts) : <span className="font-semibold text-gray-900">{formatCurrency(data.finances.engagementFournisseurs)}</span>
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-2">
                  Factures fournisseurs à payer : <span className="font-semibold text-amber-600">{formatCurrency(data.finances.facturesAPayer.total)}</span>
                  <span className="text-gray-400"> ({data.finances.facturesAPayer.nbFactures} PO non soldé(s))</span>
                </p>
                {data.finances.facturesAPayer.parFournisseur.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {data.finances.facturesAPayer.parFournisseur.slice(0, 5).map((f) => (
                      <div key={f.fournisseurId} className="flex items-center justify-between text-xs text-gray-600">
                        <span>{f.nom} ({f.nbFactures})</span>
                        <span className="font-medium text-gray-800">{formatCurrency(f.solde)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Prévisions de trésorerie — position nette</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                  {(["enRetard", "sous30j", "sous60j", "sous90j", "nonPlanifie"] as const).map((key) => {
                    const LABELS: Record<string, string> = { enRetard: "En retard", sous30j: "0-30j", sous60j: "31-60j", sous90j: "61-90j", nonPlanifie: "Non planifié" };
                    const net = data.finances.previsionsTresorerie.positionNette[key];
                    return (
                      <div key={key} className="bg-gray-50 rounded-lg p-2">
                        <p className={`text-sm font-bold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {net >= 0 ? "+" : ""}{formatCurrency(net)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{LABELS[key]}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-gray-500">Sorties (factures fournisseurs)</p>
                    <p className="font-semibold text-red-600">{formatCurrency(data.finances.facturesAPayer.total)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <p className="text-gray-500">Entrées attendues (crédits + souscriptions)</p>
                    <p className="font-semibold text-emerald-600">{formatCurrency(data.finances.previsionsTresorerie.totalEntreesEcheancier)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  + Ventes directes (flux récurrent, moyenne mensuelle 3 derniers mois) : <span className="font-semibold text-gray-800">{formatCurrency(data.finances.previsionsTresorerie.ventesDirectesMoyenneMensuelle)}</span> / mois
                </p>
                <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5"><Info className="w-3.5 h-3.5 shrink-0" /> Sorties basées sur la date de livraison prévue du PO (pas de date d&apos;échéance fournisseur dédiée). Entrées = échéances réelles crédits clients + souscriptions non soldées. Ventes directes encaissées comptant, non datées, indiquées à part.</p>
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
