"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { ChevronLeft, History, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";

interface EchangeRow {
  id: number; commission: string; type: string; contenu: string; createdAt: string;
  auteur: { id: number; nom: string; prenom: string };
  dossier: { id: number; reference: string; titre: string; statut: string; commissionEmettrice: string; commissionReceptrice: string };
}
interface Data { data: EchangeRow[]; meta: { page: number; totalPages: number; total: number } }

const COMM_LABELS: Record<string, string> = {
  FINANCE: "Finance", OPERATIONS_TERRAIN: "Opérations", AUDIT: "Audit & Contrôle", OPTIMISATION: "Optimisation",
};
const TYPE_LABELS: Record<string, string> = {
  OBSERVATION: "Observation", DEMANDE_AJUSTEMENT: "Demande d'ajustement",
  VALIDATION: "Validation", REJET: "Rejet", INFORMATION: "Information", RETOUR_DOSSIER: "Retour dossier",
};

export default function HistoriqueEchangesPage() {
  const router = useRouter();
  const [commission, setCommission] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (commission) params.set("commission", commission);
  if (type) params.set("type", type);
  params.set("page", String(page));
  const { data, loading } = useApi<Data>(`/api/membreCommission/dossiers/echanges?${params.toString()}`);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button onClick={() => router.push("/dashboard/user/responsablesRIA/gouvernance/dossiers")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Retour aux dossiers
      </button>

      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-violet-600" /> Historique des échanges inter-commissions
        </h1>
        <p className="text-sm text-slate-500">Échanges des commissions dont vous êtes membre</p>
      </div>

      <div className="flex gap-3">
        <select value={commission} onChange={e => { setCommission(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Toutes mes commissions</option>
          {Object.entries(COMM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">Tous types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(data?.data ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucun échange trouvé</p>
            </div>
          ) : data!.data.map(e => (
            <a key={e.id} href={`/dashboard/user/responsablesRIA/gouvernance/dossiers/${e.dossier.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-violet-200 transition-colors">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-medium text-slate-600">
                  {e.auteur.prenom} {e.auteur.nom} · {COMM_LABELS[e.commission] || e.commission} · {TYPE_LABELS[e.type] || e.type}
                </span>
                <span>{new Date(e.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm text-slate-700 mb-1.5">{e.contenu}</p>
              <span className="text-xs font-mono text-violet-500">{e.dossier.reference} — {e.dossier.titre}</span>
            </a>
          ))}
        </div>
      )}

      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Préc.</button>
          <span className="text-xs text-slate-500">Page {data.meta.page} / {data.meta.totalPages}</span>
          <button disabled={page >= data.meta.totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40">Suiv.</button>
        </div>
      )}
    </div>
  );
}
