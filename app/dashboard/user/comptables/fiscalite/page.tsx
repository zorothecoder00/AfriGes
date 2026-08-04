"use client";

import { useState } from "react";
import { Percent, ChevronsUpDown, Save } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface DeclarationTVA {
  id: number; periode: string; tvaCollectee: number; tvaDeductible: number;
  tvaDue: number; statut: string; notes: string | null;
  user?: { id: number; nom: string; prenom: string };
}
interface TVAResponse {
  data: DeclarationTVA[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function FiscaliteTvaPage() {
  // ── État TVA ─────────────────────────────────────────────────────────
  const [tvaPage] = useState(1);
  const [tvaPeriode, setTvaPeriode]         = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [tvaCollecteeInput, setTvaCollecteeInput] = useState("");
  const [tvaDeductibleInput, setTvaDeductibleInput] = useState("");
  const [tvaNotes, setTvaNotes]             = useState("");
  const [tvaCalcResult, setTvaCalcResult]   = useState<{ tvaCollectee: number; tvaDeductible: number; tvaDue: number } | null>(null);

  // ── TVA API ───────────────────────────────────────────────────────────
  const { data: tvaData, loading: tvaLoading, refetch: refetchTva } =
    useApi<TVAResponse>(`/api/comptable/tva?page=${tvaPage}&limit=24`);

  const { mutate: calculerTva } = useMutation<{ data: { tvaCollectee: number; tvaDeductible: number; tvaDue: number } }, object>(
    "/api/comptable/tva", "POST"
  );
  const { mutate: enregistrerTva, loading: enregistrantTva } = useMutation<unknown, object>(
    "/api/comptable/tva", "POST",
    { successMessage: "Déclaration TVA enregistrée" }
  );
  const { mutate: validerTva } = useMutation<unknown, object>(
    "/api/comptable/tva", "PATCH",
    { successMessage: "Déclaration validée" }
  );

  async function handleCalculerTva() {
    const res = await calculerTva({ action: "calculer", periode: tvaPeriode }) as { data?: { tvaCollectee: number; tvaDeductible: number; tvaDue: number } } | null;
    if (res?.data) {
      setTvaCalcResult(res.data);
      setTvaCollecteeInput(String(res.data.tvaCollectee));
      setTvaDeductibleInput(String(res.data.tvaDeductible));
    }
  }
  async function handleEnregistrerTva() {
    const res = await enregistrerTva({ periode: tvaPeriode, tvaCollectee: Number(tvaCollecteeInput), tvaDeductible: Number(tvaDeductibleInput), notes: tvaNotes || null });
    if (res) { refetchTva(); setTvaCalcResult(null); setTvaCollecteeInput(""); setTvaDeductibleInput(""); setTvaNotes(""); }
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Percent className="text-violet-600" size={22} /> Fiscalité — TVA
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["tva"] && <AideComptable contenu={AIDE_COMPTABLE["tva"]} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Percent className="text-violet-600" size={20} /> Déclaration TVA — Taux 18% (Togo)
          </h3>

          {/* Formulaire */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-slate-700 text-sm">Nouvelle déclaration</h4>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Période (mois)</label>
                <input type="month" value={tvaPeriode} onChange={(e) => setTvaPeriode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <button onClick={handleCalculerTva}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-semibold hover:bg-indigo-200">
                <ChevronsUpDown size={15} /> Calculer auto depuis les écritures validées
              </button>
              {tvaCalcResult && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-sm space-y-1">
                  <p className="font-semibold text-indigo-800">Résultat du calcul :</p>
                  <p>TVA collectée : <strong>{formatCurrency(tvaCalcResult.tvaCollectee)}</strong></p>
                  <p>TVA déductible : <strong>{formatCurrency(tvaCalcResult.tvaDeductible)}</strong></p>
                  <p className="font-bold text-indigo-900">TVA due : {formatCurrency(tvaCalcResult.tvaDue)}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">TVA collectée (FCFA)</label>
                  <input type="number" min="0" value={tvaCollecteeInput} onChange={(e) => setTvaCollecteeInput(e.target.value)}
                    placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">TVA déductible (FCFA)</label>
                  <input type="number" min="0" value={tvaDeductibleInput} onChange={(e) => setTvaDeductibleInput(e.target.value)}
                    placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
                </div>
              </div>
              {tvaCollecteeInput !== "" && tvaDeductibleInput !== "" && (
                <div className={`rounded-xl p-3 text-sm font-semibold ${Number(tvaCollecteeInput) >= Number(tvaDeductibleInput) ? "bg-emerald-50 text-emerald-800" : "bg-blue-50 text-blue-800"}`}>
                  TVA nette due : {formatCurrency(Math.max(0, Number(tvaCollecteeInput) - Number(tvaDeductibleInput)))}
                  {Number(tvaDeductibleInput) > Number(tvaCollecteeInput) && (
                    <span className="ml-2 text-xs font-normal text-blue-600">(crédit de TVA : {formatCurrency(Number(tvaDeductibleInput) - Number(tvaCollecteeInput))})</span>
                  )}
                </div>
              )}
              <textarea value={tvaNotes} onChange={(e) => setTvaNotes(e.target.value)}
                placeholder="Notes…" rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              <button onClick={handleEnregistrerTva}
                disabled={enregistrantTva || !tvaPeriode || tvaCollecteeInput === "" || tvaDeductibleInput === ""}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {enregistrantTva ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Enregistrer la déclaration
              </button>
            </div>

            {/* Historique TVA */}
            <div>
              <h4 className="font-semibold text-slate-700 text-sm mb-3">Historique des déclarations</h4>
              {tvaLoading ? (
                <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
              ) : (tvaData?.data ?? []).length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-8">Aucune déclaration enregistrée.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {(tvaData?.data ?? []).map((d) => (
                    <div key={d.id} className="border border-slate-100 rounded-xl p-3 hover:border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-800">{d.periode}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.statut === "SOUMIS" ? "bg-emerald-50 text-emerald-700" : d.statut === "EN_ATTENTE" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>{d.statut}</span>
                          {d.statut === "EN_ATTENTE" && (
                            <button onClick={() => validerTva({ id: d.id, statut: "SOUMIS" }).then(() => refetchTva())}
                              className="text-xs px-2 py-0.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700">Valider</button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                        <div><span className="text-slate-400">Collectée</span><br /><strong className="text-red-600">{formatCurrency(Number(d.tvaCollectee))}</strong></div>
                        <div><span className="text-slate-400">Déductible</span><br /><strong className="text-blue-600">{formatCurrency(Number(d.tvaDeductible))}</strong></div>
                        <div><span className="text-slate-400">Nette due</span><br /><strong className="text-emerald-700">{formatCurrency(Number(d.tvaDue))}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
