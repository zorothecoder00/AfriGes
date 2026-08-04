"use client";

// Inventaire & clôture — Exercices & clôture.
// Extrait du bloc activeTab === "exercices" du monolithe (app/dashboard/user/comptables/page.tsx) :
// UNIQUEMENT la partie "Exercices comptables" + l'assistant de clôture (CDC §30).
// Les sections Journaux, Taxes paramétrables et Écritures récurrentes du même ancien
// bloc sont gérées ailleurs (Journaux a déjà sa propre route ; Taxes/Récurrentes sont
// extraites par d'autres agents en parallèle) — volontairement non dupliquées ici.
import { useRef, useState } from "react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { Lock, PlusCircle, ListChecks, X, CheckCircle, AlertCircle } from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface ExerciceEntry {
  id: number; annee: number; dateDebut: string; dateFin: string; statut: string; dateCloture: string | null;
}
const STATUT_EXERCICE_COLORS: Record<string, string> = {
  PREPARATION: "bg-slate-100 text-slate-600", OUVERT: "bg-emerald-50 text-emerald-700",
  EN_CLOTURE: "bg-amber-50 text-amber-700", CLOTURE: "bg-red-50 text-red-600", ARCHIVE: "bg-slate-100 text-slate-500",
};

export default function ExercicesPage() {
  const [nouvelExerciceAnnee, setNouvelExerciceAnnee] = useState(() => String(new Date().getFullYear()));

  const { data: exercicesData, refetch: refetchExercices } =
    useApi<{ data: ExerciceEntry[] }>("/api/comptable/exercices");
  const { mutate: ouvrirExerciceApi, loading: ouvrantExercice } = useMutation<unknown, object>(
    "/api/comptable/exercices", "POST", { successMessage: "Exercice ouvert" }
  );
  const exerciceActionIdRef = useRef<number | null>(null);
  const { mutate: cloturerExerciceApi, loading: cloturantExercice } = useMutation<{ error?: string; controles?: string[] }, object>(
    () => `/api/comptable/exercices/${exerciceActionIdRef.current}/cloturer`, "POST",
  );
  async function handleOuvrirExercice() {
    const res = await ouvrirExerciceApi({ annee: Number(nouvelExerciceAnnee) });
    if (res) refetchExercices();
  }

  // ── Assistant de clôture (CDC §30) ───────────────────────────────────────
  const [assistantClotureId, setAssistantClotureId] = useState<number | null>(null);
  const { data: preClotureData, loading: preClotureLoading } = useApi<{ data: {
    items: { cle: string; label: string; ok: boolean; bloquant: boolean; detail: string }[];
    peutCloturer: boolean;
    resultatNetPrevisionnel: number;
  } }>(assistantClotureId ? `/api/comptable/exercices/${assistantClotureId}/pre-cloture` : null);

  function handleCloturerExercice(id: number) {
    exerciceActionIdRef.current = id;
    setAssistantClotureId(id);
  }
  async function handleConfirmerCloture() {
    const res = await cloturerExerciceApi({});
    if (res) { setAssistantClotureId(null); refetchExercices(); }
  }

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Lock className="text-emerald-600" size={22} /> Exercices & clôture
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">Ouverture/clôture d&apos;exercice comptable avec report à nouveau automatique des soldes.</p>
        </div>
        {AIDE_COMPTABLE.exercices && <AideComptable contenu={AIDE_COMPTABLE.exercices} />}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Lock className="text-emerald-600" size={20} /> Exercices comptables</h3>
          <div className="flex items-center gap-2">
            <input type="number" value={nouvelExerciceAnnee} onChange={(e) => setNouvelExerciceAnnee(e.target.value)}
              className="w-24 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 [appearance:textfield]" />
            <button onClick={handleOuvrirExercice} disabled={ouvrantExercice}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              <PlusCircle size={15} /> Ouvrir l&apos;exercice
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {(exercicesData?.data ?? []).map((ex) => (
            <div key={ex.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800">{ex.annee}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUT_EXERCICE_COLORS[ex.statut] ?? "bg-slate-100"}`}>{ex.statut}</span>
                {ex.dateCloture && <span className="text-xs text-slate-400">Clôturé le {formatDateShort(ex.dateCloture)}</span>}
              </div>
              {ex.statut !== "CLOTURE" && (
                <button onClick={() => handleCloturerExercice(ex.id)} disabled={cloturantExercice}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                  <Lock size={13} /> Clôturer définitivement
                </button>
              )}
            </div>
          ))}
          {(exercicesData?.data ?? []).length === 0 && <p className="text-center text-slate-400 text-sm py-6">Aucun exercice ouvert.</p>}
        </div>
      </div>

      {assistantClotureId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ListChecks size={18} className="text-emerald-600" /> Assistant de clôture
              </h3>
              <button onClick={() => setAssistantClotureId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Vérifications avant clôture définitive (CDC §30) — n&apos;altère rien tant que vous ne confirmez pas.
            </p>

            {preClotureLoading ? (
              <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
            ) : preClotureData ? (
              <>
                <div className="space-y-2 mb-4">
                  {preClotureData.data.items.map((item) => (
                    <div key={item.cle} className={`flex items-start gap-3 p-2.5 rounded-xl border ${
                      item.ok ? "border-emerald-200 bg-emerald-50/30" : item.bloquant ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/30"
                    }`}>
                      {item.ok
                        ? <CheckCircle size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <AlertCircle size={16} className={`flex-shrink-0 mt-0.5 ${item.bloquant ? "text-red-500" : "text-amber-500"}`} />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          {item.label} {!item.ok && item.bloquant && <span className="text-xs text-red-600 font-semibold ml-1">(bloquant)</span>}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-4">
                  <span className="text-sm text-slate-600">Résultat prévisionnel</span>
                  <span className={`font-bold ${preClotureData.data.resultatNetPrevisionnel >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(preClotureData.data.resultatNetPrevisionnel)}
                  </span>
                </div>
                {!preClotureData.data.peutCloturer && (
                  <p className="text-xs text-red-600 mb-3">Des anomalies bloquantes doivent être résolues avant de pouvoir clôturer.</p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setAssistantClotureId(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-medium">
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmerCloture}
                    disabled={!preClotureData.data.peutCloturer || cloturantExercice}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {cloturantExercice ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Lock size={15} />}
                    Confirmer la clôture
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
