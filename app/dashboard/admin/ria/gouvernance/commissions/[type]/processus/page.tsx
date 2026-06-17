"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState } from "react";
import { RefreshCw, GitBranch, ArrowRight, Clock } from "lucide-react";

interface KPIs {
  tauxRemboursement: number; rendementMoyen: number; scoreGlobalSante: number;
  nbClientsFinances: number; capitalInvesti: number;
}

const PROCESSUS = [
  {
    id: "depot",
    label: "Dépôt investisseur",
    etapes: ["Soumission dépôt", "Validation admin", "Mise à jour portefeuille", "Notification"],
    dureeEstimee: "1–2 jours",
  },
  {
    id: "affectation",
    label: "Affectation client",
    etapes: ["Identification client", "Vérification éligibilité", "Création affectation", "Activation"],
    dureeEstimee: "2–3 jours",
  },
  {
    id: "financement",
    label: "Financement client",
    etapes: ["Demande financement", "Analyse risque", "Approbation commission", "Décaissement", "Suivi remboursement"],
    dureeEstimee: "3–7 jours",
  },
  {
    id: "recouvrement",
    label: "Recouvrement",
    etapes: ["Détection retard", "Relance client", "Negociation plan", "Clôture ou contentieux"],
    dureeEstimee: "7–30 jours",
  },
  {
    id: "distribution",
    label: "Distribution bénéfices",
    etapes: ["Calcul bénéfices", "Validation commission", "Distribution portefeuilles", "Réinvestissement partiel"],
    dureeEstimee: "Mensuel",
  },
];

export default function ProcessusPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data: res } = useApi<{ data: KPIs }>(`/api/admin/ria/dashboard?_r=${refresh}`);
  const data = res?.data;

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Cartographie des Processus</h1>
          <p className="text-sm text-slate-500">Vue des processus opérationnels RIA et de leurs étapes</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-violet-700">{data.scoreGlobalSante ?? 0}/100</p>
            <p className="text-xs text-slate-500">Score santé global</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-blue-700">{(data.tauxRemboursement ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Taux remboursement</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-emerald-700">{(data.rendementMoyen ?? 0).toFixed(1)}%</p>
            <p className="text-xs text-slate-500">Rendement moyen</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {PROCESSUS.map(p => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet-500" />
                <h2 className="font-semibold text-slate-800">{p.label}</h2>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5" /> {p.dureeEstimee}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {p.etapes.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-violet-800 whitespace-nowrap">{e}</span>
                  </div>
                  {i < p.etapes.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
