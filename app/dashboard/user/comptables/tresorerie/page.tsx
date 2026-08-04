"use client";

import { useState } from "react";
import {
  Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, CheckCircle, ShoppingBag,
  BookOpen, Package, Users, Filter, Calendar,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

type Period = "7" | "30" | "90" | "365";

interface EvolutionPoint { date: string; encaissements: number; decaissements: number; }

interface SyntheseResponse {
  success: boolean;
  data: {
    periode: { debut: string; fin: string; jours: number };
    encaissements: {
      versements_packs:     { montant: number; count: number };
      cotisations_init:     { montant: number; count: number };
      versements_peri:      { montant: number; count: number };
      remboursements:       { montant: number; count: number };
      autres:               { montant: number; count: number };
      caisse_encaissements: { montant: number; count: number };
      ventes_directes:      { montant: number; count: number };
      total: number;
    };
    decaissements: {
      approvisionnements: { montant: number; count: number };
      salaires:           { montant: number; count: number };
      avances:            { montant: number; count: number };
      fournisseurs:       { montant: number; count: number };
      autres_caisse:      { montant: number; count: number };
      total: number;
    };
    resultat_net: number;
    taux_utilisation: number;
    evolution: EvolutionPoint[];
    snapshot: {
      stock:                { valeur: number; nombreProduits: number };
      souscriptionsActives: number;
      packs:                number;
      versementsTotal:      number;
    };
  };
}

export default function TresoreriePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30");

  const { data: synthData } = useApi<SyntheseResponse>(`/api/comptable/synthese?period=${selectedPeriod}`);

  const sd  = synthData?.data;
  const enc = sd?.encaissements;
  const dec = sd?.decaissements;

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="text-violet-600" size={22} /> Trésorerie
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1">
            {(["7", "30", "90", "365"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPeriod === p
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {p === "365" ? "1 an" : `${p}j`}
              </button>
            ))}
          </div>
          {AIDE_COMPTABLE["tresorerie"] && <AideComptable contenu={AIDE_COMPTABLE["tresorerie"]} />}
        </div>
      </div>

      <div className="space-y-5">

        {/* Résumé trésorerie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowUpRight size={24} /></div>
              <div>
                <p className="text-emerald-100 text-xs">Total Encaissements</p>
                <p className="text-2xl font-bold">{formatCurrency(enc?.total ?? 0)}</p>
              </div>
            </div>
            <div className="text-xs text-emerald-100 space-y-0.5">
              <p>Acomptes initiaux : {formatCurrency(enc?.cotisations_init.montant ?? 0)}</p>
              <p>Versements périodiques : {formatCurrency(enc?.versements_peri.montant ?? 0)}</p>
              <p>Remboursements : {formatCurrency(enc?.remboursements.montant ?? 0)}</p>
              <p>Ventes directes : {formatCurrency(enc?.ventes_directes.montant ?? 0)}</p>
              <p>Encaissements caisse : {formatCurrency(enc?.caisse_encaissements.montant ?? 0)}</p>
              <p className="opacity-70">Bonus / Ajustements : {formatCurrency(enc?.autres.montant ?? 0)}</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><ArrowDownRight size={24} /></div>
              <div>
                <p className="text-red-100 text-xs">Total Décaissements</p>
                <p className="text-2xl font-bold">{formatCurrency(dec?.total ?? 0)}</p>
              </div>
            </div>
            <div className="text-xs text-red-100 space-y-0.5">
              <p>Approvisionnements : {formatCurrency(dec?.approvisionnements.montant ?? 0)}</p>
              {(dec?.salaires.montant ?? 0) > 0    && <p>Salaires : {formatCurrency(dec?.salaires.montant ?? 0)}</p>}
              {(dec?.avances.montant ?? 0) > 0     && <p>Avances : {formatCurrency(dec?.avances.montant ?? 0)}</p>}
              {(dec?.fournisseurs.montant ?? 0) > 0 && <p>Fournisseurs : {formatCurrency(dec?.fournisseurs.montant ?? 0)}</p>}
              {(dec?.autres_caisse.montant ?? 0) > 0 && <p className="opacity-70">Autres : {formatCurrency(dec?.autres_caisse.montant ?? 0)}</p>}
            </div>
          </div>

          <div className={`rounded-2xl p-6 text-white shadow-lg ${(sd?.resultat_net ?? 0) >= 0 ? "bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-300" : "bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-200"}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"><Wallet size={24} /></div>
              <div>
                <p className="text-white/80 text-xs">Solde Net de Trésorerie</p>
                <p className="text-2xl font-bold">{(sd?.resultat_net ?? 0) >= 0 ? "+" : ""}{formatCurrency(sd?.resultat_net ?? 0)}</p>
              </div>
            </div>
            <p className="text-xs text-white/70">
              {(sd?.resultat_net ?? 0) >= 0 ? "✓ Trésorerie excédentaire" : "⚠ Trésorerie déficitaire"} sur {selectedPeriod === "365" ? "1 an" : `${selectedPeriod} jours`}
            </p>
            <p className="text-xs text-white/70 mt-1">Taux d&apos;utilisation budget : {sd?.taux_utilisation ?? 0}%</p>
          </div>
        </div>

        {/* Détail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Encaissements par type */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ArrowUpRight size={20} className="text-emerald-600" />Encaissements par type de versement
            </h3>
            {[
              { label: `Acomptes initiaux (${enc?.cotisations_init.count ?? 0})`,          montant: enc?.cotisations_init.montant ?? 0,           icon: Calendar,     color: "bg-blue-100",    text: "text-blue-600",    bar: "bg-blue-500" },
              { label: `Versements périodiques (${enc?.versements_peri.count ?? 0})`,       montant: enc?.versements_peri.montant ?? 0,            icon: TrendingUp,   color: "bg-emerald-100", text: "text-emerald-600", bar: "bg-emerald-500" },
              { label: `Remboursements (${enc?.remboursements.count ?? 0})`,                montant: enc?.remboursements.montant ?? 0,             icon: CheckCircle,  color: "bg-teal-100",    text: "text-teal-600",    bar: "bg-teal-500" },
              { label: `Ventes directes (${enc?.ventes_directes.count ?? 0})`,             montant: enc?.ventes_directes.montant ?? 0,            icon: ShoppingBag,  color: "bg-indigo-100",  text: "text-indigo-600",  bar: "bg-indigo-500" },
              { label: `Bonus / Ajust. (${enc?.autres.count ?? 0})`,                       montant: enc?.autres.montant ?? 0,                    icon: BookOpen,     color: "bg-violet-100",  text: "text-violet-600",  bar: "bg-violet-500" },
              { label: `Encaissements caisse (${enc?.caisse_encaissements.count ?? 0})`,   montant: enc?.caisse_encaissements.montant ?? 0,       icon: Wallet,       color: "bg-cyan-100",    text: "text-cyan-600",    bar: "bg-cyan-500" },
            ].map((item) => {
              const pct  = (enc?.total ?? 0) > 0 ? Math.round((item.montant / (enc?.total ?? 1)) * 100) : 0;
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                  <div className={`${item.color} p-2 rounded-lg`}>
                    <Icon className={`${item.text} w-4 h-4`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600 truncate">{item.label}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full ${item.bar} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                    <p className="text-xs text-slate-400">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Décaissements par destination */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ArrowDownRight size={20} className="text-red-600" />Décaissements par destination
            </h3>
            {[
              { label: `Approvisionnements stock (${dec?.approvisionnements.count ?? 0})`, montant: dec?.approvisionnements.montant ?? 0, icon: Package,        color: "bg-orange-100", text: "text-orange-600", bar: "bg-orange-500" },
              { label: `Salaires (${dec?.salaires.count ?? 0})`,                           montant: dec?.salaires.montant ?? 0,           icon: Users,          color: "bg-red-100",    text: "text-red-600",    bar: "bg-red-500" },
              { label: `Avances (${dec?.avances.count ?? 0})`,                             montant: dec?.avances.montant ?? 0,            icon: ArrowDownRight, color: "bg-rose-100",   text: "text-rose-600",   bar: "bg-rose-500" },
              { label: `Fournisseurs (${dec?.fournisseurs.count ?? 0})`,                   montant: dec?.fournisseurs.montant ?? 0,       icon: Package,        color: "bg-amber-100",  text: "text-amber-600",  bar: "bg-amber-500" },
              { label: `Autres décaissements (${dec?.autres_caisse.count ?? 0})`,          montant: dec?.autres_caisse.montant ?? 0,      icon: Filter,         color: "bg-slate-100",  text: "text-slate-600",  bar: "bg-slate-400" },
            ].filter((item) => item.montant > 0).map((item) => {
              const pct  = (dec?.total ?? 0) > 0 ? Math.round((item.montant / (dec?.total ?? 1)) * 100) : 0;
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                  <div className={`${item.color} p-2 rounded-lg`}>
                    <Icon className={`${item.text} w-4 h-4`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600 truncate">{item.label}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                      <div className={`h-full ${item.bar} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${item.text}`}>{formatCurrency(item.montant)}</p>
                    <p className="text-xs text-slate-400">{pct}%</p>
                  </div>
                </div>
              );
            })}
            {(dec?.total ?? 0) === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Aucun décaissement sur la période</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
