"use client";

import { Fragment, useState, useMemo } from "react";
import {
  BarChart2, RefreshCw, Search, CheckCircle2,
  AlertTriangle, TrendingDown, Shield, Info,
  ChevronDown, ChevronRight, Star, Clock, Wallet, ShoppingBag, CalendarDays,
  Sparkles, Brain, History,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types communs ─────────────────────────────────────────────────────────────

type ClasseRisque = "A" | "B" | "C" | "D" | "E";

// ─ Scoring risque (A→E) ───────────────────────────────────────────────────────

interface CriteresDetail {
  historiquePaiement: { nbEcheances: number; nbEnRetard: number; ratio: number };
  retardActif:        { joursMax: number };
  montantsDus:        { tauxRecouvrement: number; totalFinance: number };
  frequenceAchat:     { nbFinancements: number; bonus: boolean };
  anciennete:         { mois: number; bonus: boolean };
  bonusApplique:      boolean;
}

interface AffectationScore {
  id: number;
  portefeuilleId: number;
  portefeuille: { reference: string; nom: string | null; investisseur: string };
  client: {
    id: number; nom: string; telephone: string | null;
    niveauRisque: string | null; scoreSolvabilite: number | null;
  };
  classeRisque: ClasseRisque;
  _classeCalculee: ClasseRisque;
  criteresDetail: CriteresDetail;
  pourcentage: number; montantAlloue: number; actif: boolean; dateDebut: string;
  nbFinancements: number; totalFinance: number; totalRembourse: number;
  totalEncours: number; tauxRecouvrement: number;
}

interface ScoringData {
  affectations: AffectationScore[];
  repartition: Record<ClasseRisque, number>;
  total: number;
}

// ─ Scoring intelligent (0-100) ────────────────────────────────────────────────

interface ScoreBreakdown {
  historiquePaiement: { pts: number; max: 40; nbEcheances: number; nbEnRetard: number };
  rotation:           { pts: number; max: 30; nbRembourse: number; nbTotal: number };
  volumeAchat:        { pts: number; max: 30; montantTotal: number };
}

interface ClientSolvabilite {
  id: number; nom: string; telephone: string | null;
  scoreStocke: number | null; niveauStocke: string | null;
  scoreCalcule: number; niveau: string; recommandation: string;
  breakdown: ScoreBreakdown;
  historiqueScore: { score: number; niveau: string; raison: string | null; date: string }[];
}

interface SolvabiliteData {
  clients: ClientSolvabilite[];
  repartition: Record<string, number>;
  total: number;
  scoreMoyen: number;
}

// ── Config classes de risque ───────────────────────────────────────────────────

const CLASSE_CONFIG: Record<ClasseRisque, {
  label: string; desc: string; color: string; bg: string;
  icon: React.ElementType; barColor: string;
}> = {
  A: { label: "A — Très bon client", desc: "Aucun retard, historique sain, fidèle",       color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-300", icon: CheckCircle2,  barColor: "bg-emerald-500" },
  B: { label: "B — Bon client",      desc: "Retards ponctuels < 7j ou historique léger",  color: "text-blue-700",    bg: "bg-blue-50 border-blue-300",       icon: Shield,        barColor: "bg-blue-500" },
  C: { label: "C — Risque modéré",   desc: "Retards fréquents ou 7-15 jours",             color: "text-amber-700",   bg: "bg-amber-50 border-amber-300",     icon: Info,          barColor: "bg-amber-500" },
  D: { label: "D — Risque élevé",    desc: "Retards > 15 jours ou nombreux impayés",      color: "text-orange-700",  bg: "bg-orange-50 border-orange-300",   icon: AlertTriangle, barColor: "bg-orange-500" },
  E: { label: "E — Défaillant",      desc: "Défaut de paiement ou retard > 30 jours",     color: "text-red-700",     bg: "bg-red-50 border-red-400",         icon: TrendingDown,  barColor: "bg-red-500" },
};

const BADGE_RISQUE: Record<ClasseRisque, string> = {
  A: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  B: "bg-blue-100 text-blue-800 border border-blue-300",
  C: "bg-amber-100 text-amber-800 border border-amber-300",
  D: "bg-orange-100 text-orange-800 border border-orange-300",
  E: "bg-red-100 text-red-800 border border-red-400",
};

// ── Config niveaux solvabilité ─────────────────────────────────────────────────

const NIVEAU_CONFIG: Record<string, { color: string; bg: string; bar: string; badge: string }> = {
  Excellent: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-300", bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800 border border-emerald-300" },
  Bon:       { color: "text-blue-700",    bg: "bg-blue-50 border-blue-300",       bar: "bg-blue-500",    badge: "bg-blue-100 text-blue-800 border border-blue-300" },
  Modéré:    { color: "text-amber-700",   bg: "bg-amber-50 border-amber-300",     bar: "bg-amber-500",   badge: "bg-amber-100 text-amber-800 border border-amber-300" },
  Faible:    { color: "text-orange-700",  bg: "bg-orange-50 border-orange-300",   bar: "bg-orange-500",  badge: "bg-orange-100 text-orange-800 border border-orange-300" },
  Critique:  { color: "text-red-700",     bg: "bg-red-50 border-red-400",         bar: "bg-red-500",     badge: "bg-red-100 text-red-800 border border-red-400" },
};

const NIVEAUX_ORDER = ["Excellent", "Bon", "Modéré", "Faible", "Critique"];

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

function scoreColor(s: number) {
  if (s >= 80) return "text-emerald-600";
  if (s >= 60) return "text-blue-600";
  if (s >= 40) return "text-amber-600";
  if (s >= 20) return "text-orange-600";
  return "text-red-600";
}

function scoreBarColor(s: number) {
  if (s >= 80) return "bg-emerald-500";
  if (s >= 60) return "bg-blue-500";
  if (s >= 40) return "bg-amber-500";
  if (s >= 20) return "bg-orange-500";
  return "bg-red-500";
}

// ── Sous-composant : détail critères risque ────────────────────────────────────

function CriteresRisquePanel({ d }: { d: CriteresDetail }) {
  const criteres = [
    { icon: Clock,        label: "Historique paiement",
      value: d.historiquePaiement.nbEcheances > 0
        ? `${d.historiquePaiement.nbEnRetard}/${d.historiquePaiement.nbEcheances} échéances en retard (${d.historiquePaiement.ratio}%)`
        : "Aucune échéance enregistrée",
      ok: d.historiquePaiement.ratio === 0, bad: d.historiquePaiement.ratio >= 30 },
    { icon: AlertTriangle, label: "Retard actif",
      value: d.retardActif.joursMax === 0 ? "Aucun retard actif" : `${d.retardActif.joursMax} jours de retard`,
      ok: d.retardActif.joursMax === 0, bad: d.retardActif.joursMax > 15 },
    { icon: Wallet,       label: "Montants dus",
      value: `Taux de recouvrement : ${d.montantsDus.tauxRecouvrement}%`,
      ok: d.montantsDus.tauxRecouvrement >= 80, bad: d.montantsDus.tauxRecouvrement > 0 && d.montantsDus.tauxRecouvrement < 40 },
    { icon: ShoppingBag, label: "Fréquence d'achat",
      value: `${d.frequenceAchat.nbFinancements} financement(s)${d.frequenceAchat.bonus ? " — bonus activé (≥ 3)" : ""}`,
      ok: d.frequenceAchat.bonus, bad: d.frequenceAchat.nbFinancements === 0 },
    { icon: CalendarDays, label: "Ancienneté",
      value: `${d.anciennete.mois} mois${d.anciennete.bonus ? " — bonus activé (≥ 6 mois)" : ""}`,
      ok: d.anciennete.bonus, bad: d.anciennete.mois === 0 },
  ];
  return (
    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
        {criteres.map((c) => {
          const Icon = c.icon;
          const cls = c.ok ? "text-emerald-700 bg-emerald-50 border-emerald-200"
            : c.bad ? "text-red-700 bg-red-50 border-red-200"
            : "text-amber-700 bg-amber-50 border-amber-200";
          return (
            <div key={c.label} className={`rounded-lg border p-2.5 ${cls}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-semibold">{c.label}</span>
              </div>
              <p className="text-xs opacity-80">{c.value}</p>
            </div>
          );
        })}
      </div>
      {d.bonusApplique && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5 w-fit">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="font-medium">Bonus fidélité appliqué — classe remontée d&apos;un niveau</span>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant : mini barre de score ───────────────────────────────────────

function CritereBar({ label, pts, max, detail }: { label: string; pts: number; max: number; detail: string }) {
  const pct = max > 0 ? (pts / max) * 100 : 0;
  const barCls = pct >= 75 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-red-400";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-700">{pts}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-0.5">{detail}</p>
    </div>
  );
}

// ── Sous-composant : détail historique ────────────────────────────────────────

function HistoriquePanel({ items }: { items: { score: number; niveau: string; raison: string | null; date: string }[] }) {
  if (items.length === 0) return <p className="text-xs text-slate-400 italic">Aucun historique</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((h, i) => {
        const cfg = NIVEAU_CONFIG[h.niveau] ?? NIVEAU_CONFIG.Modéré;
        return (
          <div key={i} className={`text-xs rounded-md border px-2 py-1 ${cfg.badge}`}>
            <span className="font-bold">{h.score}</span>
            <span className="opacity-60 ml-1">{new Date(h.date).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab : Gestion des Risques A→E ─────────────────────────────────────────────

function TabRisque() {
  const [search,       setSearch]       = useState("");
  const [filtreClasse, setFiltreClasse] = useState<ClasseRisque | "TOUS">("TOUS");
  const [filtrePF,     setFiltrePF]     = useState<string>("");
  const [expandedId,   setExpandedId]   = useState<number | null>(null);

  const { data, loading, error, refetch } = useApi<ScoringData>("/api/admin/ria/scoring");
  const { mutate: recalculer, loading: recalcLoading } = useMutation<
    { success: boolean; message?: string; nbMaj: number; nbTotal: number }, Record<string, never>
  >("/api/admin/ria/scoring", "POST");

  async function handleRecalculer() {
    const res = await recalculer({});
    if (res?.success) { toast.success(res.message ?? "Scores recalculés"); refetch(); }
    else toast.error("Erreur lors du recalcul");
  }

  const portefeuilles = useMemo(() => {
    if (!data) return [];
    const seen = new Set<number>();
    return data.affectations
      .filter((a) => { if (seen.has(a.portefeuilleId)) return false; seen.add(a.portefeuilleId); return true; })
      .map((a) => ({ id: a.portefeuilleId, ref: a.portefeuille.reference, nom: a.portefeuille.nom }));
  }, [data]);

  const liste = useMemo(() => {
    if (!data) return [];
    let l = [...data.affectations];
    if (filtreClasse !== "TOUS") l = l.filter((a) => a.classeRisque === filtreClasse);
    if (filtrePF) l = l.filter((a) => String(a.portefeuilleId) === filtrePF);
    if (search) { const q = search.toLowerCase(); l = l.filter((a) => a.client.nom.toLowerCase().includes(q) || a.portefeuille.reference.toLowerCase().includes(q)); }
    return l;
  }, [data, filtreClasse, filtrePF, search]);

  if (loading) return <div className="py-12 flex items-center justify-center gap-2 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin" /> Chargement…</div>;
  if (error || !data) return <div className="py-8 text-red-600">Erreur. <button onClick={refetch} className="underline">Réessayer</button></div>;

  const maxR = Math.max(...Object.values(data.repartition), 1);

  return (
    <div className="space-y-5">
      {/* Actions */}
      <div className="flex justify-end">
        <button onClick={handleRecalculer} disabled={recalcLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${recalcLoading ? "animate-spin" : ""}`} /> Recalculer
        </button>
      </div>

      {/* Répartition */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-emerald-600" />
          <span className="font-medium text-slate-700 text-sm">Répartition par classe</span>
          <span className="ml-auto text-xs text-slate-400">{data.total} affectation(s)</span>
        </div>
        <div className="space-y-2.5">
          {(["A","B","C","D","E"] as ClasseRisque[]).map((cls) => {
            const cfg = CLASSE_CONFIG[cls]; const count = data.repartition[cls] ?? 0;
            const pct = data.total > 0 ? (count / data.total) * 100 : 0; const Icon = cfg.icon;
            return (
              <div key={cls} className="flex items-center gap-3">
                <button onClick={() => setFiltreClasse(filtreClasse === cls ? "TOUS" : cls)}
                  className={`flex items-center gap-1.5 w-36 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${filtreClasse === cls ? `${cfg.bg} ${cfg.color}` : "border-transparent text-slate-500 hover:bg-slate-50"}`}>
                  <Icon className="w-3 h-3" />{cls}<span className="ml-auto">{count}</span>
                </button>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${cfg.barColor}`} style={{ width: `${(count / maxR) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {(["A","B","C","D","E"] as ClasseRisque[]).map((cls) => {
          const cfg = CLASSE_CONFIG[cls]; const Icon = cfg.icon;
          return (
            <div key={cls} className={`rounded-lg border p-3 ${cfg.bg}`}>
              <div className="flex items-center gap-1.5 mb-1"><Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p></div>
              <p className="text-xs text-slate-500">{cfg.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Note critères */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        <div className="flex items-center gap-1.5 font-semibold mb-1.5"><Star className="w-3.5 h-3.5" /> 5 critères automatiques</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div><strong>1. Historique paiement</strong> — ratio écheances en retard</div>
          <div><strong>2. Retards actifs</strong> — jours retard sur encours actif</div>
          <div><strong>3. Montants dus</strong> — taux de recouvrement global</div>
          <div><strong>4. Fréquence d&apos;achat</strong> — nb financements (bonus ≥3)</div>
          <div><strong>5. Ancienneté</strong> — durée relation (bonus ≥6 mois)</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher client, portefeuille…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300" />
        </div>
        <select value={filtreClasse} onChange={(e) => setFiltreClasse(e.target.value as ClasseRisque | "TOUS")}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="TOUS">Toutes les classes</option>
          {(["A","B","C","D","E"] as ClasseRisque[]).map((c) => <option key={c} value={c}>{CLASSE_CONFIG[c].label}</option>)}
        </select>
        <select value={filtrePF} onChange={(e) => setFiltrePF(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
          <option value="">Tous les portefeuilles</option>
          {portefeuilles.map((pf) => <option key={pf.id} value={String(pf.id)}>{pf.ref}{pf.nom ? ` — ${pf.nom}` : ""}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 w-6"></th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Portefeuille</th>
                <th className="px-4 py-3 text-left">Investisseur</th>
                <th className="px-4 py-3 text-center">Classe actuelle</th>
                <th className="px-4 py-3 text-center">Calculée</th>
                <th className="px-4 py-3 text-center">Fin. / Ancienneté</th>
                <th className="px-4 py-3 text-right">Taux recouvr.</th>
                <th className="px-4 py-3 text-right">Encours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Aucun résultat</td></tr>}
              {liste.map((aff) => {
                const diverge = aff.classeRisque !== aff._classeCalculee;
                const expanded = expandedId === aff.id;
                const cfg = CLASSE_CONFIG[aff.classeRisque];
                return (
                  <Fragment key={aff.id}>
                    <tr onClick={() => setExpandedId(expanded ? null : aff.id)}
                      className={`cursor-pointer hover:bg-slate-50 ${diverge ? "bg-amber-50/30" : ""} ${expanded ? "bg-slate-50" : ""}`}>
                      <td className="px-2 py-3 text-center text-slate-400">
                        {expanded ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{aff.client.nom}</p>
                        {aff.client.telephone && <p className="text-xs text-slate-400">{aff.client.telephone}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{aff.portefeuille.reference}{aff.portefeuille.nom ? ` — ${aff.portefeuille.nom}` : ""}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{aff.portefeuille.investisseur}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${BADGE_RISQUE[aff.classeRisque]}`}>{aff.classeRisque}</span>
                        <p className={`text-xs mt-0.5 ${cfg.color} opacity-70`}>{cfg.label.split("—")[1]?.trim()}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-md ${BADGE_RISQUE[aff._classeCalculee]}`}>{aff._classeCalculee}</span>
                        {diverge && <p className="text-xs text-amber-600 mt-0.5">À recalculer</p>}
                        {aff.criteresDetail?.bonusApplique && <p className="text-xs text-emerald-600 mt-0.5 flex items-center justify-center gap-0.5"><Sparkles className="w-3 h-3" /> bonus</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`text-xs ${aff.criteresDetail?.frequenceAchat.bonus ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                            <ShoppingBag className="w-3 h-3 inline mr-0.5" />{aff.criteresDetail?.frequenceAchat.nbFinancements ?? aff.nbFinancements} fin.
                          </span>
                          <span className={`text-xs ${aff.criteresDetail?.anciennete.bonus ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                            <CalendarDays className="w-3 h-3 inline mr-0.5" />{aff.criteresDetail?.anciennete.mois ?? "—"} mois
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${aff.tauxRecouvrement >= 80 ? "bg-emerald-500" : aff.tauxRecouvrement >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, aff.tauxRecouvrement)}%` }} />
                          </div>
                          <span className="text-xs text-slate-600">{aff.tauxRecouvrement.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmt(aff.totalEncours)}</td>
                    </tr>
                    {expanded && aff.criteresDetail && (
                      <tr><td colSpan={9} className="p-0"><CriteresRisquePanel d={aff.criteresDetail} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {liste.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            {liste.length} affectation(s) — cliquer une ligne pour le détail des critères
            {liste.filter((a) => a.classeRisque !== a._classeCalculee).length > 0 && (
              <span className="ml-2 text-amber-600">· {liste.filter((a) => a.classeRisque !== a._classeCalculee).length} à recalculer</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab : Scoring Intelligent 0-100 ───────────────────────────────────────────

function TabSolvabilite() {
  const [search,       setSearch]       = useState("");
  const [filtreNiveau, setFiltreNiveau] = useState<string>("TOUS");
  const [expandedId,   setExpandedId]   = useState<number | null>(null);

  const { data, loading, error, refetch } = useApi<SolvabiliteData>("/api/admin/ria/solvabilite");
  const { mutate: recalculer, loading: recalcLoading } = useMutation<
    { success: boolean; message?: string; nbMaj: number; nbTotal: number }, Record<string, never>
  >("/api/admin/ria/solvabilite", "POST");

  async function handleRecalculer() {
    const res = await recalculer({});
    if (res?.success) { toast.success(res.message ?? "Scores mis à jour"); refetch(); }
    else toast.error("Erreur lors du recalcul");
  }

  const liste = useMemo(() => {
    if (!data) return [];
    let l = [...data.clients];
    if (filtreNiveau !== "TOUS") l = l.filter((c) => c.niveau === filtreNiveau);
    if (search) { const q = search.toLowerCase(); l = l.filter((c) => c.nom.toLowerCase().includes(q) || (c.telephone ?? "").includes(q)); }
    return l.sort((a, b) => b.scoreCalcule - a.scoreCalcule);
  }, [data, filtreNiveau, search]);

  if (loading) return <div className="py-12 flex items-center justify-center gap-2 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin" /> Chargement…</div>;
  if (error || !data) return <div className="py-8 text-red-600">Erreur. <button onClick={refetch} className="underline">Réessayer</button></div>;

  const maxRep = Math.max(...Object.values(data.repartition), 1);

  return (
    <div className="space-y-5">
      {/* Stats + Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-3xl font-bold ${scoreColor(data.scoreMoyen)}`}>{data.scoreMoyen}</p>
            <p className="text-xs text-slate-500 mt-0.5">Score moyen / 100</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-3xl font-bold text-slate-700">{data.total}</p>
            <p className="text-xs text-slate-500 mt-0.5">Clients scorés</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600">{data.repartition["Excellent"] ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5">Profils Excellents</p>
          </div>
        </div>
        <button onClick={handleRecalculer} disabled={recalcLoading}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 shrink-0">
          <RefreshCw className={`w-4 h-4 ${recalcLoading ? "animate-spin" : ""}`} /> Recalculer & Sauvegarder
        </button>
      </div>

      {/* Répartition niveaux */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-emerald-600" />
          <span className="font-medium text-slate-700 text-sm">Répartition par niveau de solvabilité</span>
        </div>
        <div className="space-y-2.5">
          {NIVEAUX_ORDER.map((niv) => {
            const cfg = NIVEAU_CONFIG[niv]; const count = data.repartition[niv] ?? 0;
            const pct = data.total > 0 ? (count / data.total) * 100 : 0;
            return (
              <div key={niv} className="flex items-center gap-3">
                <button onClick={() => setFiltreNiveau(filtreNiveau === niv ? "TOUS" : niv)}
                  className={`flex items-center justify-between w-28 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${filtreNiveau === niv ? `${cfg.bg} ${cfg.color}` : "border-transparent text-slate-500 hover:bg-slate-50"}`}>
                  <span>{niv}</span><span className="text-slate-400">{count}</span>
                </button>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${(count / maxRep) * 100}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Légende critères */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 text-xs text-violet-800">
        <div className="flex items-center gap-1.5 font-semibold mb-2"><Brain className="w-3.5 h-3.5" /> Score de solvabilité — 3 critères (total 100 pts)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-violet-200 p-3">
            <div className="flex items-center gap-1.5 font-medium mb-1"><Clock className="w-3.5 h-3.5" /> Historique paiement <span className="ml-auto text-violet-600 font-bold">/ 40 pts</span></div>
            <p className="text-violet-700">Ratio des échéances payées à temps sur les écheances actives (PAYE = 1 pt · PARTIEL = 0.5 pt)</p>
          </div>
          <div className="bg-white rounded-lg border border-violet-200 p-3">
            <div className="flex items-center gap-1.5 font-medium mb-1"><RefreshCw className="w-3.5 h-3.5" /> Rotation <span className="ml-auto text-violet-600 font-bold">/ 30 pts</span></div>
            <p className="text-violet-700">Nombre de financements RIA intégralement remboursés (1 = 12 pts · 2 = 20 · 3 = 25 · 4+ = 30)</p>
          </div>
          <div className="bg-white rounded-lg border border-violet-200 p-3">
            <div className="flex items-center gap-1.5 font-medium mb-1"><ShoppingBag className="w-3.5 h-3.5" /> Volume d&apos;achat <span className="ml-auto text-violet-600 font-bold">/ 30 pts</span></div>
            <p className="text-violet-700">Montant total financé cumulé par paliers (50k→5 · 100k→8 · 200k→12 · 500k→17 · 1M→22 · 2M→26 · 5M+→30)</p>
          </div>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher client…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300" />
        </div>
        <select value={filtreNiveau} onChange={(e) => setFiltreNiveau(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300">
          <option value="TOUS">Tous les niveaux</option>
          {NIVEAUX_ORDER.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 w-6"></th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-center">Score calculé</th>
                <th className="px-4 py-3 text-center">Score stocké</th>
                <th className="px-4 py-3 text-center">Niveau</th>
                <th className="px-4 py-3 text-left min-w-64">Détail des critères</th>
                <th className="px-4 py-3 text-left">Recommandation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {liste.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucun résultat</td></tr>}
              {liste.map((c) => {
                const cfg = NIVEAU_CONFIG[c.niveau] ?? NIVEAU_CONFIG.Modéré;
                const changed = c.scoreStocke !== null && c.scoreStocke !== c.scoreCalcule;
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr onClick={() => setExpandedId(expanded ? null : c.id)}
                      className={`cursor-pointer hover:bg-slate-50 ${changed ? "bg-amber-50/20" : ""} ${expanded ? "bg-slate-50" : ""}`}>
                      <td className="px-2 py-3 text-center text-slate-400">
                        {expanded ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.nom}</p>
                        {c.telephone && <p className="text-xs text-slate-400">{c.telephone}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-2xl font-bold ${scoreColor(c.scoreCalcule)}`}>{c.scoreCalcule}</span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${scoreBarColor(c.scoreCalcule)}`} style={{ width: `${c.scoreCalcule}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.scoreStocke !== null ? (
                          <div>
                            <span className={`text-sm font-medium ${scoreColor(c.scoreStocke)}`}>{c.scoreStocke}</span>
                            {changed && <p className="text-xs text-amber-600 mt-0.5">obsolète</p>}
                          </div>
                        ) : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-md ${cfg.badge}`}>{c.niveau}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 min-w-48">
                          <CritereBar
                            label="Historique paiement"
                            pts={c.breakdown.historiquePaiement.pts}
                            max={40}
                            detail={c.breakdown.historiquePaiement.nbEcheances > 0
                              ? `${c.breakdown.historiquePaiement.nbEcheances - c.breakdown.historiquePaiement.nbEnRetard}/${c.breakdown.historiquePaiement.nbEcheances} payées`
                              : "Pas d'historique"}
                          />
                          <CritereBar
                            label="Rotation"
                            pts={c.breakdown.rotation.pts}
                            max={30}
                            detail={`${c.breakdown.rotation.nbRembourse}/${c.breakdown.rotation.nbTotal} remboursés`}
                          />
                          <CritereBar
                            label="Volume d'achat"
                            pts={c.breakdown.volumeAchat.pts}
                            max={30}
                            detail={fmt(c.breakdown.volumeAchat.montantTotal)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-xs ${cfg.color} max-w-56`}>{c.recommandation}</p>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-slate-50 border-t border-slate-100">
                          <div className="flex items-center gap-2 mb-2">
                            <History className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-xs font-medium text-slate-600">Historique des scores (5 derniers)</span>
                          </div>
                          <HistoriquePanel items={c.historiqueScore} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {liste.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            {liste.length} client(s) · cliquer pour voir l&apos;historique des scores
            {liste.filter((c) => c.scoreStocke !== null && c.scoreStocke !== c.scoreCalcule).length > 0 && (
              <span className="ml-2 text-amber-600">· {liste.filter((c) => c.scoreStocke !== null && c.scoreStocke !== c.scoreCalcule).length} score(s) obsolète(s) — pensez à recalculer</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const [tab, setTab] = useState<"risque" | "solvabilite">("risque");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Scoring & Gestion des Risques</h1>
        <p className="text-sm text-slate-500 mt-0.5">Classement A→E et score de solvabilité 0-100 par client</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("risque")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "risque" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Shield className="w-4 h-4" /> Gestion des Risques A→E
        </button>
        <button
          onClick={() => setTab("solvabilite")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "solvabilite" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          <Brain className="w-4 h-4" /> Scoring Intelligent 0-100
        </button>
      </div>

      {/* Contenu */}
      {tab === "risque"       && <TabRisque />}
      {tab === "solvabilite"  && <TabSolvabilite />}
    </div>
  );
}
