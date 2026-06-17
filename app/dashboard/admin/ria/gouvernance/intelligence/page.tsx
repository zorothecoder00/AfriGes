"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import {
  Brain, RefreshCw, AlertTriangle, TrendingDown, Users, Building2,
  TrendingUp, Clock, FileStack, Calendar, Activity, Wifi,
  AlertCircle, CheckCircle2, XCircle,
} from "lucide-react";

interface IntelData {
  anomaliesActives: { id: number; titre: string; niveau: string; typeCommission: string; createdAt: string }[];
  portefeillesEnDanger: { id: number; reference: string; investisseur: string; risque: string; capitalDisponible: number }[];
  clientsDefaillants: { id: number; nom: string; prenom: string; montantDu: number; joursRetard: number }[];
  agencesSousPerformantes: { id: number; nom: string; tauxRecouvrement: number; objectif: number }[];
  regionsRentables: { region: string; rendement: number; volume: number }[];
  dossiersEnAttente: { id: number; reference: string; titre: string; commissionReceptrice: string; joursEnAttente: number }[];
  reunionsPlanifiees: { id: number; titre: string; typeCommission: string; dateHeure: string }[];
  plansEnRetard: { id: number; titre: string; typeCommission: string; dateEcheance: string; responsable: string | null }[];
}

const NIVEAUX_COLORS: Record<string, string> = {
  MINEURE:  "border-l-amber-400 bg-amber-50",
  MAJEURE:  "border-l-orange-400 bg-orange-50",
  CRITIQUE: "border-l-rose-500 bg-rose-50",
};
const NIVEAUX_BADGE: Record<string, string> = {
  MINEURE:  "bg-amber-100 text-amber-700",
  MAJEURE:  "bg-orange-100 text-orange-700",
  CRITIQUE: "bg-rose-100 text-rose-700",
};

function SectionCard({ title, icon, color, children, count }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode; count?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-5 py-3 border-b border-slate-100 flex items-center justify-between ${color}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {count !== undefined && (
          <span className="text-xs font-medium bg-white/70 px-2 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  );
}

export default function IntelligencePage() {
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<IntelData>(
    `/api/admin/ria/commissions/gouvernance/intelligence?_r=${refresh}`
  );

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
  const fmtC = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-600" /> Centre d&apos;Intelligence Décisionnelle
          </h1>
          <p className="text-sm text-slate-500">Agrégation automatique des signaux critiques et opportunités</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Analyse en cours...</p>
          </div>
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">
          <Wifi className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Impossible de charger les données</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Anomalies actives */}
          <SectionCard title="Anomalies de gouvernance actives" count={data.anomaliesActives.length}
            color="bg-rose-50 text-rose-700"
            icon={<AlertTriangle className="w-4 h-4" />}>
            {data.anomaliesActives.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aucune anomalie active
              </div>
            ) : data.anomaliesActives.slice(0, 5).map(a => (
              <div key={a.id} className={`px-5 py-3 border-l-4 ${NIVEAUX_COLORS[a.niveau] || "border-l-slate-300"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{a.titre}</p>
                  <span className={`ml-2 shrink-0 text-xs px-1.5 py-0.5 rounded ${NIVEAUX_BADGE[a.niveau] || "bg-slate-100 text-slate-600"}`}>
                    {a.niveau}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{a.typeCommission} · {new Date(a.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
            ))}
          </SectionCard>

          {/* Portefeuilles en danger */}
          <SectionCard title="Portefeuilles à risque élevé" count={data.portefeillesEnDanger.length}
            color="bg-orange-50 text-orange-700"
            icon={<AlertCircle className="w-4 h-4" />}>
            {data.portefeillesEnDanger.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aucun portefeuille en danger
              </div>
            ) : data.portefeillesEnDanger.slice(0, 5).map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.reference}</p>
                  <p className="text-xs text-slate-400">{p.investisseur}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-orange-700">{p.risque}</p>
                  <p className="text-xs text-slate-500">{fmtC(p.capitalDisponible)} dispo.</p>
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Clients défaillants */}
          <SectionCard title="Clients défaillants (créances échues)" count={data.clientsDefaillants.length}
            color="bg-rose-50 text-rose-700"
            icon={<Users className="w-4 h-4" />}>
            {data.clientsDefaillants.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aucune créance échue
              </div>
            ) : data.clientsDefaillants.slice(0, 5).map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.prenom} {c.nom}</p>
                  <p className="text-xs text-rose-500 font-medium">{c.joursRetard}j de retard</p>
                </div>
                <p className="text-sm font-semibold text-rose-700">{fmtC(c.montantDu)}</p>
              </div>
            ))}
          </SectionCard>

          {/* Dossiers inter-comm en attente */}
          <SectionCard title="Dossiers inter-commissions en attente" count={data.dossiersEnAttente.length}
            color="bg-violet-50 text-violet-700"
            icon={<FileStack className="w-4 h-4" />}>
            {data.dossiersEnAttente.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aucun dossier en attente
              </div>
            ) : data.dossiersEnAttente.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{d.reference}</p>
                  <p className="text-xs text-slate-400 line-clamp-1">{d.titre}</p>
                  <p className="text-xs text-violet-500">→ {d.commissionReceptrice}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${d.joursEnAttente > 7 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                  {d.joursEnAttente}j
                </span>
              </div>
            ))}
          </SectionCard>

          {/* Plans d'action en retard */}
          <SectionCard title="Plans d'action en retard" count={data.plansEnRetard.length}
            color="bg-amber-50 text-amber-700"
            icon={<Clock className="w-4 h-4" />}>
            {data.plansEnRetard.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aucun plan en retard
              </div>
            ) : data.plansEnRetard.slice(0, 5).map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{p.titre}</p>
                  <p className="text-xs text-slate-400">{p.typeCommission} · {p.responsable || "Non assigné"}</p>
                </div>
                <p className="text-xs text-rose-600 font-medium shrink-0 ml-2">
                  {new Date(p.dateEcheance).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}
          </SectionCard>

          {/* Prochaines réunions */}
          <SectionCard title="Réunions à venir (7 jours)" count={data.reunionsPlanifiees.length}
            color="bg-blue-50 text-blue-700"
            icon={<Calendar className="w-4 h-4" />}>
            {data.reunionsPlanifiees.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">Aucune réunion planifiée dans les 7 jours</div>
            ) : data.reunionsPlanifiees.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{r.titre}</p>
                  <p className="text-xs text-slate-400">{r.typeCommission === "OPERATIONS_TERRAIN" ? "Opérations" : r.typeCommission.charAt(0) + r.typeCommission.slice(1).toLowerCase()}</p>
                </div>
                <p className="text-xs text-blue-600 font-medium shrink-0 ml-2">
                  {new Date(r.dateHeure).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  {" "}
                  {new Date(r.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </SectionCard>

          {/* Agences sous-performantes */}
          <SectionCard title="Agences sous-performantes" count={data.agencesSousPerformantes.length}
            color="bg-slate-50 text-slate-600"
            icon={<Building2 className="w-4 h-4" />}>
            {data.agencesSousPerformantes.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Toutes agences au-dessus de l&apos;objectif
              </div>
            ) : data.agencesSousPerformantes.slice(0, 5).map(a => (
              <div key={a.id} className="px-5 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800">{a.nom}</p>
                  <span className="text-xs text-rose-600 font-medium">{a.tauxRecouvrement.toFixed(1)}% / {a.objectif}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, (a.tauxRecouvrement / a.objectif) * 100)}%` }} />
                </div>
              </div>
            ))}
          </SectionCard>

          {/* Régions les plus rentables */}
          <SectionCard title="Régions les plus rentables" count={data.regionsRentables.length}
            color="bg-emerald-50 text-emerald-700"
            icon={<TrendingUp className="w-4 h-4" />}>
            {data.regionsRentables.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">Pas encore de données régionales</div>
            ) : data.regionsRentables.slice(0, 5).map((r, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center justify-center">{i+1}</span>
                  <p className="text-sm font-medium text-slate-800">{r.region}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700">{r.rendement.toFixed(1)}%</p>
                  <p className="text-xs text-slate-400">{fmtC(r.volume)}</p>
                </div>
              </div>
            ))}
          </SectionCard>

        </div>
      )}
    </div>
  );
}
