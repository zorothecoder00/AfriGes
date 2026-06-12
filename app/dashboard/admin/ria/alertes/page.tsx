"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle, RefreshCw, Clock, Users, TrendingDown,
  ShieldAlert, BadgeDollarSign, Settings, ChevronDown, ChevronUp,
  CheckCircle, XCircle,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetardItem {
  id: number; reference: string; clientNom: string; clientTel?: string | null;
  portefeuilleRef: string; investisseurNom: string;
  montantFinance: number; encours: number; dateEcheance: string;
  joursRetard: number; statut: string;
}

interface CapitalFaibleItem {
  id: number; reference: string; investisseurNom: string;
  capitalInvesti: number; capitalDisponible: number; ratio: number;
}

interface PortefeuilleRisqueItem {
  id: number; reference: string; investisseurNom: string;
  nbRisque: number; totalAffectations: number; ratioRisque: number;
}

interface RentabiliteBaisseItem {
  portefeuilleId: number; reference: string; investisseurNom: string;
  tauxCourant: number; tauxPrec: number; baisse: number;
}

interface ImpayeItem {
  id: number; reference: string; encours: number; statut: string;
  dateEcheance: string | null; joursRetard: number | null;
}

interface AlertesData {
  resume: {
    nbAlertesCritiques: number; nbAlertesTotal: number;
    totalImpayes: number; tauxDefaut: number; totalActifs: number;
  };
  clients: {
    retards3j: RetardItem[]; retards7j: RetardItem[];
    retards15j: RetardItem[]; retards30j: RetardItem[];
    totalRetards: number; totalEncoursRisque: number;
  };
  investisseurs: {
    capitalFaible: CapitalFaibleItem[];
    portefeuillesARisque: PortefeuilleRisqueItem[];
    rentabiliteEnBaisse: RentabiliteBaisseItem[];
  };
  direction: {
    impayes: ImpayeItem[]; totalImpayes: number; nbDefauts: number;
    tauxDefaut: number; alerteImpayes: boolean; alerteDefaut: boolean;
  };
  seuils: Record<string, number>;
}

interface ConfigItem {
  cle: string; valeur: number; description: string; modifie: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";

const RETARD_COLORS: Record<string, string> = {
  "3j":  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "7j":  "bg-orange-100 text-orange-700 border-orange-200",
  "15j": "bg-red-100 text-red-700 border-red-200",
  "30j": "bg-red-900/10 text-red-900 border-red-300",
};

type SectionTab = "clients" | "investisseurs" | "direction" | "config";
type RetardTab  = "3j" | "7j" | "15j" | "30j";

// ── Component ─────────────────────────────────────────────────────────────────

export default function AlertesRIAPage() {
  const [section,    setSection]   = useState<SectionTab>("clients");
  const [retardTab,  setRetardTab] = useState<RetardTab>("3j");
  const [expand,     setExpand]    = useState<string | null>(null);

  const { data, loading, refetch } = useApi<AlertesData>("/api/admin/ria/alertes");
  const { data: configData, refetch: refetchConfig } = useApi<ConfigItem[]>("/api/admin/ria/alertes/config");

  const [seuils, setSeuils] = useState<Record<string, number>>({});
  const [configInit, setConfigInit] = useState(false);

  if (configData && !configInit) {
    const init: Record<string, number> = {};
    for (const c of configData) init[c.cle] = c.valeur;
    setSeuils(init);
    setConfigInit(true);
  }

  const { mutate: saveConfig, loading: savingConfig } = useMutation<{ success: boolean }, { cle: string; valeur: number }[]>(
    "/api/admin/ria/alertes/config", "POST"
  );

  async function handleSaveConfig() {
    const body = Object.entries(seuils).map(([cle, valeur]) => ({ cle, valeur }));
    const res  = await saveConfig(body);
    if (res?.success) {
      toast.success("Seuils sauvegardés");
      setConfigInit(false);
      refetchConfig();
      refetch();
    }
  }

  const d = data;
  const r = d?.resume;

  const retardMap: Record<RetardTab, RetardItem[]> = {
    "3j":  d?.clients.retards3j  ?? [],
    "7j":  d?.clients.retards7j  ?? [],
    "15j": d?.clients.retards15j ?? [],
    "30j": d?.clients.retards30j ?? [],
  };

  const sections: { key: SectionTab; label: string; icon: React.ReactNode; badge?: number; critical?: boolean }[] = [
    { key: "clients",      label: "Clients",       icon: <Users size={15} />,        badge: d?.clients.totalRetards,               critical: (d?.clients.retards30j.length ?? 0) > 0 },
    { key: "investisseurs",label: "Investisseurs",  icon: <TrendingDown size={15} />, badge: (d?.investisseurs.capitalFaible.length ?? 0) + (d?.investisseurs.portefeuillesARisque.length ?? 0) },
    { key: "direction",    label: "Direction",      icon: <ShieldAlert size={15} />,  critical: d?.direction.alerteImpayes || d?.direction.alerteDefaut },
    { key: "config",       label: "Configuration",  icon: <Settings size={15} /> },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            Alertes Automatiques RIA
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Surveillance en temps réel — retards, risques et seuils</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {/* KPIs */}
      {r && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`rounded-xl border p-4 ${r.nbAlertesCritiques > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500">Alertes critiques</p>
            <p className={`text-2xl font-bold mt-1 ${r.nbAlertesCritiques > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {r.nbAlertesCritiques}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Alertes totales</p>
            <p className={`text-2xl font-bold mt-1 ${r.nbAlertesTotal > 0 ? "text-amber-600" : "text-emerald-600"}`}>{r.nbAlertesTotal}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Encours à risque</p>
            <p className="text-lg font-bold mt-1 text-slate-800">{fmt(r.totalImpayes)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${r.tauxDefaut >= (d?.seuils.TAUX_DEFAUT_SEUIL ?? 10) ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500">Taux de défaut</p>
            <p className={`text-2xl font-bold mt-1 ${r.tauxDefaut >= (d?.seuils.TAUX_DEFAUT_SEUIL ?? 10) ? "text-red-600" : "text-emerald-600"}`}>
              {r.tauxDefaut}%
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {sections.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                section === s.key ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {s.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
              {s.icon} {s.label}
              {s.badge !== undefined && s.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${section === s.key ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section Clients ── */}
      {section === "clients" && (
        <div className="space-y-4">
          {/* Sous-onglets retards */}
          <div className="flex gap-2 flex-wrap">
            {(["3j", "7j", "15j", "30j"] as RetardTab[]).map((t) => {
              const count = retardMap[t].length;
              return (
                <button key={t} onClick={() => setRetardTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    retardTab === t
                      ? `${RETARD_COLORS[t]} font-medium`
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  <Clock size={13} />
                  Retard {t}
                  <span className="ml-1 font-bold">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Résumé encours */}
          {d && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">{d.clients.totalRetards} client(s) en retard</p>
                <p className="text-xs text-amber-600 mt-0.5">Encours total à risque : {fmt(d.clients.totalEncoursRisque)}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
          )}

          <RetardTable rows={retardMap[retardTab]} expand={expand} setExpand={setExpand} level={retardTab} />
        </div>
      )}

      {/* ── Section Investisseurs ── */}
      {section === "investisseurs" && (
        <div className="space-y-6">
          {/* Capital faible */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <BadgeDollarSign size={16} className="text-amber-500" />
              Capital disponible faible ({d?.investisseurs.capitalFaible.length ?? 0})
              <span className="text-xs text-slate-400 font-normal">— ratio &lt; {d?.seuils.CAPITAL_FAIBLE_SEUIL ?? 20}%</span>
            </h3>
            {(!d?.investisseurs.capitalFaible.length) ? (
              <EmptyState icon={<CheckCircle size={32} className="text-emerald-400" />} message="Aucun portefeuille avec capital faible" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Portefeuille</th>
                      <th className="px-4 py-3 text-left">Investisseur</th>
                      <th className="px-4 py-3 text-right">Capital investi</th>
                      <th className="px-4 py-3 text-right">Capital disponible</th>
                      <th className="px-4 py-3 text-center">Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.capitalFaible.map((pf) => (
                      <tr key={pf.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{pf.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(pf.capitalInvesti)}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmt(pf.capitalDisponible)}</td>
                        <td className="px-4 py-3 text-center">
                          <RatioBar ratio={pf.ratio} warn={20} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Portefeuilles à risque */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ShieldAlert size={16} className="text-orange-500" />
              Portefeuilles à risque ({d?.investisseurs.portefeuillesARisque.length ?? 0})
              <span className="text-xs text-slate-400 font-normal">— &gt; {d?.seuils.RISQUE_ELEVE_SEUIL ?? 30}% affectations classe D/E</span>
            </h3>
            {(!d?.investisseurs.portefeuillesARisque.length) ? (
              <EmptyState icon={<CheckCircle size={32} className="text-emerald-400" />} message="Aucun portefeuille à risque élevé" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Portefeuille</th>
                      <th className="px-4 py-3 text-left">Investisseur</th>
                      <th className="px-4 py-3 text-center">Affectations risque D/E</th>
                      <th className="px-4 py-3 text-center">Total affectations</th>
                      <th className="px-4 py-3 text-center">Ratio risque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.portefeuillesARisque.map((pf) => (
                      <tr key={pf.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{pf.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-center text-orange-600 font-medium">{pf.nbRisque}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{pf.totalAffectations}</td>
                        <td className="px-4 py-3 text-center">
                          <RatioBar ratio={pf.ratioRisque} warn={30} invert />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rentabilité en baisse */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <TrendingDown size={16} className="text-red-500" />
              Rentabilité en baisse ({d?.investisseurs.rentabiliteEnBaisse.length ?? 0})
              <span className="text-xs text-slate-400 font-normal">— baisse &gt; {d?.seuils.RENTABILITE_BAISSE_SEUIL ?? 10}% vs mois précédent</span>
            </h3>
            {(!d?.investisseurs.rentabiliteEnBaisse.length) ? (
              <EmptyState icon={<CheckCircle size={32} className="text-emerald-400" />} message="Aucune baisse de rentabilité détectée" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Portefeuille</th>
                      <th className="px-4 py-3 text-left">Investisseur</th>
                      <th className="px-4 py-3 text-center">Taux mois précédent</th>
                      <th className="px-4 py-3 text-center">Taux actuel</th>
                      <th className="px-4 py-3 text-center">Baisse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.rentabiliteEnBaisse.map((item) => (
                      <tr key={item.portefeuilleId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{item.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{item.tauxPrec.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-center text-slate-800 font-medium">{item.tauxCourant.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">−{item.baisse.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section Direction ── */}
      {section === "direction" && d && (
        <div className="space-y-6">
          {/* Badges synthèse */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AlerteBadge
              active={d.direction.alerteImpayes}
              label="Impayés critiques"
              value={fmt(d.direction.totalImpayes)}
              sub={`Seuil : ${fmt(d.seuils.IMPAYES_MONTANT_SEUIL ?? 1000000)}`}
              icon={<BadgeDollarSign size={24} />}
            />
            <AlerteBadge
              active={d.direction.alerteDefaut}
              label="Taux de défaut élevé"
              value={`${d.direction.tauxDefaut}%`}
              sub={`Seuil : ${d.seuils.TAUX_DEFAUT_SEUIL ?? 10}% — ${d.direction.nbDefauts} dossier(s) en défaut`}
              icon={<XCircle size={24} />}
            />
          </div>

          {/* Tableau impayés */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Détail impayés ({d.direction.impayes.length})
            </h3>
            {d.direction.impayes.length === 0 ? (
              <EmptyState icon={<CheckCircle size={32} className="text-emerald-400" />} message="Aucun impayé détecté" />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Référence</th>
                      <th className="px-4 py-3 text-right">Encours</th>
                      <th className="px-4 py-3 text-center">Statut</th>
                      <th className="px-4 py-3 text-center">Échéance</th>
                      <th className="px-4 py-3 text-center">Jours retard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.direction.impayes.map((imp) => (
                      <tr key={imp.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{imp.reference}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(imp.encours)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${imp.statut === "DEFAUT" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                            {imp.statut}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 text-xs">
                          {imp.dateEcheance ? new Date(imp.dateEcheance).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {imp.joursRetard !== null ? (
                            <span className={`font-semibold text-xs ${imp.joursRetard >= 30 ? "text-red-600" : imp.joursRetard >= 15 ? "text-orange-600" : "text-amber-600"}`}>
                              {imp.joursRetard}j
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section Config ── */}
      {section === "config" && configData && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Ajustez les seuils qui déclenchent les alertes. Les valeurs sont appliquées en temps réel à chaque chargement.</p>
          <div className="grid md:grid-cols-2 gap-4">
            {configData.map((item) => (
              <div key={item.cle} className="bg-white rounded-xl border border-slate-200 p-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">{item.description}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step={item.cle === "IMPAYES_MONTANT_SEUIL" ? 100000 : 0.5}
                    min={0}
                    value={seuils[item.cle] ?? item.valeur}
                    onChange={(e) => setSeuils((prev) => ({ ...prev, [item.cle]: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  <span className="text-xs text-slate-400">
                    {item.cle === "IMPAYES_MONTANT_SEUIL" ? "FCFA" : "%"}
                  </span>
                </div>
                {item.modifie && (
                  <p className="text-xs text-emerald-600 mt-1">Valeur personnalisée (défaut : {item.valeur})</p>
                )}
              </div>
            ))}
          </div>
          <button onClick={handleSaveConfig} disabled={savingConfig}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50 font-medium">
            <Settings size={16} />
            {savingConfig ? "Enregistrement…" : "Enregistrer les seuils"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

function RetardTable({ rows, expand, setExpand, level }: {
  rows: RetardItem[]; expand: string | null;
  setExpand: (k: string | null) => void; level: RetardTab;
}) {
  const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
  if (!rows.length) return <EmptyState icon={<CheckCircle size={32} className="text-emerald-400" />} message={`Aucun retard de ${level} pour cette période`} />;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Investisseur</th>
              <th className="px-4 py-3 text-right">Encours</th>
              <th className="px-4 py-3 text-center">Échéance</th>
              <th className="px-4 py-3 text-center">Retard</th>
              <th className="px-4 py-3 text-center">Statut</th>
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const key = `retard-${r.id}`;
              return (
                <Fragment key={key}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.clientNom}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{r.investisseurNom || r.portefeuilleRef}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(r.encours)}</td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs">{new Date(r.dateEcheance).toLocaleDateString("fr-FR")}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-bold border ${RETARD_COLORS[level]}`}>
                        {r.joursRetard}j
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${r.statut === "DEFAUT" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                        {r.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => setExpand(expand === key ? null : key)} className="text-slate-400 hover:text-slate-600">
                        {expand === key ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                  {expand === key && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="px-4 py-3 text-xs text-slate-600">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div><span className="text-slate-400">Référence :</span> {r.reference}</div>
                          <div><span className="text-slate-400">Portefeuille :</span> {r.portefeuilleRef}</div>
                          <div><span className="text-slate-400">Montant financé :</span> {fmt(r.montantFinance)}</div>
                          {r.clientTel && <div><span className="text-slate-400">Téléphone :</span> {r.clientTel}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RatioBar({ ratio, warn, invert = false }: { ratio: number; warn: number; invert?: boolean }) {
  const isAlert = invert ? ratio >= warn : ratio < warn;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`text-xs font-semibold ${isAlert ? "text-red-600" : "text-emerald-600"}`}>{ratio}%</span>
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${isAlert ? "bg-red-400" : "bg-emerald-400"}`}
          style={{ width: `${Math.min(ratio, 100)}%` }} />
      </div>
    </div>
  );
}

function AlerteBadge({ active, label, value, sub, icon }: { active: boolean; label: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-5 flex items-center gap-4 ${active ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-200"}`}>
      <div className={`p-3 rounded-xl ${active ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${active ? "text-red-600" : "text-emerald-600"}`}>{value}</p>
        <p className="text-xs text-slate-400 mt-1">{sub}</p>
      </div>
      <div className="ml-auto">
        {active
          ? <AlertTriangle className="w-6 h-6 text-red-400" />
          : <CheckCircle className="w-6 h-6 text-emerald-400" />
        }
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 py-10 flex flex-col items-center gap-2 text-slate-400">
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}
