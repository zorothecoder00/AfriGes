"use client";

import { useState, useEffect } from "react";
import {
  Award, RefreshCw, Calculator, CheckCircle, Wallet, XCircle,
  Settings, ChevronDown, ChevronUp, Users, UserCheck, TrendingUp,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserInfo { id: number; nom: string; prenom: string; avatar?: string | null }

interface CommissionDB {
  id: number;
  userId: number;
  mois: number;
  annee: number;
  roleType: "AGENT_TERRAIN" | "CHEF_AGENCE" | "RPV_REGIONAL";
  montantRecouvre: number;
  nbDossiers: number;
  nbDossiersRembourses: number;
  tauxSucces: number;
  taux: number;
  montant: number;
  statut: "CALCULE" | "APPROUVE" | "PAYE" | "ANNULE";
  notes?: string | null;
  dateApprobation?: string | null;
  datePaiement?: string | null;
  user: UserInfo;
  approuvePar?: UserInfo | null;
}

interface ConfigItem {
  id: number | null;
  roleType: string;
  tauxBase: number;
  description?: string | null;
  actif: boolean;
}

interface CommissionsResp {
  commissions: CommissionDB[];
  totaux: { totalMontant: number; totalRecouvre: number; nbApprouves: number; nbPayes: number; nbBeneficiaires: number };
  config: ConfigItem[];
  mois: number;
  annee: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";

const STATUT_COLORS: Record<string, string> = {
  CALCULE:  "bg-blue-100 text-blue-700",
  APPROUVE: "bg-amber-100 text-amber-700",
  PAYE:     "bg-emerald-100 text-emerald-700",
  ANNULE:   "bg-red-100 text-red-700",
};
const STATUT_LABELS: Record<string, string> = {
  CALCULE: "Calculé", APPROUVE: "Approuvé", PAYE: "Payé", ANNULE: "Annulé",
};

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const ROLE_LABELS: Record<string, string> = {
  AGENT_TERRAIN: "Agent terrain",
  CHEF_AGENCE:   "Chef agence (RPV)",
  RPV_REGIONAL:  "Responsable régional (RPV)",
};

type TabType = "AGENT_TERRAIN" | "CHEF_AGENCE" | "RPV_REGIONAL" | "config";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommissionsPage() {
  const now   = new Date();
  const [mois,   setMois]  = useState(now.getMonth() + 1);
  const [annee,  setAnnee] = useState(now.getFullYear());
  const [tab,    setTab]   = useState<TabType>("AGENT_TERRAIN");
  const [expand, setExpand] = useState<number | null>(null);

  // Config locale (éditable)
  const [configEdit, setConfigEdit] = useState<Record<string, { taux: number; description: string }>>({
    AGENT_TERRAIN: { taux: 1.0, description: "" },
    CHEF_AGENCE:   { taux: 0.5, description: "" },
    RPV_REGIONAL:  { taux: 0.3, description: "" },
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const { data, loading, refetch } = useApi<CommissionsResp>(
    `/api/admin/ria/commissions?mois=${mois}&annee=${annee}`
  );

  // Charger la config dans l'état local dès qu'elle arrive
  useEffect(() => {
    if (data?.config && !configLoaded) {
      const next = { ...configEdit };
      for (const c of data.config) {
        if (next[c.roleType] !== undefined) {
          next[c.roleType] = { taux: Number(c.tauxBase), description: c.description ?? "" };
        }
      }
      setConfigEdit(next);
      setConfigLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.config]);

  const [actionLoading, setActionLoading] = useState(false);

  const { mutate: calculer, loading: calcLoading } = useMutation<CommissionsResp, { mois: number; annee: number }>(
    "/api/admin/ria/commissions", "POST"
  );
  const { mutate: saveConfig } = useMutation<ConfigItem, { roleType: string; tauxBase: number; description: string }>(
    "/api/admin/ria/commissions/config", "POST"
  );

  async function handleCalculer() {
    const res = await calculer({ mois, annee });
    if (res?.commissions) {
      toast.success(`${res.commissions.length} commission(s) calculée(s)`);
      refetch();
    }
  }

  async function handleAction(commission: CommissionDB, action: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/ria/commissions/${commission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Erreur");
        return;
      }
      toast.success(action === "APPROUVER" ? "Commission approuvée" : action === "MARQUER_PAYE" ? "Commission marquée payée" : "Commission annulée");
      refetch();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveConfig(roleType: string) {
    const cfg = configEdit[roleType];
    const res = await saveConfig({ roleType, tauxBase: cfg.taux, description: cfg.description });
    if (res?.roleType) {
      toast.success("Configuration sauvegardée");
      setConfigLoaded(false);
      refetch();
    }
  }

  const commissions = data?.commissions ?? [];
  const byRole = (role: string) => commissions.filter((c) => c.roleType === role);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "AGENT_TERRAIN", label: "Agents terrain",      icon: <Users size={15} />,     count: byRole("AGENT_TERRAIN").length },
    { key: "CHEF_AGENCE",   label: "RPV Chef agence",     icon: <UserCheck size={15} />, count: byRole("CHEF_AGENCE").length },
    { key: "RPV_REGIONAL",  label: "RPV Régional",        icon: <TrendingUp size={15} />,count: byRole("RPV_REGIONAL").length },
    { key: "config",        label: "Configuration taux",  icon: <Settings size={15} /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Commissions RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion des commissions sur recouvrements — agents et RPV</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setConfigLoaded(false); refetch(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        </div>
      </div>

      {/* Sélecteur période + Calculer */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Mois</label>
          <select value={mois} onChange={(e) => setMois(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {MOIS_LABELS.map((label, i) => (
              <option key={i + 1} value={i + 1}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Année</label>
          <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300">
            {[2024, 2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-slate-400 italic">Le calcul écrase les commissions CALCULÉES existantes</p>
          <button onClick={handleCalculer} disabled={calcLoading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
            <Calculator className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
            Calculer {MOIS_LABELS[mois - 1]} {annee}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total commissions", value: fmt(data.totaux.totalMontant), color: "text-emerald-600" },
            { label: "Total recouvré",    value: fmt(data.totaux.totalRecouvre), color: "text-slate-800" },
            { label: "Bénéficiaires",     value: String(data.totaux.nbBeneficiaires), color: "text-slate-800" },
            { label: "Approuvés / Payés", value: `${data.totaux.nbApprouves} / ${data.totaux.nbPayes}`, color: "text-amber-600" },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {t.icon} {t.label}
              {t.count !== undefined && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${tab === t.key ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content — Rôles */}
      {(tab === "AGENT_TERRAIN" || tab === "CHEF_AGENCE" || tab === "RPV_REGIONAL") && (
        <CommissionTable
          commissions={byRole(tab)}
          loading={loading}
          roleType={tab}
          expand={expand}
          setExpand={setExpand}
          actionLoading={actionLoading}
          onAction={(c, action) => handleAction(c, action)}
        />
      )}

      {/* Tab content — Config */}
      {tab === "config" && (
        <div className="grid md:grid-cols-3 gap-6">
          {(["AGENT_TERRAIN", "CHEF_AGENCE", "RPV_REGIONAL"] as const).map((roleType) => {
            const cfg = configEdit[roleType];
            return (
              <div key={roleType} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-800">{ROLE_LABELS[roleType]}</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Taux de commission (%)</label>
                    <input
                      type="number" step="0.1" min="0" max="100"
                      value={cfg.taux}
                      onChange={(e) => setConfigEdit((prev) => ({
                        ...prev,
                        [roleType]: { ...prev[roleType], taux: parseFloat(e.target.value) || 0 },
                      }))}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                    <p className="text-xs text-slate-400 mt-1">Appliqué sur le montant total recouvré</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Description (optionnel)</label>
                    <input
                      type="text"
                      value={cfg.description}
                      onChange={(e) => setConfigEdit((prev) => ({
                        ...prev,
                        [roleType]: { ...prev[roleType], description: e.target.value },
                      }))}
                      placeholder="Ex: Commission standard agent terrain"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600">
                  Simulation : 100 000 FCFA recouvré = <strong>{(100000 * cfg.taux / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} FCFA</strong>
                </div>
                <button
                  onClick={() => handleSaveConfig(roleType)}
                  className="w-full py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium">
                  Enregistrer
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sous-composant tableau ─────────────────────────────────────────────────────

interface CommissionTableProps {
  commissions: CommissionDB[];
  loading: boolean;
  actionLoading: boolean;
  roleType: "AGENT_TERRAIN" | "CHEF_AGENCE" | "RPV_REGIONAL";
  expand: number | null;
  setExpand: (id: number | null) => void;
  onAction: (c: CommissionDB, action: string) => void;
}

function CommissionTable({ commissions, loading, actionLoading, roleType, expand, setExpand, onAction }: CommissionTableProps) {
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
  const pct = (n: number) => n.toFixed(1) + "%";

  const isAgent = roleType === "AGENT_TERRAIN";

  if (loading || actionLoading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin inline mr-2" />Chargement…
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Award className="w-4 h-4 text-emerald-600" />
        <span className="font-medium text-slate-700 text-sm">
          {commissions.length} bénéficiaire{commissions.length !== 1 ? "s" : ""}
        </span>
      </div>
      {commissions.length === 0 ? (
        <div className="px-4 py-12 text-center text-slate-400 text-sm">
          Aucune commission pour cette période et ce rôle.<br />
          <span className="text-xs">Cliquez sur &quot;Calculer&quot; pour générer les commissions.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Agent</th>
                {isAgent && (
                  <>
                    <th className="px-4 py-3 text-center">Dossiers</th>
                    <th className="px-4 py-3 text-center">Taux succès</th>
                  </>
                )}
                {!isAgent && <th className="px-4 py-3 text-center">PDVs supervisés</th>}
                <th className="px-4 py-3 text-right">Montant recouvré</th>
                <th className="px-4 py-3 text-center">Taux</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Actions</th>
                <th className="px-4 py-3 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((c) => (
                <>
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{c.user.prenom} {c.user.nom}</div>
                    </td>
                    {isAgent && (
                      <>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {c.nbDossiersRembourses}/{c.nbDossiers}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <SuccessRate rate={Number(c.tauxSucces)} />
                        </td>
                      </>
                    )}
                    {!isAgent && (
                      <td className="px-4 py-3 text-center text-slate-600">{c.nbDossiers}</td>
                    )}
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(Number(c.montantRecouvre))}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{pct(Number(c.taux))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(Number(c.montant))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUT_COLORS[c.statut] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUT_LABELS[c.statut] ?? c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionButtons commission={c} onAction={onAction} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setExpand(expand === c.id ? null : c.id)} className="text-slate-400 hover:text-slate-600">
                        {expand === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expand === c.id && (
                    <tr key={`${c.id}-detail`} className="bg-slate-50">
                      <td colSpan={isAgent ? 9 : 8} className="px-4 py-3">
                        <div className="text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div><span className="text-slate-400">Période :</span> {MOIS_LABELS_FULL[c.mois - 1]} {c.annee}</div>
                          {c.dateApprobation && <div><span className="text-slate-400">Approuvé le :</span> {new Date(c.dateApprobation).toLocaleDateString("fr-FR")}</div>}
                          {c.approuvePar && <div><span className="text-slate-400">Approuvé par :</span> {c.approuvePar.prenom} {c.approuvePar.nom}</div>}
                          {c.datePaiement && <div><span className="text-slate-400">Payé le :</span> {new Date(c.datePaiement).toLocaleDateString("fr-FR")}</div>}
                          {c.notes && <div className="col-span-2"><span className="text-slate-400">Notes :</span> {c.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const MOIS_LABELS_FULL = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function SuccessRate({ rate }: { rate: number }) {
  const color = rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-semibold ${color}`}>{rate.toFixed(1)}%</span>
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${Math.min(rate, 100)}%` }} />
      </div>
    </div>
  );
}

function ActionButtons({ commission, onAction }: { commission: CommissionDB; onAction: (c: CommissionDB, action: string) => void }) {
  const { statut } = commission;
  if (statut === "PAYE" || statut === "ANNULE") {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="flex items-center gap-1 justify-center">
      {statut === "CALCULE" && (
        <button onClick={() => onAction(commission, "APPROUVER")}
          title="Approuver"
          className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors">
          <CheckCircle size={14} />
        </button>
      )}
      {statut === "APPROUVE" && (
        <button onClick={() => onAction(commission, "MARQUER_PAYE")}
          title="Marquer payé"
          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors">
          <Wallet size={14} />
        </button>
      )}
      {(statut === "CALCULE" || statut === "APPROUVE") && (
        <button onClick={() => onAction(commission, "ANNULER")}
          title="Annuler"
          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors">
          <XCircle size={14} />
        </button>
      )}
    </div>
  );
}
