"use client";

import { useRef } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import { Loader2, Wallet } from "lucide-react";

/** Budgets marketing (CDC §52-54) — workflow Prévu→Approuvé→Engagé→Dépense. */

interface CampagneItem {
  id: number; code: string; nom: string;
  budget: { id: number; montantPrevu: number | string; montantApprouve: number | string; montantEngage: number | string; statut: string } | null;
}

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", DEMANDE: "En attente", APPROUVE: "Approuvé", REJETE: "Rejeté" };
const STATUT_STYLE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-500", DEMANDE: "bg-amber-100 text-amber-700",
  APPROUVE: "bg-emerald-100 text-emerald-700", REJETE: "bg-rose-100 text-rose-600",
};

export default function BudgetsMarketing() {
  const { data: res, loading, refetch } = useApi<{ data: CampagneItem[] }>("/api/admin/marketing/campagnes");
  const budgetIdRef = useRef<number | null>(null);
  const { mutate: agirBudget } = useMutation<unknown, { action: string }>(
    () => `/api/admin/marketing/budgets/${budgetIdRef.current}/action`, "POST",
    { invalidate: "/api/admin/marketing/campagnes" }
  );
  const avecBudget = (res?.data ?? []).filter((c) => c.budget);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-fuchsia-600" /> Budgets</h2>
      <p className="text-sm text-slate-400">Prévu → Approuvé → Engagé → Dépense (CDC §52-54).</p>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading && !res ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : avecBudget.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun budget pour l&apos;instant</p>
        ) : avecBudget.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{c.nom}</p>
              <p className="text-xs text-slate-400">
                Prévu {formatCurrency(Number(c.budget!.montantPrevu))} · Approuvé {formatCurrency(Number(c.budget!.montantApprouve))} · Engagé {formatCurrency(Number(c.budget!.montantEngage))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[c.budget!.statut] ?? ""}`}>{STATUT_LABEL[c.budget!.statut] ?? c.budget!.statut}</span>
              {c.budget!.statut === "BROUILLON" && (
                <button onClick={async () => { budgetIdRef.current = c.budget!.id; if (await agirBudget({ action: "DEMANDER" })) refetch(); }}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Demander validation</button>
              )}
              {c.budget!.statut === "DEMANDE" && (
                <>
                  <button onClick={async () => { budgetIdRef.current = c.budget!.id; if (await agirBudget({ action: "APPROUVER" })) refetch(); }}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">Approuver</button>
                  <button onClick={async () => { budgetIdRef.current = c.budget!.id; if (await agirBudget({ action: "REJETER" })) refetch(); }}
                    className="px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-semibold hover:bg-rose-600">Rejeter</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
