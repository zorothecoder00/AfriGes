"use client";

// Tableau de bord comptable (rubrique 1/13 du CDC Comptabilité §4) — centre de
// pilotage du comptable : 20 KPI + 10 graphiques, calculés exclusivement depuis
// EcritureComptable/CompteComptable/Immobilisation (lib/comptabilite/dashboardComptable.ts),
// jamais depuis les modules opérationnels (ventes, stock, caisse) — voir
// lib/comptabilite/etatsFinanciers.ts pour la même doctrine sur les états
// financiers. Remplace l'ancien tableau de bord opérationnel (encaissements/
// décaissements packs) qui masquait le vrai résultat comptable sous un solde de
// trésorerie ; /api/comptable/synthese reste utilisé par d'autres pages
// (balance, trésorerie) mais plus comme source de ce tableau de bord.

import React, { useMemo } from "react";
import {
  TrendingUp, ShoppingCart, Receipt, Landmark, Scale,
  Users, Building2, Wallet, PiggyBank, CreditCard,
  Percent, ArrowDownToLine, ArrowUpFromLine,
  Boxes, Gauge, FileStack, ListChecks, AlertTriangle, Building,
  RefreshCw, PauseCircle, Paperclip,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { getStatCardHue } from "@/components/ui/statCardTheme";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types (miroir de lib/comptabilite/dashboardComptable.ts) ───────────────

interface KpisDashboard {
  chiffreAffaires: number; achats: number; charges: number; produits: number; resultat: number;
  creancesClients: number; dettesFournisseurs: number;
  tresorerie: number; soldeBancaire: number; soldeCaisse: number;
  tvaCollectee: number; tvaDeductible: number; tvaADecaisser: number; creditTva: number;
  immobilisations: number; amortissements: number; valeurNetteImmobilisations: number;
  resultatProvisoire: number;
  nombreEcritures: number; ecrituresEnAttente: number; ecrituresNonEquilibrees: number;
  rapprochementsEnAttente: number;
  ecrituresCompteAttente: number;
}
interface EcritureAttente {
  ligneId: number; ecritureId: number; reference: string; montant: number; date: string;
  origine: string; libelle: string; utilisateur: string | null; aPiece: boolean; delaiJours: number;
}
interface PointSerie { mois: string; label: string; valeur: number }
interface PointResultatMensuel { mois: string; label: string; produits: number; charges: number; resultat: number }
interface GraphiquesDashboard {
  evolutionCA: PointSerie[];
  evolutionCharges: PointSerie[];
  evolutionResultat: PointSerie[];
  evolutionTresorerie: PointSerie[];
  creancesClients: PointSerie[];
  dettesFournisseurs: PointSerie[];
  depensesParCategorie: { categorie: string; montant: number }[];
  revenusParActivite: { activite: string; montant: number }[];
  resultatMensuel: PointResultatMensuel[];
  comparaisonNN1: {
    labels: string[];
    anneeActuelle: { annee: number; valeurs: number[] };
    anneePrecedente: { annee: number; valeurs: number[] };
  };
}
interface DashboardResponse { data: { kpis: KpisDashboard; graphiques: GraphiquesDashboard; ecrituresAttente: EcritureAttente[] } }

// ── Helpers chart SVG (mêmes conventions que l'ancien chart évolution) ─────

const VB_W = 1000;
const VB_H = 160;

function buildLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(p.x * VB_W).toFixed(1)} ${(p.y * VB_H).toFixed(1)}`).join(" ");
}
function buildArea(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  const line = buildLine(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${line} L ${(last.x * VB_W).toFixed(1)} ${VB_H} L ${(first.x * VB_W).toFixed(1)} ${VB_H} Z`;
}
function normalize(values: number[]): { pts: { x: number; y: number }[]; min: number; max: number } {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({ x: values.length === 1 ? 0.5 : i / (values.length - 1), y: 1 - (v - min) / range }));
  return { pts, min, max };
}
// ── Sub-composants ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color, bg, alerte }: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color: string; bg: string; alerte?: boolean;
}) {
  const h = getStatCardHue(color, bg);
  return (
    <div className={`group relative overflow-hidden bg-gradient-to-br ${h.wrap} to-white rounded-2xl p-4 shadow-sm border transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${alerte ? "bg-red-400" : h.bar}`} />
      <div className={`${bg} p-2 rounded-xl inline-flex mb-2.5 group-hover:scale-110 transition-transform duration-300 ease-out`}>
        <Icon className={`${color} w-4 h-4`} />
      </div>
      <p className={`text-xs font-semibold mb-1 ${h.labelText}`}>{label}</p>
      <p className={`text-xl font-bold leading-tight ${h.text}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mt-2">{children}</h3>;
}

/** Mini chart ligne+aire pour une série mensuelle (évolution CA/charges/résultat/trésorerie/créances/dettes). */
function EvolutionChart({ title, sub, data, color, negatifAutorise }: {
  title: string; sub?: string; data: PointSerie[]; color: string; negatifAutorise?: boolean;
}) {
  const values = data.map((d) => d.valeur);
  const { pts, min, max } = normalize(values);
  const zeroY = negatifAutorise ? 1 - (0 - min) / ((max - min) || 1) : null;
  const dernier = data[data.length - 1]?.valeur ?? 0;
  // SVG id : jamais d'espaces/apostrophes (le titre peut en contenir), sinon
  // url(#grad-...) ne résout plus la référence et le dégradé disparaît.
  const gradId = `grad-${title.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-bold text-slate-800">{title}</h4>
          {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
        </div>
        <span className="text-sm font-bold" style={{ color }}>{formatCurrency(dernier)}</span>
      </div>
      {data.length > 1 ? (
        <div className="relative" style={{ height: 120 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={color} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {zeroY != null && <line x1="0" x2={VB_W} y1={zeroY * VB_H} y2={zeroY * VB_H} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
            <path d={buildArea(pts)} fill={`url(#${gradId})`} />
            <path d={buildLine(pts)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="flex justify-between mt-1">
            {data.filter((_, i) => i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)).map((d) => (
              <span key={d.mois} className="text-[10px] text-slate-400">{d.label}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="h-[120px] flex items-center justify-center text-slate-400 text-sm">Pas assez de données</div>
      )}
    </div>
  );
}

/** Liste à barres horizontales (dépenses par catégorie / revenus par activité). */
function BarList({ title, items, color }: { title: string; items: { label: string; montant: number }[]; color: string }) {
  const total = items.reduce((s, i) => s + Math.abs(i.montant), 0) || 1;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
      <h4 className="text-sm font-bold text-slate-800 mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">Aucun mouvement sur l&apos;exercice en cours.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 8).map((item) => {
            const pct = Math.round((Math.abs(item.montant) / total) * 100);
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">{item.label}</span>
                  <span className="text-slate-800 font-bold">{formatCurrency(item.montant)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Barres verticales résultat mensuel (colorées selon le signe). */
function ResultatMensuelChart({ data }: { data: PointResultatMensuel[] }) {
  const max = Math.max(...data.map((d) => Math.abs(d.resultat)), 1);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
      <h4 className="text-sm font-bold text-slate-800 mb-3">Résultat mensuel</h4>
      {data.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-6">Pas assez de données</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: 130 }}>
          {data.map((d) => {
            const h = Math.max(2, (Math.abs(d.resultat) / max) * 100);
            return (
              <div key={d.mois} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.label} : ${formatCurrency(d.resultat)}`}>
                <div className="w-full flex flex-col justify-end" style={{ height: "100%" }}>
                  <div className={`w-full rounded-t ${d.resultat >= 0 ? "bg-emerald-500" : "bg-red-400"}`} style={{ height: `${h}%` }} />
                </div>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">{d.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Comparaison N/N-1 : deux lignes mensuelles superposées (CA). */
function ComparaisonNN1Chart({ data }: { data: GraphiquesDashboard["comparaisonNN1"] }) {
  const toutesValeurs = [...data.anneeActuelle.valeurs, ...data.anneePrecedente.valeurs];
  const max = Math.max(...toutesValeurs, 1);
  const ptsA = data.anneeActuelle.valeurs.map((v, i) => ({ x: i / 11, y: 1 - v / max }));
  const ptsP = data.anneePrecedente.valeurs.map((v, i) => ({ x: i / 11, y: 1 - v / max }));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-800">Comparaison chiffre d&apos;affaires — {data.anneeActuelle.annee} vs {data.anneePrecedente.annee}</h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-600 inline-block rounded" />{data.anneeActuelle.annee}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-300 inline-block rounded" />{data.anneePrecedente.annee}</span>
        </div>
      </div>
      <div className="relative" style={{ height: 130 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
          <path d={buildLine(ptsP)} fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="5 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={buildLine(ptsA)} fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex justify-between mt-1">
          {data.labels.map((l) => <span key={l} className="text-[9px] text-slate-400">{l}</span>)}
        </div>
      </div>
    </div>
  );
}

/** Surveillance des comptes d'attente (CDC §41) : détail des lignes du compte 471 non résolues. */
function ComptesAttenteWidget({ items }: { items: EcritureAttente[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <PauseCircle size={16} className={items.length > 0 ? "text-red-500" : "text-emerald-600"} />
          {items.length > 0 ? "🔴" : "🟢"} {items.length} écriture{items.length !== 1 ? "s" : ""} en attente d&apos;imputation (compte 471)
        </h4>
      </div>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">Aucune écriture en attente sur le compte d&apos;attente 471.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase">Référence</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase">Origine</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase">Date</th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-600 uppercase">Montant</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600 uppercase">Utilisateur</th>
                <th className="text-center px-4 py-2.5 font-semibold text-slate-600 uppercase">Pièce</th>
                <th className="text-right px-4 py-2.5 font-semibold text-slate-600 uppercase">Délai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it) => (
                <tr key={it.ligneId} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-slate-700">{it.reference}</td>
                  <td className="px-4 py-2.5 text-slate-500">{it.origine}</td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDateShort(it.date)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{formatCurrency(it.montant)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{it.utilisateur ?? "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {it.aPiece ? <Paperclip size={13} className="text-emerald-600 inline" /> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${it.delaiJours > 30 ? "text-red-600" : it.delaiJours > 7 ? "text-amber-600" : "text-slate-500"}`}>
                    {it.delaiJours} j
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ComptableTableauBordPage() {
  const { data, loading, refetch } = useApi<DashboardResponse>("/api/comptable/dashboard");
  const k = data?.data.kpis;
  const g = data?.data.graphiques;

  const anneeCourante = useMemo(() => new Date().getFullYear(), []);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Chargement du tableau de bord comptable…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Tableau de bord — Comptabilité Générale</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Activité de l&apos;exercice {anneeCourante} · situation de bilan à ce jour
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => refetch()}
            className="p-2 bg-white border border-slate-200 shadow-sm text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <RefreshCw size={18} />
          </button>
          {AIDE_COMPTABLE["synthese"] && <AideComptable contenu={AIDE_COMPTABLE["synthese"]} />}
        </div>
      </div>

      {/* ── KPI — Activité (exercice en cours) ── */}
      <SectionTitle>Activité — exercice {anneeCourante}</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Chiffre d'affaires" value={formatCurrency(k?.chiffreAffaires ?? 0)} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
        <KpiCard label="Achats" value={formatCurrency(k?.achats ?? 0)} icon={ShoppingCart} color="text-orange-600" bg="bg-orange-50" />
        <KpiCard label="Charges" value={formatCurrency(k?.charges ?? 0)} icon={Receipt} color="text-red-500" bg="bg-red-50" />
        <KpiCard label="Produits" value={formatCurrency(k?.produits ?? 0)} icon={Landmark} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard label="Résultat" value={formatCurrency(k?.resultat ?? 0)} icon={Scale}
          color={(k?.resultat ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} bg={(k?.resultat ?? 0) >= 0 ? "bg-emerald-50" : "bg-red-50"} />
      </div>

      {/* ── KPI — Bilan (à date) ── */}
      <SectionTitle>Bilan — à ce jour</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Créances clients" value={formatCurrency(k?.creancesClients ?? 0)} icon={Users} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard label="Dettes fournisseurs" value={formatCurrency(k?.dettesFournisseurs ?? 0)} icon={Building2} color="text-orange-600" bg="bg-orange-50" />
        <KpiCard label="Trésorerie" value={formatCurrency(k?.tresorerie ?? 0)} icon={Wallet} color="text-emerald-600" bg="bg-emerald-50" />
        <KpiCard label="Solde bancaire (521)" value={formatCurrency(k?.soldeBancaire ?? 0)} icon={Landmark} color="text-indigo-600" bg="bg-indigo-50" />
        <KpiCard label="Solde caisse (57)" value={formatCurrency(k?.soldeCaisse ?? 0)} icon={PiggyBank} color="text-teal-600" bg="bg-teal-50" />
        <KpiCard label="Immobilisations (brut)" value={formatCurrency(k?.immobilisations ?? 0)} icon={Building} color="text-slate-600" bg="bg-slate-100" />
        <KpiCard label="Amortissements cumulés" value={formatCurrency(k?.amortissements ?? 0)} icon={Boxes} color="text-slate-600" bg="bg-slate-100" />
        <KpiCard label="Résultat provisoire (non clôturé)" value={formatCurrency(k?.resultatProvisoire ?? 0)} icon={Gauge}
          color={(k?.resultatProvisoire ?? 0) >= 0 ? "text-emerald-600" : "text-red-500"} bg={(k?.resultatProvisoire ?? 0) >= 0 ? "bg-emerald-50" : "bg-red-50"} />
      </div>

      {/* ── KPI — TVA (mois en cours) ── */}
      <SectionTitle>TVA — mois en cours</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="TVA collectée" value={formatCurrency(k?.tvaCollectee ?? 0)} icon={Percent} color="text-red-500" bg="bg-red-50" />
        <KpiCard label="TVA déductible" value={formatCurrency(k?.tvaDeductible ?? 0)} icon={Percent} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard label="TVA à décaisser" value={formatCurrency(k?.tvaADecaisser ?? 0)} icon={ArrowUpFromLine} color="text-orange-600" bg="bg-orange-50" />
        <KpiCard label="Crédit de TVA" value={formatCurrency(k?.creditTva ?? 0)} icon={ArrowDownToLine} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      {/* ── KPI — Qualité des écritures ── */}
      <SectionTitle>Qualité des écritures</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Nombre d'écritures" value={String(k?.nombreEcritures ?? 0)} icon={FileStack} color="text-slate-600" bg="bg-slate-100" />
        <KpiCard label="Écritures en attente" value={String(k?.ecrituresEnAttente ?? 0)} icon={ListChecks} color="text-amber-600" bg="bg-amber-50" alerte={(k?.ecrituresEnAttente ?? 0) > 0} />
        <KpiCard label="Écritures non équilibrées" value={String(k?.ecrituresNonEquilibrees ?? 0)} icon={AlertTriangle} color="text-red-500" bg="bg-red-50" alerte={(k?.ecrituresNonEquilibrees ?? 0) > 0} />
        <KpiCard label="Rapprochements en attente" value={String(k?.rapprochementsEnAttente ?? 0)} icon={CreditCard} color="text-amber-600" bg="bg-amber-50" alerte={(k?.rapprochementsEnAttente ?? 0) > 0} />
        <KpiCard label="Comptes d'attente (471)" value={String(k?.ecrituresCompteAttente ?? 0)} icon={PauseCircle} color="text-amber-600" bg="bg-amber-50" alerte={(k?.ecrituresCompteAttente ?? 0) > 0} />
      </div>

      {/* ── Comptes d'attente (CDC §41) ── */}
      <SectionTitle>Surveillance des comptes d&apos;attente</SectionTitle>
      <ComptesAttenteWidget items={data?.data.ecrituresAttente ?? []} />

      {/* ── Graphiques ── */}
      <SectionTitle>Graphiques</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EvolutionChart title="Évolution du chiffre d'affaires" sub="12 derniers mois" data={g?.evolutionCA ?? []} color="#10b981" />
        <EvolutionChart title="Évolution des charges" sub="12 derniers mois" data={g?.evolutionCharges ?? []} color="#ef4444" />
        <EvolutionChart title="Évolution du résultat" sub="12 derniers mois" data={g?.evolutionResultat ?? []} color="#7c3aed" negatifAutorise />
        <EvolutionChart title="Évolution de la trésorerie" sub="solde cumulé, 12 derniers mois" data={g?.evolutionTresorerie ?? []} color="#0ea5e9" negatifAutorise />
        <EvolutionChart title="Créances clients" sub="solde cumulé, 12 derniers mois" data={g?.creancesClients ?? []} color="#2563eb" />
        <EvolutionChart title="Dettes fournisseurs" sub="solde cumulé, 12 derniers mois" data={g?.dettesFournisseurs ?? []} color="#f97316" />
        <BarList title="Dépenses par catégorie" items={(g?.depensesParCategorie ?? []).map((d) => ({ label: d.categorie, montant: d.montant }))} color="bg-red-500" />
        <BarList title="Revenus par activité" items={(g?.revenusParActivite ?? []).map((d) => ({ label: d.activite, montant: d.montant }))} color="bg-emerald-500" />
        <ResultatMensuelChart data={g?.resultatMensuel ?? []} />
        {g?.comparaisonNN1 && <ComparaisonNN1Chart data={g.comparaisonNN1} />}
      </div>

      <p className="text-xs text-slate-400 text-center pt-1">
        Tous les indicateurs ci-dessus sont calculés depuis les écritures comptables validées — jamais depuis les modules de vente, stock ou caisse.
      </p>
    </main>
  );
}
