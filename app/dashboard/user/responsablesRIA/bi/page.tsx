"use client";

import { useState } from "react";
import { RefreshCw, TrendingUp, Wallet, Users, AlertTriangle, Trophy, MapPin, UserCheck } from "lucide-react";
import { useApi } from "@/hooks/useApi";

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPIs {
  capitalTotal: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; beneficesGeneres: number; beneficesDistribues: number;
  fondSecurite: number; nbPortefeuilles: number; nbInvestisseurs: number;
  nbFinancementsActifs: number; nbFinancementsEnRetard: number;
  totalEncours: number; tauxRecouvrement: number;
}
interface PfCapital {
  id: number; reference: string; nom: string | null; investisseur: string;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number;
  capitalRecouvre: number; beneficesGeneres: number;
}
interface PfRentabilite {
  id: number; reference: string; nom: string | null; investisseur: string;
  capitalInvesti: number; beneficesGeneres: number; roi: number;
}
interface ClientVolume {
  clientId: number; nom: string; telephone: string | null; ville: string | null;
  totalFinance: number; nbFinancements: number;
}
interface ClientSolvabilite {
  id: number; nom: string; telephone: string | null; ville: string | null;
  score: number; niveau: string | null;
}
interface Agent       { id: number; nom: string; prenom: string; totalRecouvre: number; nbRemboursements: number }
interface Region      { ville: string; nbFinancements: number; totalFinance: number; totalRecouvre: number; rendement: number }
interface Prevision   { jours: number; montantAttendu: number }
interface RisqueItem  { classe: string; count: number }
interface EvolutionItem { mois: number; annee: number; distribue: number; genere: number }

interface BIData {
  kpis: KPIs;
  top10Capital: PfCapital[];
  top10Rentabilite: PfRentabilite[];
  top10ClientsVolume: ClientVolume[];
  top10ClientsSolvabilite: ClientSolvabilite[];
  topAgents: Agent[];
  topRegions: Region[];
  previsionsTresorerie: Prevision[];
  encoursEchus: number;
  repartitionRisque: RisqueItem[];
  evolutionMensuelle: EvolutionItem[];
  top10Portefeuilles: PfCapital[]; // backward compat
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt  = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

const MOIS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const CLASSE_COLORS: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-green-400", C: "bg-yellow-400", D: "bg-orange-400", E: "bg-red-500",
};
const CLASSE_TEXT: Record<string, string> = {
  A: "text-emerald-700 bg-emerald-50", B: "text-green-700 bg-green-50",
  C: "text-yellow-700 bg-yellow-50",   D: "text-orange-700 bg-orange-50",
  E: "text-red-700 bg-red-50",
};
const NIVEAU_BADGE: Record<string, string> = {
  FAIBLE:   "bg-emerald-50 text-emerald-700",
  MOYEN:    "bg-amber-50 text-amber-700",
  ELEVE:    "bg-orange-50 text-orange-700",
  CRITIQUE: "bg-red-50 text-red-700",
};

// ── Composants ────────────────────────────────────────────────────────────────

function KCard({ label, value, sub, accent = false, danger = false }: {
  label: string; value: string; sub?: string; accent?: boolean; danger?: boolean;
}) {
  const bg  = danger ? "border-red-200 bg-red-50" : accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white";
  const txt = danger ? "text-red-700" : accent ? "text-emerald-700" : "text-slate-800";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${txt}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ items, max, color = "#10b981" }: {
  items: { label: string; value: number }[];
  max: number; color?: string;
}) {
  const W = 480; const H = 160; const PAD = 40; const BAR_W = 28;
  const innerW = W - PAD * 2;
  const step   = items.length > 0 ? innerW / items.length : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {items.map((item, i) => {
        const barH = max > 0 ? (item.value / max) * (H - PAD - 20) : 0;
        const x    = PAD + i * step + (step - BAR_W) / 2;
        const y    = H - PAD - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={3} fill={color} opacity={0.85} />
            <text x={x + BAR_W / 2} y={H - PAD + 14} textAnchor="middle" fontSize={9} fill="#64748b">{item.label}</text>
          </g>
        );
      })}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  );
}

function Rank({ n }: { n: number }) {
  const colors = ["text-yellow-500", "text-slate-400", "text-amber-600"];
  return <span className={`font-bold ${colors[n - 1] ?? "text-slate-400"}`}>{n}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

type AdvTab   = "investisseurs" | "clients" | "agents" | "regions";
type InvTab   = "capital" | "rentabilite";
type ClientTab = "volume" | "solvabilite";

export default function BIPage() {
  const { data, loading, refetch } = useApi<BIData>("/api/admin/ria/bi");
  const [advTab,    setAdvTab]    = useState<AdvTab>("investisseurs");
  const [invTab,    setInvTab]    = useState<InvTab>("capital");
  const [clientTab, setClientTab] = useState<ClientTab>("volume");

  if (loading) return (
    <div className="p-8 flex items-center justify-center text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
    </div>
  );
  if (!data) return <div className="p-8 text-slate-500">Aucune donnée disponible.</div>;

  const {
    kpis,
    top10Capital: raw10Capital,
    top10Rentabilite, top10ClientsVolume, top10ClientsSolvabilite,
    topAgents, topRegions,
    previsionsTresorerie, encoursEchus, repartitionRisque, evolutionMensuelle,
    top10Portefeuilles,
  } = data;

  const top10Capital  = raw10Capital?.length ? raw10Capital : (top10Portefeuilles ?? []);
  const maxCapital    = Math.max(...top10Capital.map((p) => p.capitalInvesti), 1);
  const maxRoi        = Math.max(...(top10Rentabilite ?? []).map((p) => p.roi), 1);
  const maxEvolution  = Math.max(...evolutionMensuelle.map((e) => e.genere), 1);
  const totalRisque   = repartitionRisque.reduce((s, r) => s + r.count, 0);
  const maxPrevision  = Math.max(...previsionsTresorerie.map((p) => p.montantAttendu), 1);
  const maxVolume     = Math.max(...(top10ClientsVolume ?? []).map((c) => c.totalFinance), 1);
  const maxRecouvre   = Math.max(...(topAgents ?? []).map((a) => a.totalRecouvre), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Business Intelligence — RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Analyse avancée · Tops · Prévisions</p>
        </div>
        <button onClick={refetch}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KCard accent  label="Capital total investi"   value={fmt(kpis.capitalTotal)}      sub={`${kpis.nbInvestisseurs} investisseurs · ${kpis.nbPortefeuilles} portefeuilles`} />
        <KCard         label="Capital disponible"      value={fmt(kpis.capitalDisponible)}  sub="Fonds non engagés" />
        <KCard         label="Capital engagé"          value={fmt(kpis.capitalEngage)}      sub={`${kpis.nbFinancementsActifs} financements actifs`} />
        <KCard         label="Bénéfices générés"       value={fmt(kpis.beneficesGeneres)}   sub={`Distribués : ${fmt(kpis.beneficesDistribues)}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KCard label="Capital recouvré"    value={fmt(kpis.capitalRecouvre)}   sub={`Taux : ${kpis.tauxRecouvrement}%`} />
        <KCard label="Fonds de sécurité"   value={fmt(kpis.fondSecurite)} />
        <KCard label="Encours total"       value={fmt(kpis.totalEncours)}      sub={`${kpis.nbFinancementsActifs} actifs`} />
        <KCard danger={kpis.nbFinancementsEnRetard > 0}
          label="Financements en retard"
          value={String(kpis.nbFinancementsEnRetard)}
          sub={encoursEchus > 0 ? `${fmt(encoursEchus)} échus` : undefined}
        />
      </div>

      {encoursEchus > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span><strong>{fmt(encoursEchus)}</strong> d&apos;encours sont en retard. Consultez la page Recouvrement.</span>
        </div>
      )}

      {/* ── Tableaux de bord avancés ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Tableaux de bord avancés</h2>
          </div>
          <div className="flex gap-1 flex-wrap">
            {([
              ["investisseurs", "Top Investisseurs", <Users key="u" size={13} />],
              ["clients",       "Top Clients",       <UserCheck key="uc" size={13} />],
              ["agents",        "Top Agents",        <TrendingUp key="t" size={13} />],
              ["regions",       "Top Régions",       <MapPin key="m" size={13} />],
            ] as [AdvTab, string, React.ReactNode][]).map(([key, label, icon]) => (
              <button key={key} onClick={() => setAdvTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  advTab === key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">

          {/* ── Top Investisseurs ── */}
          {advTab === "investisseurs" && (
            <div>
              <div className="flex gap-2 mb-4">
                {(["capital", "rentabilite"] as InvTab[]).map((t) => (
                  <button key={t} onClick={() => setInvTab(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      invTab === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}>
                    {t === "capital" ? "Par capital investi" : "Par rentabilité (ROI)"}
                  </button>
                ))}
              </div>

              {invTab === "capital" && (
                <>
                  <BarChart
                    items={top10Capital.map((p, i) => ({ label: `#${i + 1}`, value: p.capitalInvesti }))}
                    max={maxCapital}
                  />
                  <table className="w-full text-xs mt-3">
                    <thead className="bg-slate-50 text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Investisseur</th>
                        <th className="px-3 py-2 text-left">Portefeuille</th>
                        <th className="px-3 py-2 text-right">Capital investi</th>
                        <th className="px-3 py-2 text-right">Engagé</th>
                        <th className="px-3 py-2 text-right">Recouvré</th>
                        <th className="px-3 py-2 text-right">Bénéfices</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {top10Capital.map((pf, i) => (
                        <tr key={pf.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{pf.investisseur}</td>
                          <td className="px-3 py-2.5 text-slate-500">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-medium text-slate-800">{fmt(pf.capitalInvesti)}</span>
                            <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${(pf.capitalInvesti / maxCapital) * 100}%` }} />
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmt(pf.capitalEngage)}</td>
                          <td className="px-3 py-2.5 text-right text-blue-600">{fmt(pf.capitalRecouvre)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600">{fmt(pf.beneficesGeneres)}</td>
                        </tr>
                      ))}
                      {top10Capital.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Aucun portefeuille</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}

              {invTab === "rentabilite" && (
                <>
                  <BarChart
                    items={(top10Rentabilite ?? []).map((p, i) => ({ label: `#${i + 1}`, value: p.roi }))}
                    max={maxRoi}
                    color="#6366f1"
                  />
                  <table className="w-full text-xs mt-3">
                    <thead className="bg-slate-50 text-slate-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Investisseur</th>
                        <th className="px-3 py-2 text-left">Portefeuille</th>
                        <th className="px-3 py-2 text-right">Capital investi</th>
                        <th className="px-3 py-2 text-right">Bénéfices</th>
                        <th className="px-3 py-2 text-right">ROI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(top10Rentabilite ?? []).map((pf, i) => (
                        <tr key={pf.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                          <td className="px-3 py-2.5 font-medium text-slate-800">{pf.investisseur}</td>
                          <td className="px-3 py-2.5 text-slate-500">{pf.reference}{pf.nom ? ` — ${pf.nom}` : ""}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600">{fmt(pf.capitalInvesti)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-600">{fmt(pf.beneficesGeneres)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold text-sm ${pf.roi >= 10 ? "text-emerald-600" : pf.roi >= 5 ? "text-amber-600" : "text-slate-500"}`}>
                              {pf.roi.toFixed(2)}%
                            </span>
                            <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${(pf.roi / maxRoi) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(top10Rentabilite ?? []).length === 0 && (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucun portefeuille avec bénéfices</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {/* ── Top Clients ── */}
          {advTab === "clients" && (
            <div>
              <div className="flex gap-2 mb-4">
                {(["volume", "solvabilite"] as ClientTab[]).map((t) => (
                  <button key={t} onClick={() => setClientTab(t)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      clientTab === t ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}>
                    {t === "volume" ? "Par volume (total financé)" : "Par solvabilité (score)"}
                  </button>
                ))}
              </div>

              {clientTab === "volume" && (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Ville</th>
                      <th className="px-3 py-2 text-center">Nb financements</th>
                      <th className="px-3 py-2 text-right">Total financé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(top10ClientsVolume ?? []).map((c, i) => (
                      <tr key={c.clientId} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{c.nom}</div>
                          {c.telephone && <div className="text-slate-400">{c.telephone}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{c.ville ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{c.nbFinancements}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="font-semibold text-emerald-700">{fmt(c.totalFinance)}</span>
                          <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(c.totalFinance / maxVolume) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(top10ClientsVolume ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Aucun client financé</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {clientTab === "solvabilite" && (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Client</th>
                      <th className="px-3 py-2 text-left">Ville</th>
                      <th className="px-3 py-2 text-center">Niveau</th>
                      <th className="px-3 py-2 text-right">Score solvabilité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(top10ClientsSolvabilite ?? []).map((c, i) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800">{c.nom}</div>
                          {c.telephone && <div className="text-slate-400">{c.telephone}</div>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{c.ville ?? "—"}</td>
                        <td className="px-3 py-2.5 text-center">
                          {c.niveau ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${NIVEAU_BADGE[c.niveau] ?? "bg-slate-100 text-slate-600"}`}>
                              {c.niveau}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.score >= 70 ? "bg-emerald-500" : c.score >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${c.score}%` }} />
                            </div>
                            <span className={`font-bold text-sm ${c.score >= 70 ? "text-emerald-600" : c.score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                              {c.score.toFixed(0)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(top10ClientsSolvabilite ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Aucun score disponible</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Top Agents ── */}
          {advTab === "agents" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">Classement des agents terrain par total remboursé sur leurs clients</p>
              <BarChart
                items={(topAgents ?? []).map((a, i) => ({ label: `#${i + 1}`, value: a.totalRecouvre }))}
                max={maxRecouvre}
                color="#f59e0b"
              />
              <table className="w-full text-xs mt-3">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Agent</th>
                    <th className="px-3 py-2 text-center">Nb remboursements</th>
                    <th className="px-3 py-2 text-right">Total recouvré</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(topAgents ?? []).map((a, i) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{a.nom}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{fmtN(a.nbRemboursements)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-semibold text-amber-700">{fmt(a.totalRecouvre)}</span>
                        <div className="mt-0.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${(a.totalRecouvre / maxRecouvre) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(topAgents ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Aucun agent avec des remboursements</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Top Régions ── */}
          {advTab === "regions" && (
            <div>
              <p className="text-xs text-slate-400 mb-3">Rendement = total recouvré / total financé par ville — top 10 par volume recouvré</p>
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Région / Ville</th>
                    <th className="px-3 py-2 text-center">Financements</th>
                    <th className="px-3 py-2 text-right">Total financé</th>
                    <th className="px-3 py-2 text-right">Total recouvré</th>
                    <th className="px-3 py-2 text-center">Rendement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(topRegions ?? []).map((r, i) => (
                    <tr key={r.ville} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5"><Rank n={i + 1} /></td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{r.ville}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{fmtN(r.nbFinancements)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600">{fmt(r.totalFinance)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-600">{fmt(r.totalRecouvre)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`font-bold text-sm ${r.rendement >= 80 ? "text-emerald-600" : r.rendement >= 50 ? "text-amber-600" : "text-red-500"}`}>
                          {r.rendement.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(topRegions ?? []).length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Aucune donnée géographique</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Prévisions trésorerie + Scoring risque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-slate-800">Prévisions trésorerie</h2>
              <span className="ml-auto text-xs text-slate-400">Encours attendus par horizon</span>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-5 gap-4">
                {previsionsTresorerie.map(({ jours, montantAttendu }) => {
                  const pct = maxPrevision > 0 ? (montantAttendu / maxPrevision) * 100 : 0;
                  return (
                    <div key={jours} className="text-center">
                      <div className="relative mx-auto w-12 mb-2" style={{ height: 72 }}>
                        <div className="absolute bottom-0 w-full bg-slate-100 rounded-t-md overflow-hidden" style={{ height: 72 }}>
                          <div className="absolute bottom-0 w-full bg-blue-500 rounded-t-md" style={{ height: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-700">J+{jours}</div>
                      <div className="text-xs text-blue-600 font-medium mt-0.5">
                        {montantAttendu > 0 ? fmt(montantAttendu) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="font-semibold text-slate-800">Scoring de risque</h2>
          </div>
          <div className="p-5 space-y-3">
            {["A", "B", "C", "D", "E"].map((c) => {
              const item  = repartitionRisque.find((r) => r.classe === c);
              const count = item?.count ?? 0;
              const pct   = totalRisque > 0 ? Math.round((count / totalRisque) * 100) : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${CLASSE_TEXT[c]}`}>Classe {c}</span>
                    <span className="text-slate-500">{count} · {pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${CLASSE_COLORS[c]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {totalRisque === 0 && <p className="text-sm text-slate-400 text-center py-4">Aucune affectation active</p>}
          </div>
        </div>
      </div>

      {/* Évolution mensuelle */}
      {evolutionMensuelle.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h2 className="font-semibold text-slate-800">Évolution des bénéfices — 12 mois</h2>
          </div>
          <div className="p-5">
            <BarChart
              items={evolutionMensuelle.map((e) => ({ label: `${MOIS[e.mois]} ${String(e.annee).slice(2)}`, value: e.genere }))}
              max={maxEvolution} color="#10b981"
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500 uppercase">
                  <tr>
                    <th className="text-left py-1.5">Période</th>
                    <th className="text-right py-1.5">Générés</th>
                    <th className="text-right py-1.5">Distribués</th>
                    <th className="text-right py-1.5">Taux distrib.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {evolutionMensuelle.map((e) => (
                    <tr key={`${e.annee}-${e.mois}`} className="hover:bg-slate-50">
                      <td className="py-1.5 text-slate-700">{MOIS[e.mois]} {e.annee}</td>
                      <td className="py-1.5 text-right text-emerald-600">{fmt(e.genere)}</td>
                      <td className="py-1.5 text-right text-slate-600">{fmt(e.distribue)}</td>
                      <td className="py-1.5 text-right text-slate-400">
                        {e.genere > 0 ? `${Math.round((e.distribue / e.genere) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
