"use client";

import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Plus, Loader2, Power, ChevronDown, ChevronUp } from "lucide-react";
import NouvelleRegleAutomatisationModal, { DECLENCHEUR_LABEL, ACTION_LABEL } from "@/components/marketing/NouvelleRegleAutomatisationModal";
import WorkflowVisuel from "@/components/marketing/WorkflowVisuel";

interface Etape { id: number; ordre: number; delaiJours: number; action: string; arreterSiAchatEntreTemps: boolean }
interface Regle {
  id: number; nom: string; description: string | null; actif: boolean; declencheur: string;
  etapes: Etape[]; creePar: { nom: string; prenom: string }; _count: { executions: number }; nbEnCours: number;
}
interface LogItem { id: number; statut: string; detail: string | null; dateExecution: string; etape: { ordre: number; action: string } }
interface ExecutionItem {
  id: number; statut: string; etapeCouranteOrdre: number; dateInscription: string; dateFin: string | null;
  client: { id: number; nom: string; prenom: string }; logs: LogItem[];
}

const EXEC_STATUT_STYLE: Record<string, string> = {
  EN_COURS: "bg-blue-100 text-blue-700", TERMINEE: "bg-emerald-100 text-emerald-700", ARRETEE: "bg-slate-100 text-slate-500",
};

function DetailRegle({ regleId }: { regleId: number }) {
  const { data: res, loading } = useApi<{ data: ExecutionItem[] }>(`/api/admin/marketing/regles/${regleId}/executions`);
  if (loading && !res) return <div className="flex justify-center py-6 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  const executions = res?.data ?? [];
  if (executions.length === 0) return <p className="text-xs text-slate-400 py-4 text-center">Aucun client inscrit pour l&apos;instant.</p>;
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {executions.map((ex) => (
        <div key={ex.id} className="bg-white rounded-lg border border-slate-100 p-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">{ex.client.prenom} {ex.client.nom} · étape {ex.etapeCouranteOrdre}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${EXEC_STATUT_STYLE[ex.statut]}`}>{ex.statut}</span>
          </div>
          <p className="text-[10px] text-slate-400">Inscrit le {formatDate(ex.dateInscription)}{ex.dateFin ? ` · terminé le ${formatDate(ex.dateFin)}` : ""}</p>
          {ex.logs.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {ex.logs.slice(0, 5).map((l) => (
                <li key={l.id} className="text-[10px] text-slate-500">
                  Étape {l.etape.ordre} ({ACTION_LABEL[l.etape.action] ?? l.etape.action}) — <span className={l.statut === "ECHEC" ? "text-red-500" : "text-slate-500"}>{l.statut}</span>
                  {l.detail ? ` · ${l.detail}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** Liste des règles d'automatisation (CDC §16-20) — création + suivi des exécutions/logs. Partagée admin/portail. */
export default function ListeAutomatisation() {
  const { data: res, loading, refetch } = useApi<{ data: Regle[] }>("/api/admin/marketing/regles");
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [vueDetail, setVueDetail] = useState<"workflow" | "executions">("workflow");
  const toggleIdRef = useRef<number | null>(null);
  const { mutate: toggler, loading: togglant } = useMutation<unknown, { actif: boolean }>(
    () => `/api/admin/marketing/regles/${toggleIdRef.current}`, "PATCH",
    { invalidate: "/api/admin/marketing/regles" }
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:bg-fuchsia-700">
          <Plus size={16} /> Nouvelle règle
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (res?.data ?? []).length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune règle d&apos;automatisation pour l&apos;instant</p>
        ) : res!.data.map((r) => (
          <div key={r.id}>
            <button onClick={() => setOuvert(ouvert === r.id ? null : r.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">{r.nom}</p>
                <p className="text-xs text-slate-400">{DECLENCHEUR_LABEL[r.declencheur] ?? r.declencheur} · {r.etapes.length} étape(s) · {r.nbEnCours} client(s) en cours ({r._count.executions} au total)</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.actif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{r.actif ? "Active" : "Inactive"}</span>
                <button
                  onClick={async (e) => { e.stopPropagation(); toggleIdRef.current = r.id; await toggler({ actif: !r.actif }); }}
                  disabled={togglant} title={r.actif ? "Désactiver" : "Activer"}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
                  <Power className="w-3.5 h-3.5" />
                </button>
                {ouvert === r.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === r.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit mb-3">
                  <button onClick={() => setVueDetail("workflow")} className={`px-3 py-1 text-[11px] font-semibold rounded-md ${vueDetail === "workflow" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Workflow</button>
                  <button onClick={() => setVueDetail("executions")} className={`px-3 py-1 text-[11px] font-semibold rounded-md ${vueDetail === "executions" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Exécutions</button>
                </div>
                {vueDetail === "workflow"
                  ? <WorkflowVisuel declencheur={r.declencheur} etapes={r.etapes} />
                  : <DetailRegle regleId={r.id} />}
              </div>
            )}
          </div>
        ))}
      </div>
      {modalOpen && <NouvelleRegleAutomatisationModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); refetch(); }} />}
    </div>
  );
}
