"use client";

import { useState } from "react";
import {
  Award, RefreshCw, Calculator, ChevronDown, ChevronUp,
  Users, UserCheck, TrendingUp,
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

type TabType = "AGENT_TERRAIN" | "CHEF_AGENCE" | "RPV_REGIONAL";

// ── Component ─────────────────────────────────────────────────────────────────

export default function CommissionsRIAPage() {
  const now  = new Date();
  const [mois,   setMois]  = useState(now.getMonth() + 1);
  const [annee,  setAnnee] = useState(now.getFullYear());
  const [tab,    setTab]   = useState<TabType>("AGENT_TERRAIN");
  const [expand, setExpand] = useState<number | null>(null);

  const { data, loading, refetch } = useApi<CommissionsResp>(
    `/api/admin/ria/commissions?mois=${mois}&annee=${annee}`
  );

  const { mutate: calculer, loading: calcLoading } = useMutation<CommissionsResp, { mois: number; annee: number }>(
    "/api/admin/ria/commissions", "POST"
  );

  async function handleCalculer() {
    const res = await calculer({ mois, annee });
    if (res?.commissions) {
      toast.success(`${res.commissions.length} commission(s) calculée(s)`);
      refetch();
    }
  }

  const commissions = data?.commissions ?? [];
  const byRole = (role: string) => commissions.filter((c) => c.roleType === role);

  const tabs: { key: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "AGENT_TERRAIN", label: "Agents terrain",  icon: <Users size={15} />,     count: byRole("AGENT_TERRAIN").length },
    { key: "CHEF_AGENCE",   label: "RPV Chef agence", icon: <UserCheck size={15} />, count: byRole("CHEF_AGENCE").length },
    { key: "RPV_REGIONAL",  label: "RPV Régional",    icon: <TrendingUp size={15} />,count: byRole("RPV_REGIONAL").length },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Commissions RIA</h1>
          <p className="text-sm text-slate-500 mt-0.5">Commissions agents et RPV sur recouvrements — consultation</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
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
        <button onClick={handleCalculer} disabled={calcLoading}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50">
          <Calculator className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
          Calculer {MOIS_LABELS[mois - 1]} {annee}
        </button>
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

      {/* Taux configurés (lecture seule) */}
      {data?.config && data.config.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 mb-3">Taux configurés (lecture seule — modifiable par admin)</p>
          <div className="flex flex-wrap gap-4">
            {data.config.map((c) => (
              <div key={c.roleType} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-slate-600">{c.roleType === "AGENT_TERRAIN" ? "Agent terrain" : c.roleType === "CHEF_AGENCE" ? "Chef agence" : "RPV Régional"} :</span>
                <span className="text-sm font-semibold text-emerald-600">{Number(c.tauxBase).toFixed(1)}%</span>
              </div>
            ))}
          </div>
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
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${tab === t.key ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <CommissionReadTable
        commissions={byRole(tab)}
        loading={loading}
        roleType={tab}
        expand={expand}
        setExpand={setExpand}
      />
    </div>
  );
}

// ── Tableau lecture seule ─────────────────────────────────────────────────────

interface ReadTableProps {
  commissions: CommissionDB[];
  loading: boolean;
  roleType: TabType;
  expand: number | null;
  setExpand: (id: number | null) => void;
}

function CommissionReadTable({ commissions, loading, roleType, expand, setExpand }: ReadTableProps) {
  const isAgent = roleType === "AGENT_TERRAIN";

  if (loading) {
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
                <th className="px-4 py-3 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((c) => (
                <>
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.user.prenom} {c.user.nom}</td>
                    {isAgent && (
                      <>
                        <td className="px-4 py-3 text-center text-slate-600">{c.nbDossiersRembourses}/{c.nbDossiers}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-semibold ${Number(c.tauxSucces) >= 80 ? "text-emerald-600" : Number(c.tauxSucces) >= 50 ? "text-amber-600" : "text-red-500"}`}>
                              {Number(c.tauxSucces).toFixed(1)}%
                            </span>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${Number(c.tauxSucces) >= 80 ? "bg-emerald-500" : Number(c.tauxSucces) >= 50 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(Number(c.tauxSucces), 100)}%` }} />
                            </div>
                          </div>
                        </td>
                      </>
                    )}
                    {!isAgent && (
                      <td className="px-4 py-3 text-center text-slate-600">{c.nbDossiers}</td>
                    )}
                    <td className="px-4 py-3 text-right text-slate-700">{fmt(Number(c.montantRecouvre))}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{Number(c.taux).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(Number(c.montant))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUT_COLORS[c.statut] ?? "bg-slate-100 text-slate-600"}`}>
                        {STATUT_LABELS[c.statut] ?? c.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setExpand(expand === c.id ? null : c.id)} className="text-slate-400 hover:text-slate-600">
                        {expand === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expand === c.id && (
                    <tr key={`${c.id}-detail`} className="bg-slate-50">
                      <td colSpan={isAgent ? 8 : 7} className="px-4 py-3">
                        <div className="text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div><span className="text-slate-400">Période :</span> {MOIS_LABELS[c.mois - 1]} {c.annee}</div>
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
