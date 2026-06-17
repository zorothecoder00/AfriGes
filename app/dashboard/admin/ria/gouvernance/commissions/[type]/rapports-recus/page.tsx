"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import Link from "next/link";
import { RefreshCw, Inbox, Search } from "lucide-react";

interface Rapport {
  id: number; titre: string; type: string; typeCommission: string; statut: string;
  periode: string | null; createdAt: string;
  redacteur: { nom: string; prenom: string } | null;
  _count: { analysesOptimisation: number };
}
interface Data { rapports: Rapport[] }

const COMM_LABELS: Record<string, string> = {
  FINANCE: "Finance", AUDIT: "Audit & Contrôle", OPERATIONS_TERRAIN: "Opérations Terrain",
};
const COMM_STYLE: Record<string, string> = {
  FINANCE: "bg-blue-50 text-blue-700", AUDIT: "bg-amber-50 text-amber-700", OPERATIONS_TERRAIN: "bg-emerald-50 text-emerald-700",
};

export default function RapportsRecusPage() {
  const { type } = useParams() as { type: string };
  const { data, loading, refetch } = useApi<Data>("/api/admin/ria/commissions/gouvernance/optimisation-flux");

  if (type !== "optimisation") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Optimisation.</div>
  );

  const analysesBase = `/dashboard/admin/ria/gouvernance/commissions/${type}/analyses`;
  const rapports = data?.rapports ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Inbox className="w-5 h-5 text-violet-600" /> Rapports reçus</h1>
          <p className="text-sm text-slate-500">Reçu automatiquement : rapports Finance, Audit et Terrain</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rapports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun rapport reçu pour l&apos;instant</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rapports.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COMM_STYLE[r.typeCommission]}`}>{COMM_LABELS[r.typeCommission] ?? r.typeCommission}</span>
                  <span className="text-xs text-slate-400">{r.periode ?? new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="text-sm text-slate-700">{r.titre}</p>
                {r.redacteur && <p className="text-xs text-slate-400">{r.redacteur.prenom} {r.redacteur.nom}</p>}
              </div>
              <Link href={`${analysesBase}?rapportId=${r.id}`}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 shrink-0">
                {r._count.analysesOptimisation > 0 ? `${r._count.analysesOptimisation} analyse(s)` : "Analyser ce rapport"}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
