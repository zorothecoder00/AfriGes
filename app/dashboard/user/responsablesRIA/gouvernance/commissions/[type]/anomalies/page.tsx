"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { useState, useMemo } from "react";
import { RefreshCw, AlertTriangle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

// Captured at module load — not during render, so no purity violation
const TODAY_MS = Date.now();

interface Financement {
  id: number; reference: string; montantFinance: number; statut: string;
  dateEcheance: string | null; montantRembourse: number; taux?: number;
  client: { nom: string; prenom: string; commune?: string | null };
  portefeuille: { reference: string; profilRIA: { gestionnaire: { member: { nom: string; prenom: string } } } };
}
interface FResponse { data: Financement[] }

type AnomalieType = "EN_RETARD" | "TAUX_ELEVE" | "FAIBLE_RECOUVREMENT";

interface Anomalie {
  id: string; type: AnomalieType; severite: "CRITIQUE" | "HAUTE" | "MOYENNE";
  description: string; client: string; investisseur: string;
  montant: number; ref: string;
}

const SEV_STYLE: Record<string, string> = {
  CRITIQUE: "bg-rose-50 border-rose-200 text-rose-700",
  HAUTE:    "bg-orange-50 border-orange-200 text-orange-700",
  MOYENNE:  "bg-yellow-50 border-yellow-200 text-yellow-700",
};

const toNum = (v: unknown) => Number(v ?? 0);

export default function AnomaliesPage() {
  const { type } = useParams() as { type: string };
  const [refresh, setRefresh] = useState(0);
  const { data, loading } = useApi<FResponse>(`/api/admin/ria/financements?limit=100&_r=${refresh}`);

  const anomalies = useMemo<Anomalie[]>(() => {
    const result: Anomalie[] = [];
    (data?.data ?? []).forEach(f => {
      const montant = toNum(f.montantFinance);
      const remb    = toNum(f.montantRembourse);
      const taux    = toNum(f.taux);
      const pct     = montant > 0 ? remb / montant * 100 : 100;
      const client  = `${f.client.prenom} ${f.client.nom}`;
      const inv     = `${f.portefeuille.profilRIA.gestionnaire.member.prenom} ${f.portefeuille.profilRIA.gestionnaire.member.nom}`;

      if (f.statut === "EN_RETARD") {
        const jours = f.dateEcheance
          ? Math.floor((TODAY_MS - new Date(f.dateEcheance).getTime()) / 86_400_000)
          : 0;
        result.push({
          id: `ret-${f.id}`, type: "EN_RETARD",
          severite: jours > 90 ? "CRITIQUE" : jours > 30 ? "HAUTE" : "MOYENNE",
          description: `Financement en retard de ${jours} jour(s)`,
          client, investisseur: inv, montant: montant - remb, ref: f.reference,
        });
      }
      if (taux > 25) {
        result.push({
          id: `taux-${f.id}`, type: "TAUX_ELEVE",
          severite: taux > 40 ? "CRITIQUE" : taux > 30 ? "HAUTE" : "MOYENNE",
          description: `Taux d'intérêt anormalement élevé : ${taux}%`,
          client, investisseur: inv, montant, ref: f.reference,
        });
      }
      if (pct < 20 && f.statut === "ACTIF" && montant > 0) {
        result.push({
          id: `low-${f.id}`, type: "FAIBLE_RECOUVREMENT",
          severite: "HAUTE",
          description: `Faible recouvrement : ${pct.toFixed(0)}% seulement remboursé`,
          client, investisseur: inv, montant: montant - remb, ref: f.reference,
        });
      }
    });
    return result;
  }, [data]);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const critiques = anomalies.filter(a => a.severite === "CRITIQUE").length;
  const hautes    = anomalies.filter(a => a.severite === "HAUTE").length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Gestion des Anomalies</h1>
          <p className="text-sm text-slate-500">Détection automatique des irrégularités dans les financements</p>
        </div>
        <button onClick={() => setRefresh(r => r + 1)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`border rounded-xl p-4 text-center ${critiques > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}>
          <ShieldAlert className={`w-5 h-5 mx-auto mb-1 ${critiques > 0 ? "text-rose-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${critiques > 0 ? "text-rose-700" : "text-slate-400"}`}>{critiques}</p>
          <p className="text-xs text-slate-500">Anomalies critiques</p>
        </div>
        <div className={`border rounded-xl p-4 text-center ${hautes > 0 ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200"}`}>
          <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${hautes > 0 ? "text-orange-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${hautes > 0 ? "text-orange-700" : "text-slate-400"}`}>{hautes}</p>
          <p className="text-xs text-slate-500">Hautes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <CheckCircle2 className={`w-5 h-5 mx-auto mb-1 ${anomalies.length === 0 ? "text-emerald-500" : "text-slate-300"}`} />
          <p className={`text-2xl font-bold ${anomalies.length === 0 ? "text-emerald-600" : "text-slate-800"}`}>{anomalies.length}</p>
          <p className="text-xs text-slate-500">Total anomalies</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          <p className="text-slate-600 font-medium">Aucune anomalie détectée</p>
          <p className="text-slate-400 text-sm">Tous les financements sont conformes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...anomalies].sort((a, b) => {
            const order: Record<string, number> = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2 };
            return order[a.severite] - order[b.severite];
          }).map(a => (
            <div key={a.id} className={`border rounded-xl p-4 ${SEV_STYLE[a.severite]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">{a.description}</p>
                    <p className="text-xs mt-0.5">Client : {a.client} · Investisseur : {a.investisseur}</p>
                    <p className="text-xs font-mono mt-0.5">Réf. {a.ref} · Impact : {formatCurrency(a.montant)}</p>
                  </div>
                </div>
                <span className="text-xs font-bold flex-shrink-0 border border-current rounded px-1.5 py-0.5">
                  {a.severite}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
