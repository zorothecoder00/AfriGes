"use client";

import { useState, type ReactNode } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import {
  Bell, AlertOctagon, AlertTriangle, Info, Send, CheckCircle2,
} from "lucide-react";
import PopcTabs from "../PopcTabs";

type Severite = "URGENT" | "HAUTE" | "NORMAL";
interface Alerte {
  code: string; severite: Severite; categorie: string; titre: string; message: string;
  cible?: { type: string; id: number; nom: string };
}
interface AlertesResp { data: Alerte[]; meta: { total: number } }

const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const STYLE: Record<Severite, { bg: string; border: string; text: string; icon: ReactNode; label: string }> = {
  URGENT: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: <AlertOctagon className="w-5 h-5" />, label: "Urgent" },
  HAUTE: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: <AlertTriangle className="w-5 h-5" />, label: "Haute" },
  NORMAL: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: <Info className="w-5 h-5" />, label: "Normale" },
};

export default function AlertesPage() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);
  const { data, loading, refetch } = useApi<AlertesResp>(
    `/api/popc/alertes?annee=${annee}&mois=${mois}`,
    undefined,
    { refreshInterval: 120000 },
  );

  const notifier = useMutation<{ envoyees: number }, { annee: number; mois: number }>(
    "/api/popc/alertes/notifier", "POST",
    { successMessage: "Alertes diffusées par notification" },
  );

  const alertes = data?.data ?? [];
  const compte = (s: Severite) => alertes.filter((a) => a.severite === s).length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PopcTabs />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" /> Alertes automatiques
          </h1>
          <p className="text-sm text-gray-500 mt-1">Risques détectés — {MOIS[mois - 1]} {annee} (§12)</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={mois} onChange={(e) => setMois(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white">
            {MOIS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <input type="number" value={annee} onChange={(e) => setAnnee(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
          <button
            onClick={async () => { const r = await notifier.mutate({ annee, mois }); if (r) refetch(); }}
            disabled={notifier.loading || alertes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl disabled:opacity-50">
            <Send className="w-4 h-4" /> {notifier.loading ? "Envoi…" : "Diffuser"}
          </button>
        </div>
      </div>

      {/* Compteurs par sévérité */}
      <div className="grid grid-cols-3 gap-3">
        {(["URGENT", "HAUTE", "NORMAL"] as Severite[]).map((s) => (
          <div key={s} className={`rounded-2xl p-4 border ${STYLE[s].bg} ${STYLE[s].border}`}>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${STYLE[s].text}`}>{STYLE[s].icon}{STYLE[s].label}</div>
            <div className={`text-2xl font-bold mt-1 ${STYLE[s].text}`}>{compte(s)}</div>
          </div>
        ))}
      </div>

      {/* Liste des alertes */}
      {loading ? (
        <p className="text-sm text-gray-400 px-1">Chargement…</p>
      ) : alertes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
          <p className="text-gray-700 font-medium">Aucune alerte pour ce mois</p>
          <p className="text-sm text-gray-400 mt-1">Les objectifs sont sur la bonne trajectoire (ou le paramétrage n&apos;est pas encore généré).</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertes.map((a, i) => {
            const st = STYLE[a.severite];
            return (
              <div key={`${a.code}-${i}`} className={`rounded-2xl border p-4 ${st.bg} ${st.border} flex gap-3`}>
                <div className={st.text}>{st.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white ${st.text}`}>{a.categorie}</span>
                    <h3 className="font-semibold text-gray-800">{a.titre}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{a.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">
        « Diffuser » envoie chaque alerte en notification à la Direction, la Comptabilité et les responsables ; les alertes de performance sont aussi envoyées au commercial concerné. Un cron quotidien (9h) les diffuse automatiquement.
      </p>
    </div>
  );
}
