"use client";

import { use, useMemo, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import Link from "next/link";
import {
  RefreshCw, ArrowLeft, Wallet, TrendingUp, Activity,
  Users, BarChart2, Clock, CheckCircle2, XCircle, Star,
  ChevronRight, Edit2, Save, X, PieChart, AlertTriangle,
  UserCheck, UserMinus, UserX, Target, Percent,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Membre { id: number; nom: string; prenom: string; email: string; telephone: string | null }
interface Affectation {
  id: number; actif: boolean; pourcentage: number; montantAlloue: number;
  classeRisque: string; notes: string | null; createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string | null; niveauRisque: string | null; scoreSolvabilite: number | null };
  _count: { financements: number };
}
interface Financement {
  id: number; reference: string; montantFinance: number; encours: number;
  statut: string; dateFinancement: string;
  client: { id: number; nom: string; prenom: string; telephone: string | null };
}
interface Mouvement {
  id: number; type: string; sens: string; montant: number;
  libelle: string | null; createdAt: string;
}
interface Distribution {
  id: number; mois: number; annee: number; statut: string;
  montantGenere: number; montantDistribue: number;
  montantReinvesti: number; fondSecurite: number;
}
interface Depot   { id: number; reference: string; montant: number; statut: string; createdAt: string }
interface Retrait { id: number; reference: string; montant: number; statut: string; createdAt: string }

interface AnalyseData {
  dureeMois: number; dureeAns: number;
  // Financière
  capitalInvesti: number; capitalRecupere: number;
  beneficeBrut: number; beneficeNet: number;
  rendementMensuel: number; rendementAnnuel: number;
  roi: number; triSimplifiee: number;
  cashFlowNet: number; cashFlowEntrees: number; cashFlowSorties: number;
  // Commerciale
  nbClientsFinances: number; nouveauxClients: number;
  clientsActifs: number; clientsInactifs: number; clientsPerdus: number;
  // Recouvrement
  montantAttendu: number; montantRecouvre: number; ecart: number;
  tauxRecouvrement: number; tauxImpayes: number;
  encoursImpayes: number; totalEncours: number;
  // Historique
  evolutionMensuelle: { mois: number; annee: number; montantGenere: number; montantDistribue: number; rendementMois: number }[];
}

interface Portefeuille {
  id: number; reference: string; nom: string | null; actif: boolean; notes: string | null;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; capitalBloque: number;
  beneficesGeneres: number; beneficesDistribues: number;
  beneficesReinvestis: number; fondSecurite: number;
  createdAt: string;
  profilRIA: { id: number; numero: string | null; gestionnaire: { member: Membre } };
  affectations?: Affectation[];
  financements: Financement[];
  mouvements:   Mouvement[];
  distributions: Distribution[];
  depots:   Depot[];
  retraits: Retrait[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt     = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n ?? 0)));
const toNum   = (v: unknown) => Number(v ?? 0);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");

const MOIS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const RISQUE_CLS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-red-100 text-red-800",
};

const MOV_COLORS: Record<string, string> = {
  DEPOT: "text-emerald-600", RETRAIT: "text-red-500",
  FINANCEMENT_CLIENT: "text-blue-600", REMBOURSEMENT_CLIENT: "text-violet-600",
  BENEFICE_GENERE: "text-amber-600", BENEFICE_DISTRIBUE: "text-emerald-600",
  BENEFICE_REINVESTI: "text-teal-600", FOND_SECURITE: "text-slate-500",
  AJUSTEMENT: "text-orange-500",
};

const SLICE_COLORS = [
  "#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6",
  "#06b6d4","#f97316","#84cc16","#ec4899","#14b8a6",
];

// ── Donut SVG ─────────────────────────────────────────────────────────────────

type Arc = { pct: number; color: string; label: string; dash: number; offset: number; cumAfter: number };

function DonutChart({ slices }: { slices: { pct: number; color: string; label: string }[] }) {
  const r = 38;
  const cx = 50;
  const cy = 50;
  const circ = 2 * Math.PI * r;

  const arcs = slices
    .filter((s) => s.pct > 0)
    .reduce<Arc[]>((acc, s) => {
      const prevCum = acc.length > 0 ? acc[acc.length - 1].cumAfter : 0;
      const dash    = (s.pct / 100) * circ;
      const offset  = -(prevCum * circ) / 100;
      return [...acc, { ...s, dash, offset, cumAfter: prevCum + s.pct }];
    }, []);

  return (
    <svg viewBox="0 0 100 100" className="w-36 h-36 -rotate-90">
      {arcs.map((a, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={a.color}
          strokeWidth="20"
          strokeDasharray={`${a.dash} ${circ}`}
          strokeDashoffset={a.offset}
        />
      ))}
      <circle cx={cx} cy={cy} r={27} fill="white" />
    </svg>
  );
}

// ── Barre capital ─────────────────────────────────────────────────────────────

function CapitalBar({ investi, disponible, engage, bloque }: {
  investi: number; disponible: number; engage: number; bloque: number;
}) {
  const total = investi || 1;
  const pDispo  = Math.min(100, (disponible / total) * 100);
  const pEngage = Math.min(100, (engage    / total) * 100);
  const pBloque = Math.min(100, (bloque    / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        <div className="bg-emerald-400 transition-all" style={{ width: `${pDispo}%` }} title={`Disponible ${pDispo.toFixed(1)}%`} />
        <div className="bg-blue-400 transition-all"    style={{ width: `${pEngage}%` }} title={`Engagé ${pEngage.toFixed(1)}%`} />
        <div className="bg-red-300 transition-all"     style={{ width: `${pBloque}%` }} title={`Bloqué ${pBloque.toFixed(1)}%`} />
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Disponible {pDispo.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"   />Engagé {pEngage.toFixed(0)}%</span>
        {pBloque > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" />Bloqué {pBloque.toFixed(0)}%</span>}
      </div>
    </div>
  );
}

// ── Barre de progression ──────────────────────────────────────────────────────

function ProgressBar({ value, max = 100, color = "bg-emerald-500" }: {
  value: number; max?: number; color?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Composant analyse ─────────────────────────────────────────────────────────

function AnalyseTab({ analyseData: a, loading, onRefresh }: {
  analyseData: AnalyseData | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const MOIS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" /> Calcul en cours…
      </div>
    );
  }
  if (!a) {
    return (
      <div className="flex flex-col items-center gap-3 h-48 justify-center text-slate-400">
        <p>Impossible de charger l&apos;analyse.</p>
        <button onClick={onRefresh} className="text-sm text-emerald-600 hover:underline">Réessayer</button>
      </div>
    );
  }

  const maxEvol = Math.max(...a.evolutionMensuelle.map((e) => e.montantGenere), 1);

  return (
    <div className="space-y-6">

      {/* En-tête durée */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Portefeuille actif depuis <span className="font-semibold text-slate-700">{a.dureeMois} mois</span>
          {a.dureeAns >= 1 && <> ({a.dureeAns.toFixed(1)} an{a.dureeAns >= 2 ? "s" : ""})</>}
        </p>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg">
          <RefreshCw className="w-3 h-3" /> Recalculer
        </button>
      </div>

      {/* ── Performance Financière ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-slate-800">Performance Financière</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Capital investi",   value: `${fmt(a.capitalInvesti)} F`,  color: "text-slate-900",   sub: "Base" },
            { label: "Capital récupéré",  value: `${fmt(a.capitalRecupere)} F`, color: "text-violet-700",  sub: "Recouvré" },
            { label: "Bénéfice brut",     value: `${fmt(a.beneficeBrut)} F`,    color: "text-amber-700",   sub: "Avant réserves" },
            { label: "Bénéfice net",      value: `${fmt(a.beneficeNet)} F`,     color: a.beneficeNet >= 0 ? "text-emerald-700" : "text-red-600", sub: "Après fonds sécurité" },
            { label: "Cash-flow net",     value: `${fmt(a.cashFlowNet)} F`,     color: a.cashFlowNet >= 0 ? "text-emerald-700" : "text-red-600", sub: `+${fmt(a.cashFlowEntrees)} / -${fmt(a.cashFlowSorties)}` },
          ].map((k) => (
            <div key={k.label} className="space-y-0.5">
              <p className="text-xs text-slate-400">{k.label}</p>
              <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-xs text-slate-300">{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-4">
          {[
            { label: "ROI total",           value: a.roi.toFixed(2),              suffix: "%", color: a.roi >= 0 ? "text-emerald-700" : "text-red-600", icon: <Percent className="w-3.5 h-3.5" />, sub: "Rendement sur capital investi" },
            { label: "Rendement mensuel",   value: a.rendementMensuel.toFixed(3), suffix: "%", color: "text-blue-700",  icon: <TrendingUp className="w-3.5 h-3.5" />, sub: "Moyen par mois" },
            { label: "Rendement annuel",    value: a.rendementAnnuel.toFixed(2),  suffix: "%", color: "text-indigo-700",icon: <TrendingUp className="w-3.5 h-3.5" />, sub: "Annualisé" },
            { label: "TRI simplifié (CAGR)",value: a.triSimplifiee.toFixed(2),    suffix: "%", color: "text-violet-700",icon: <Activity   className="w-3.5 h-3.5" />, sub: `Sur ${a.dureeAns.toFixed(1)} an(s)` },
          ].map((k) => (
            <div key={k.label} className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-slate-400">{k.icon}</span>
                <p className="text-xs text-slate-500">{k.label}</p>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${k.color}`}>
                {k.value}<span className="text-sm font-medium ml-0.5">{k.suffix}</span>
              </p>
              <p className="text-xs text-slate-300 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Performance Commerciale ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <Users className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-800">Performance Commerciale</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Clients financés",  value: a.nbClientsFinances, color: "text-slate-900",   icon: <Users      className="w-4 h-4 text-slate-400"   />, bg: "bg-slate-50"   },
            { label: "Nouveaux (30j)",    value: a.nouveauxClients,   color: "text-blue-700",    icon: <UserCheck  className="w-4 h-4 text-blue-400"   />, bg: "bg-blue-50"    },
            { label: "Clients actifs",    value: a.clientsActifs,     color: "text-emerald-700", icon: <UserCheck  className="w-4 h-4 text-emerald-400"/>, bg: "bg-emerald-50" },
            { label: "Clients inactifs",  value: a.clientsInactifs,   color: "text-amber-700",   icon: <UserMinus  className="w-4 h-4 text-amber-400"  />, bg: "bg-amber-50"   },
            { label: "Clients perdus",    value: a.clientsPerdus,     color: a.clientsPerdus > 0 ? "text-red-700" : "text-slate-500", icon: <UserX className="w-4 h-4 text-red-400" />, bg: a.clientsPerdus > 0 ? "bg-red-50" : "bg-slate-50" },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-xl p-4 flex flex-col gap-2`}>
              <div className="flex items-center gap-1.5">{k.icon}<p className="text-xs text-slate-500">{k.label}</p></div>
              <p className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
        {/* Jauge actifs/inactifs/perdus */}
        {(a.clientsActifs + a.clientsInactifs + a.clientsPerdus) > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs text-slate-400 mb-2">Répartition clients affectés</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              {a.clientsActifs > 0 && (
                <div className="bg-emerald-400 transition-all"
                  style={{ width: `${(a.clientsActifs / (a.clientsActifs + a.clientsInactifs + a.clientsPerdus)) * 100}%` }}
                  title={`Actifs ${a.clientsActifs}`} />
              )}
              {a.clientsInactifs > 0 && (
                <div className="bg-amber-300 transition-all"
                  style={{ width: `${(a.clientsInactifs / (a.clientsActifs + a.clientsInactifs + a.clientsPerdus)) * 100}%` }}
                  title={`Inactifs ${a.clientsInactifs}`} />
              )}
              {a.clientsPerdus > 0 && (
                <div className="bg-red-400 transition-all"
                  style={{ width: `${(a.clientsPerdus / (a.clientsActifs + a.clientsInactifs + a.clientsPerdus)) * 100}%` }}
                  title={`Perdus ${a.clientsPerdus}`} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Performance de Recouvrement ── */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
          <Target className="w-4 h-4 text-violet-600" />
          <h3 className="font-semibold text-slate-800">Performance de Recouvrement</h3>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-5">
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Montant attendu</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{fmt(a.montantAttendu)} F</p>
            <p className="text-xs text-slate-300">Total financements</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Montant recouvré</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums">{fmt(a.montantRecouvre)} F</p>
            <p className="text-xs text-slate-300">Remboursements reçus</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Écart</p>
            <p className={`text-lg font-bold tabular-nums ${a.ecart > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {fmt(a.ecart)} F
            </p>
            <p className="text-xs text-slate-300">Reste à recouvrer</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">Encours impayés</p>
            <p className={`text-lg font-bold tabular-nums ${a.encoursImpayes > 0 ? "text-red-600" : "text-slate-400"}`}>
              {fmt(a.encoursImpayes)} F
            </p>
            <p className="text-xs text-slate-300">En retard / Défaut</p>
          </div>
        </div>

        {/* Jauges taux */}
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Taux de recouvrement</span>
              <span className={`font-bold ${a.tauxRecouvrement >= 80 ? "text-emerald-700" : a.tauxRecouvrement >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {a.tauxRecouvrement.toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={a.tauxRecouvrement}
              max={100}
              color={a.tauxRecouvrement >= 80 ? "bg-emerald-500" : a.tauxRecouvrement >= 50 ? "bg-amber-400" : "bg-red-400"}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" /> Taux d&apos;impayés
              </span>
              <span className={`font-bold ${a.tauxImpayes === 0 ? "text-emerald-700" : a.tauxImpayes <= 10 ? "text-amber-600" : "text-red-600"}`}>
                {a.tauxImpayes.toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={a.tauxImpayes}
              max={100}
              color={a.tauxImpayes === 0 ? "bg-emerald-500" : a.tauxImpayes <= 10 ? "bg-amber-400" : "bg-red-500"}
            />
          </div>
        </div>
      </div>

      {/* ── Évolution mensuelle du rendement ── */}
      {a.evolutionMensuelle.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-slate-800">Évolution mensuelle des bénéfices</h3>
          </div>
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="pb-2 text-left font-medium">Période</th>
                  <th className="pb-2 text-right font-medium">Bénéfice généré</th>
                  <th className="pb-2 text-right font-medium">Distribué</th>
                  <th className="pb-2 text-right font-medium">Rendement mois</th>
                  <th className="pb-2 text-right font-medium w-32">Barre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {a.evolutionMensuelle.map((e) => (
                  <tr key={`${e.annee}-${e.mois}`} className="hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{MOIS_SHORT[(e.mois ?? 1) - 1]} {e.annee}</td>
                    <td className="py-2 text-right text-amber-600 font-semibold tabular-nums">{fmt(e.montantGenere)} F</td>
                    <td className="py-2 text-right text-emerald-600 tabular-nums">{fmt(e.montantDistribue)} F</td>
                    <td className="py-2 text-right font-bold text-indigo-600">{e.rendementMois.toFixed(3)}%</td>
                    <td className="py-2 pl-4">
                      <ProgressBar value={e.montantGenere} max={maxEvol} color="bg-amber-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortefeuilleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab]       = useState<"overview" | "clients" | "financements" | "mouvements" | "distributions" | "analyse">("overview");
  const [editing, setEditing] = useState(false);
  const [editNom, setEditNom] = useState("");

  const { data: pfRes, loading, refetch } = useApi<{ data: Portefeuille }>(`/api/admin/ria/portefeuilles/${id}`);
  const { data: analyseRes, loading: analyseLoading, refetch: refetchAnalyse } = useApi<{ data: AnalyseData }>(
    tab === "analyse" ? `/api/admin/ria/portefeuilles/${id}/analyse` : null
  );
  const { data: affRes, refetch: refetchAff } = useApi<{ data: Affectation[]; meta: { total: number } }>(
    `/api/admin/ria/affectations?portefeuilleId=${id}&limit=50`
  );

  const { mutate: patchPf, loading: saving } = useMutation<{ data: Portefeuille }, { nom?: string; actif?: boolean }>(
    `/api/admin/ria/portefeuilles/${id}`,
    "PATCH"
  );

  const pf = pfRes?.data;
  const affectations = useMemo(() => affRes?.data ?? [], [affRes]);

  // Donut slices depuis les affectations actives
  const donutSlices = useMemo(() => {
    const actifs = affectations.filter((a) => a.actif);
    const totalPct = actifs.reduce((s, a) => s + a.pourcentage, 0);
    const libre = Math.max(0, 100 - totalPct);
    const slices = actifs.map((a, i) => ({
      pct:   a.pourcentage,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      label: `${a.client.prenom} ${a.client.nom}`,
    }));
    if (libre > 0) slices.push({ pct: libre, color: "#e2e8f0", label: "Non alloué" });
    return slices;
  }, [affectations]);

  async function saveNom() {
    if (!pf) return;
    const res = await patchPf({ nom: editNom || null as unknown as string });
    if (res) { toast.success("Nom mis à jour"); setEditing(false); refetch(); }
    else toast.error("Erreur lors de la mise à jour");
  }

  async function toggleActif() {
    if (!pf) return;
    const res = await patchPf({ actif: !pf.actif });
    if (res) { toast.success(pf.actif ? "Portefeuille désactivé" : "Portefeuille activé"); refetch(); }
    else toast.error("Erreur");
  }

  if (loading && !pf) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
      </div>
    );
  }
  if (!pf) return <div className="p-8 text-red-600">Portefeuille introuvable.</div>;

  const inv = pf.profilRIA.gestionnaire.member;
  const investi    = toNum(pf.capitalInvesti);
  const disponible = toNum(pf.capitalDisponible);
  const engage     = toNum(pf.capitalEngage);
  const recouvre   = toNum(pf.capitalRecouvre);
  const bloque     = toNum(pf.capitalBloque);
  const bGeneres   = toNum(pf.beneficesGeneres);
  const bDistrib   = toNum(pf.beneficesDistribues);
  const bReinvesti = toNum(pf.beneficesReinvestis);
  const fondSec    = toNum(pf.fondSecurite);
  const rendement  = investi > 0 ? (bGeneres / investi) * 100 : 0;

  const TABS = [
    { id: "overview",      label: "Vue d'ensemble",  icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: "clients",       label: `Clients (${affectations.length})`, icon: <Users className="w-3.5 h-3.5" /> },
    { id: "financements",  label: `Financements (${pf.financements.length})`, icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "mouvements",    label: `Mouvements (${pf.mouvements.length})`,     icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { id: "distributions", label: `Distributions (${pf.distributions.length})`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "analyse",       label: "Analyse de portefeuille",                    icon: <PieChart className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl">

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard/admin/ria/portefeuilles"
            className="mt-1 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold text-slate-800">{pf.reference}</span>
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                    placeholder="Nom du portefeuille"
                    className="border border-slate-300 rounded-lg px-2 py-0.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    autoFocus
                  />
                  <button onClick={saveNom} disabled={saving}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setEditing(false)} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">{pf.nom ?? "Sans nom"}</span>
                  <button onClick={() => { setEditing(true); setEditNom(pf.nom ?? ""); }}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded">
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${pf.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {pf.actif ? "Actif" : "Inactif"}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Investisseur :{" "}
              <Link href={`/dashboard/admin/ria/investisseurs/${inv.id}`}
                className="text-emerald-600 hover:underline font-medium">
                {inv.prenom} {inv.nom}
              </Link>
              {pf.profilRIA.numero && <span className="ml-2 text-slate-400 font-mono text-xs">{pf.profilRIA.numero}</span>}
              <span className="ml-3 text-xs text-slate-400">Créé le {fmtDate(pf.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={toggleActif}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              pf.actif
                ? "border-red-200 text-red-600 hover:bg-red-50"
                : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            }`}>
            {pf.actif ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {pf.actif ? "Désactiver" : "Activer"}
          </button>
          <button onClick={() => { refetch(); refetchAff(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── Tab : Vue d'ensemble ─────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Capital investi",    value: investi,    color: "text-slate-900",   bg: "bg-slate-50" },
              { label: "Capital disponible", value: disponible, color: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Capital engagé",     value: engage,     color: "text-blue-700",    bg: "bg-blue-50" },
              { label: "Capital recouvré",   value: recouvre,   color: "text-violet-700",  bg: "bg-violet-50" },
            ].map((k) => (
              <div key={k.label} className={`${k.bg} rounded-2xl border border-slate-100 p-4`}>
                <p className="text-xs text-slate-400 font-medium">{k.label}</p>
                <p className={`text-lg font-bold mt-1 ${k.color} tabular-nums`}>{fmt(k.value)} <span className="text-xs font-normal text-slate-400">F</span></p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Bénéfices générés",     value: bGeneres,   color: "text-amber-700",   bg: "bg-amber-50" },
              { label: "Bénéfices distribués",  value: bDistrib,   color: "text-teal-700",    bg: "bg-teal-50" },
              { label: "Bénéfices réinvestis",  value: bReinvesti, color: "text-indigo-700",  bg: "bg-indigo-50" },
              { label: "Fonds de sécurité",     value: fondSec,    color: "text-slate-700",   bg: "bg-slate-50" },
            ].map((k) => (
              <div key={k.label} className={`${k.bg} rounded-2xl border border-slate-100 p-4`}>
                <p className="text-xs text-slate-400 font-medium">{k.label}</p>
                <p className={`text-lg font-bold mt-1 ${k.color} tabular-nums`}>{fmt(k.value)} <span className="text-xs font-normal text-slate-400">F</span></p>
              </div>
            ))}
          </div>

          {/* Répartition capital + rendement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Répartition du capital</p>
              <CapitalBar investi={investi} disponible={disponible} engage={engage} bloque={bloque} />
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                {[
                  ["Capital total",    `${fmt(investi)} F`,    "text-slate-700"],
                  ["Disponible",       `${fmt(disponible)} F`, "text-emerald-600"],
                  ["Engagé crédits",   `${fmt(engage)} F`,     "text-blue-600"],
                  ["Recouvré",         `${fmt(recouvre)} F`,   "text-violet-600"],
                  ["Bloqué",           `${fmt(bloque)} F`,     "text-red-500"],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between">
                    <span className="text-slate-400">{l}</span>
                    <span className={`font-medium tabular-nums ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Performance</p>
              <div className="space-y-3">
                {[
                  { label: "Rendement total",      pct: Math.min(rendement * 5, 100), val: `${rendement.toFixed(2)}%`, color: "bg-amber-400" },
                  { label: "Taux de recouvrement", pct: investi > 0 ? Math.min((recouvre / investi) * 100, 100) : 0,
                    val: `${investi > 0 ? ((recouvre / investi) * 100).toFixed(1) : 0}%`, color: "bg-emerald-400" },
                  { label: "Capital distribué",    pct: bGeneres > 0 ? Math.min((bDistrib / bGeneres) * 100, 100) : 0,
                    val: `${bGeneres > 0 ? ((bDistrib / bGeneres) * 100).toFixed(1) : 0}%`, color: "bg-blue-400" },
                ].map((r) => (
                  <div key={r.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{r.label}</span>
                      <span className="font-semibold text-slate-700">{r.val}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${r.color}`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Derniers dépôts / retraits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
                Derniers dépôts
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-50">
                  {pf.depots.length === 0 && <tr><td className="px-4 py-6 text-center text-slate-400">Aucun dépôt</td></tr>}
                  {pf.depots.slice(0, 5).map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-500">{d.reference}</td>
                      <td className="px-4 py-2 text-right font-semibold text-emerald-600 tabular-nums">{fmt(toNum(d.montant))} F</td>
                      <td className="px-4 py-2 text-center text-slate-400">{fmtDate(d.createdAt)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${d.statut === "VALIDE" ? "bg-emerald-100 text-emerald-700" : d.statut === "REJETE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {d.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
                Derniers retraits
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-50">
                  {pf.retraits.length === 0 && <tr><td className="px-4 py-6 text-center text-slate-400">Aucun retrait</td></tr>}
                  {pf.retraits.slice(0, 5).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-slate-500">{r.reference}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-500 tabular-nums">{fmt(toNum(r.montant))} F</td>
                      <td className="px-4 py-2 text-center text-slate-400">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${r.statut === "PAYE" ? "bg-emerald-100 text-emerald-700" : r.statut === "REJETE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {r.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab : Clients affectés ────────────────────────────────────────────── */}
      {tab === "clients" && (
        <div className="space-y-6">
          {/* Donut + légende */}
          {affectations.filter((a) => a.actif).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <p className="text-sm font-semibold text-slate-700 mb-4">Répartition des allocations</p>
              <div className="flex items-center gap-8 flex-wrap">
                <div className="flex-shrink-0">
                  <DonutChart slices={donutSlices} />
                </div>
                <div className="flex-1 min-w-48">
                  <div className="space-y-2">
                    {affectations.filter((a) => a.actif).map((a, i) => {
                      const color = SLICE_COLORS[i % SLICE_COLORS.length];
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-sm text-slate-700 truncate">{a.client.prenom} {a.client.nom}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-bold text-slate-800 tabular-nums">{a.pourcentage}%</span>
                            <span className="text-xs text-slate-400 tabular-nums">{fmt(toNum(a.montantAlloue))} F</span>
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const totalPct = affectations.filter((a) => a.actif).reduce((s, a) => s + a.pourcentage, 0);
                      const libre = 100 - totalPct;
                      if (libre <= 0) return null;
                      return (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-slate-200 flex-shrink-0" />
                            <span className="text-sm text-slate-400">Non alloué</span>
                          </div>
                          <span className="text-sm font-bold text-slate-400 tabular-nums">{libre.toFixed(0)}%</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tableau affectations */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">{affRes?.meta.total ?? 0} client(s) affecté(s)</p>
              <Link href="/dashboard/admin/ria/affectations"
                className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                Gérer les affectations <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  {["Client", "Allocation", "Montant alloué", "Risque", "Financements", "Statut", "Depuis"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {affectations.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Aucune affectation</td></tr>
                )}
                {affectations.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.client.prenom} {a.client.nom}</p>
                      {a.client.telephone && <p className="text-xs text-slate-400">{a.client.telephone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, a.pourcentage)}%` }} />
                        </div>
                        <span className="font-bold text-slate-800 tabular-nums">{a.pourcentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">{fmt(toNum(a.montantAlloue))} F</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full ${RISQUE_CLS[a.classeRisque] ?? "bg-slate-100 text-slate-600"}`}>
                        <Star className="w-2.5 h-2.5" />{a.classeRisque}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{a._count.financements}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`w-2 h-2 rounded-full inline-block ${a.actif ? "bg-emerald-400" : "bg-slate-300"}`} />
                      <span className="ml-1 text-xs text-slate-500">{a.actif ? "Actif" : "Inactif"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab : Financements ───────────────────────────────────────────────── */}
      {tab === "financements" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                {["Référence", "Client", "Montant financé", "Encours", "Statut", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pf.financements.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucun financement</td></tr>
              )}
              {pf.financements.map((f) => {
                const taux = toNum(f.montantFinance) > 0
                  ? ((toNum(f.montantFinance) - toNum(f.encours)) / toNum(f.montantFinance)) * 100 : 0;
                return (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{f.reference}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{f.client.prenom} {f.client.nom}</p>
                      {f.client.telephone && <p className="text-xs text-slate-400">{f.client.telephone}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">{fmt(toNum(f.montantFinance))} F</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${taux >= 80 ? "bg-emerald-400" : taux >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${taux}%` }} />
                        </div>
                        <span className="text-xs text-slate-600 tabular-nums">{fmt(toNum(f.encours))} F</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        f.statut === "ACTIF"       ? "bg-blue-100 text-blue-700"
                        : f.statut === "REMBOURSE" ? "bg-emerald-100 text-emerald-700"
                        : f.statut === "EN_RETARD" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                      }`}>{f.statut}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(f.dateFinancement)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab : Mouvements ─────────────────────────────────────────────────── */}
      {tab === "mouvements" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                {["Date", "Type", "Sens", "Montant", "Libellé"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pf.mouvements.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Aucun mouvement</td></tr>
              )}
              {pf.mouvements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    <Clock className="w-3 h-3 inline mr-1" />{fmtDate(m.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-medium text-slate-600">{m.type.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-1.5 py-0.5 text-xs rounded font-semibold ${m.sens === "CREDIT" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                      {m.sens === "CREDIT" ? "+" : "−"}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${MOV_COLORS[m.type] ?? "text-slate-700"}`}>
                    {m.sens === "CREDIT" ? "+" : "−"}{fmt(toNum(m.montant))} F
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{m.libelle ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab : Analyse de portefeuille ────────────────────────────────────── */}
      {tab === "analyse" && (
        <AnalyseTab
          analyseData={analyseRes?.data ?? null}
          loading={analyseLoading}
          onRefresh={refetchAnalyse}
        />
      )}

      {/* ── Tab : Distributions ──────────────────────────────────────────────── */}
      {tab === "distributions" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
              <tr>
                {["Période", "Bénéfice généré", "Distribué (4%)", "Réinvesti (4%)", "Fonds sécurité (2%)", "Statut"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pf.distributions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Aucune distribution</td></tr>
              )}
              {pf.distributions.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {MOIS[(d.mois ?? 1) - 1]} {d.annee}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-600 tabular-nums">{fmt(toNum(d.montantGenere))} F</td>
                  <td className="px-4 py-3 text-right text-emerald-600 tabular-nums">{fmt(toNum(d.montantDistribue))} F</td>
                  <td className="px-4 py-3 text-right text-indigo-600 tabular-nums">{fmt(toNum(d.montantReinvesti))} F</td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{fmt(toNum(d.fondSecurite))} F</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      d.statut === "DISTRIBUE"   ? "bg-emerald-100 text-emerald-700"
                      : d.statut === "REINVESTI" ? "bg-indigo-100 text-indigo-700"
                      : d.statut === "PLANIFIE"  ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                    }`}>{d.statut}</span>
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
