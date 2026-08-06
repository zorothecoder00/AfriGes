"use client";

import { useRef } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { Loader2, CheckSquare, Square, ClipboardList } from "lucide-react";

interface Tache {
  id: number; titre: string; description: string | null; statut: string; dateEcheance: string | null;
  client: { id: number; nom: string; prenom: string } | null;
}

/** Widget "Mes tâches marketing" (action CREER_TACHE, CDC §19) — liste simple, pas de kanban. */
export default function MesTachesMarketing() {
  const { data: res, loading, refetch } = useApi<{ data: Tache[] }>("/api/admin/marketing/taches");
  const idRef = useRef<number | null>(null);
  const { mutate: majStatut, loading: enCours } = useMutation<unknown, { statut: string }>(
    () => `/api/admin/marketing/taches/${idRef.current}`, "PATCH",
    { invalidate: "/api/admin/marketing/taches" }
  );

  const taches = res?.data ?? [];
  const aFaire = taches.filter((t) => t.statut === "A_FAIRE");
  const terminees = taches.filter((t) => t.statut === "TERMINEE");

  if (loading && !res) return <div className="flex justify-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-fuchsia-600" />
        <h3 className="text-sm font-bold text-slate-800">Mes tâches marketing</h3>
      </div>
      {taches.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Aucune tâche assignée pour l&apos;instant.</p>
      ) : (
        <div className="space-y-1.5">
          {[...aFaire, ...terminees.slice(0, 5)].map((t) => (
            <div key={t.id} className="flex items-start gap-2 py-1.5 border-b border-slate-50 last:border-0">
              <button
                onClick={async () => { idRef.current = t.id; await majStatut({ statut: t.statut === "A_FAIRE" ? "TERMINEE" : "A_FAIRE" }); refetch(); }}
                disabled={enCours} className="mt-0.5 text-slate-400 hover:text-fuchsia-600 disabled:opacity-50 shrink-0">
                {t.statut === "TERMINEE" ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
              </button>
              <div className="min-w-0">
                <p className={`text-sm ${t.statut === "TERMINEE" ? "line-through text-slate-400" : "text-slate-700"}`}>{t.titre}</p>
                <p className="text-[11px] text-slate-400">
                  {t.client ? `${t.client.prenom} ${t.client.nom}` : ""}
                  {t.dateEcheance ? ` · échéance ${formatDate(t.dateEcheance)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
