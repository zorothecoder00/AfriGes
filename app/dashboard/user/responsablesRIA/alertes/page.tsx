"use client";

import { Fragment, useState } from "react";
import {
  AlertTriangle, RefreshCw, Clock, Users, TrendingDown,
  ShieldAlert, BadgeDollarSign, CheckCircle, XCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

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
  resume: { nbAlertesCritiques: number; nbAlertesTotal: number; totalImpayes: number; tauxDefaut: number; totalActifs: number };
  clients: { retards3j: RetardItem[]; retards7j: RetardItem[]; retards15j: RetardItem[]; retards30j: RetardItem[]; totalRetards: number; totalEncoursRisque: number };
  investisseurs: { capitalFaible: CapitalFaibleItem[]; portefeuillesARisque: PortefeuilleRisqueItem[]; rentabiliteEnBaisse: RentabiliteBaisseItem[] };
  direction: { impayes: ImpayeItem[]; totalImpayes: number; nbDefauts: number; tauxDefaut: number; alerteImpayes: boolean; alerteDefaut: boolean };
  seuils: Record<string, number>;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
const RETARD_COLORS: Record<string, string> = {
  "3j":  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "7j":  "bg-orange-100 text-orange-700 border-orange-200",
  "15j": "bg-red-100 text-red-700 border-red-200",
  "30j": "bg-red-900/10 text-red-900 border-red-300",
};

type SectionTab = "clients" | "investisseurs" | "direction";
type RetardTab  = "3j" | "7j" | "15j" | "30j";

export default function AlertesRIAResponsablePage() {
  const [section,   setSection]  = useState<SectionTab>("clients");
  const [retardTab, setRetardTab] = useState<RetardTab>("3j");
  const [expand,    setExpand]   = useState<string | null>(null);

  const { data, loading, refetch } = useApi<AlertesData>("/api/admin/ria/alertes");
  const d = data;
  const r = d?.resume;

  const retardMap: Record<RetardTab, RetardItem[]> = {
    "3j":  d?.clients.retards3j  ?? [],
    "7j":  d?.clients.retards7j  ?? [],
    "15j": d?.clients.retards15j ?? [],
    "30j": d?.clients.retards30j ?? [],
  };

  const sections: { key: SectionTab; label: string; icon: React.ReactNode; badge?: number; critical?: boolean }[] = [
    { key: "clients",       label: "Clients",       icon: <Users size={15} />,        badge: d?.clients.totalRetards, critical: (d?.clients.retards30j.length ?? 0) > 0 },
    { key: "investisseurs", label: "Investisseurs",  icon: <TrendingDown size={15} />, badge: (d?.investisseurs.capitalFaible.length ?? 0) + (d?.investisseurs.portefeuillesARisque.length ?? 0) },
    { key: "direction",     label: "Direction",      icon: <ShieldAlert size={15} />,  critical: d?.direction.alerteImpayes || d?.direction.alerteDefaut },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" /> Alertes Automatiques RIA
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Surveillance en temps réel — retards, risques et seuils</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {r && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={`rounded-xl border p-4 ${r.nbAlertesCritiques > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <p className="text-xs text-slate-500">Alertes critiques</p>
            <p className={`text-2xl font-bold mt-1 ${r.nbAlertesCritiques > 0 ? "text-red-600" : "text-emerald-600"}`}>{r.nbAlertesCritiques}</p>
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
            <p className={`text-2xl font-bold mt-1 ${r.tauxDefaut >= (d?.seuils.TAUX_DEFAUT_SEUIL ?? 10) ? "text-red-600" : "text-emerald-600"}`}>{r.tauxDefaut}%</p>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {sections.map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${section === s.key ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {s.critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
              {s.icon} {s.label}
              {s.badge !== undefined && s.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${section === s.key ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clients ── */}
      {section === "clients" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["3j", "7j", "15j", "30j"] as RetardTab[]).map((t) => (
              <button key={t} onClick={() => setRetardTab(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${retardTab === t ? `${RETARD_COLORS[t]} font-medium` : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <Clock size={13} /> Retard {t} <span className="ml-1 font-bold">{retardMap[t].length}</span>
              </button>
            ))}
          </div>
          {d && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">{d.clients.totalRetards} client(s) en retard</p>
                <p className="text-xs text-amber-600 mt-0.5">Encours total à risque : {fmt(d.clients.totalEncoursRisque)}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
          )}
          <RetardReadTable rows={retardMap[retardTab]} expand={expand} setExpand={setExpand} level={retardTab} />
        </div>
      )}

      {/* ── Investisseurs ── */}
      {section === "investisseurs" && (
        <div className="space-y-6">
          <InvestisseurSection title="Capital disponible faible" count={d?.investisseurs.capitalFaible.length ?? 0}
            icon={<BadgeDollarSign size={16} className="text-amber-500" />}
            sub={`ratio < ${d?.seuils.CAPITAL_FAIBLE_SEUIL ?? 20}%`}>
            {(!d?.investisseurs.capitalFaible.length)
              ? <Empty message="Aucun portefeuille avec capital faible" />
              : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                    <th className="px-4 py-3 text-left">Portefeuille</th><th className="px-4 py-3 text-left">Investisseur</th>
                    <th className="px-4 py-3 text-right">Capital investi</th><th className="px-4 py-3 text-right">Capital disponible</th>
                    <th className="px-4 py-3 text-center">Ratio</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.capitalFaible.map((pf) => (
                      <tr key={pf.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{pf.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-right">{fmt(pf.capitalInvesti)}</td>
                        <td className="px-4 py-3 text-right">{fmt(pf.capitalDisponible)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold ${pf.ratio < 20 ? "text-red-600" : "text-emerald-600"}`}>{pf.ratio}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </InvestisseurSection>

          <InvestisseurSection title="Portefeuilles à risque" count={d?.investisseurs.portefeuillesARisque.length ?? 0}
            icon={<ShieldAlert size={16} className="text-orange-500" />}
            sub={`> ${d?.seuils.RISQUE_ELEVE_SEUIL ?? 30}% affectations D/E`}>
            {(!d?.investisseurs.portefeuillesARisque.length)
              ? <Empty message="Aucun portefeuille à risque élevé" />
              : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                    <th className="px-4 py-3 text-left">Portefeuille</th><th className="px-4 py-3 text-left">Investisseur</th>
                    <th className="px-4 py-3 text-center">D/E</th><th className="px-4 py-3 text-center">Total</th><th className="px-4 py-3 text-center">Ratio</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.portefeuillesARisque.map((pf) => (
                      <tr key={pf.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{pf.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{pf.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-center text-orange-600 font-medium">{pf.nbRisque}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{pf.totalAffectations}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">{pf.ratioRisque}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </InvestisseurSection>

          <InvestisseurSection title="Rentabilité en baisse" count={d?.investisseurs.rentabiliteEnBaisse.length ?? 0}
            icon={<TrendingDown size={16} className="text-red-500" />}
            sub={`baisse > ${d?.seuils.RENTABILITE_BAISSE_SEUIL ?? 10}% vs mois précédent`}>
            {(!d?.investisseurs.rentabiliteEnBaisse.length)
              ? <Empty message="Aucune baisse de rentabilité détectée" />
              : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                    <th className="px-4 py-3 text-left">Portefeuille</th><th className="px-4 py-3 text-left">Investisseur</th>
                    <th className="px-4 py-3 text-center">Taux M-1</th><th className="px-4 py-3 text-center">Taux actuel</th><th className="px-4 py-3 text-center">Baisse</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {d?.investisseurs.rentabiliteEnBaisse.map((item) => (
                      <tr key={item.portefeuilleId} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.reference}</td>
                        <td className="px-4 py-3 text-slate-600">{item.investisseurNom || "—"}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{item.tauxPrec.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-center font-medium text-slate-800">{item.tauxCourant.toFixed(2)}%</td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">−{item.baisse.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </InvestisseurSection>
        </div>
      )}

      {/* ── Direction ── */}
      {section === "direction" && d && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { active: d.direction.alerteImpayes, label: "Impayés critiques", value: fmt(d.direction.totalImpayes), sub: `Seuil : ${fmt(d.seuils.IMPAYES_MONTANT_SEUIL ?? 1000000)}`, icon: <BadgeDollarSign size={24} /> },
              { active: d.direction.alerteDefaut, label: "Taux de défaut élevé", value: `${d.direction.tauxDefaut}%`, sub: `Seuil : ${d.seuils.TAUX_DEFAUT_SEUIL ?? 10}% — ${d.direction.nbDefauts} dossier(s)`, icon: <XCircle size={24} /> },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-5 flex items-center gap-4 ${item.active ? "bg-red-50 border-red-300" : "bg-emerald-50 border-emerald-200"}`}>
                <div className={`p-3 rounded-xl ${item.active ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>{item.icon}</div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">{item.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${item.active ? "text-red-600" : "text-emerald-600"}`}>{item.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{item.sub}</p>
                </div>
                <div className="ml-auto">
                  {item.active ? <AlertTriangle className="w-6 h-6 text-red-400" /> : <CheckCircle className="w-6 h-6 text-emerald-400" />}
                </div>
              </div>
            ))}
          </div>

          {d.direction.impayes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-700">Détail impayés ({d.direction.impayes.length})</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
                  <th className="px-4 py-3 text-left">Référence</th><th className="px-4 py-3 text-right">Encours</th>
                  <th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-center">Jours retard</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {d.direction.impayes.map((imp) => (
                    <tr key={imp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{imp.reference}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(imp.encours)}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full font-medium ${imp.statut === "DEFAUT" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{imp.statut}</span></td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-red-600">{imp.joursRetard !== null ? `${imp.joursRetard}j` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InvestisseurSection({ title, count, icon, sub, children }: {
  title: string; count: number; icon: React.ReactNode; sub: string; children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        {icon} {title} ({count}) <span className="text-xs text-slate-400 font-normal">— {sub}</span>
      </h3>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">{children}</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
      <CheckCircle size={32} className="text-emerald-400" /><p className="text-sm">{message}</p>
    </div>
  );
}

function RetardReadTable({ rows, expand, setExpand, level }: { rows: RetardItem[]; expand: string | null; setExpand: (k: string | null) => void; level: RetardTab }) {
  if (!rows.length) return <Empty message={`Aucun retard de ${level}`} />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr>
          <th className="px-4 py-3 text-left">Client</th><th className="px-4 py-3 text-left">Investisseur</th>
          <th className="px-4 py-3 text-right">Encours</th><th className="px-4 py-3 text-center">Échéance</th>
          <th className="px-4 py-3 text-center">Retard</th><th className="px-4 py-3 text-center">Statut</th>
          <th className="px-4 py-3 w-8"></th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const key = `r-${r.id}`;
            return (
              <Fragment key={key}>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.clientNom}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{r.investisseurNom || r.portefeuilleRef}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(r.encours)}</td>
                  <td className="px-4 py-3 text-center text-slate-500 text-xs">{new Date(r.dateEcheance).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full font-bold border ${RETARD_COLORS[level]}`}>{r.joursRetard}j</span></td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded-full ${r.statut === "DEFAUT" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>{r.statut}</span></td>
                  <td className="px-4 py-3 text-center"><button onClick={() => setExpand(expand === key ? null : key)} className="text-slate-400 hover:text-slate-600">{expand === key ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
                </tr>
                {expand === key && (
                  <tr className="bg-slate-50">
                    <td colSpan={7} className="px-4 py-3 text-xs text-slate-600 grid grid-cols-2 md:grid-cols-4 gap-3">
                      <span><span className="text-slate-400">Réf :</span> {r.reference}</span>
                      <span><span className="text-slate-400">PF :</span> {r.portefeuilleRef}</span>
                      <span><span className="text-slate-400">Financé :</span> {fmt(r.montantFinance)}</span>
                      {r.clientTel && <span><span className="text-slate-400">Tél :</span> {r.clientTel}</span>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
