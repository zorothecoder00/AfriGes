"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Users, Search, PlusCircle, Download, X, BadgeCheck, FileText } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { exportToXlsx } from "@/lib/exportXlsx";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

// ── Types ──────────────────────────────────────────────────────────────────

interface AuxiliaireEntry {
  id: number;
  nom: string;
  prenom?: string;
  code?: string | null;
  codeClient?: string | null;
  compteAuxiliaire: { id: number; numero: string } | null;
}

interface BalanceAgeeEntry {
  tiersId: number;
  tiersNom: string;
  compteNumero: string;
  tranche0_30: number;
  tranche31_60: number;
  tranche61_90: number;
  tranche90Plus: number;
  total: number;
}

interface LigneNonLettreeEntry {
  id: number;
  debit: number;
  credit: number;
  libelle: string;
  lettrage: string | null;
  ecriture: { reference: string; date: string; statut: string; libelle: string };
}

interface LettrageResponse {
  data: {
    lignes: LigneNonLettreeEntry[];
    propositions: { ligneIds: number[]; montant: number }[];
  };
}

export default function AuxiliairePage() {
  // ── État Auxiliaire & Lettrage ────────────────────────────────────────
  const [auxType, setAuxType]                     = useState<"CLIENT" | "FOURNISSEUR">("CLIENT");
  const [auxSearch, setAuxSearch]                 = useState("");
  const [auxSelectedCompte, setAuxSelectedCompte] = useState<{ id: number; numero: string; nom: string } | null>(null);
  const [lettrageSelection, setLettrageSelection] = useState<number[]>([]);

  // ── Auxiliaire & Lettrage API ─────────────────────────────────────────
  const auxUrl = useMemo(() => {
    const p = new URLSearchParams({ type: auxType });
    if (auxSearch) p.set("search", auxSearch);
    return `/api/comptable/auxiliaires?${p.toString()}`;
  }, [auxType, auxSearch]);
  const { data: auxData, loading: auxLoading, refetch: refetchAux } =
    useApi<{ data: AuxiliaireEntry[] }>(auxUrl);

  // ── Balance âgée (CDC §16-17) ────────────────────────────────────────────
  const { data: balanceAgeeData, loading: balanceAgeeLoading } = useApi<{
    data: BalanceAgeeEntry[];
    totaux: { tranche0_30: number; tranche31_60: number; tranche61_90: number; tranche90Plus: number; total: number };
  }>(`/api/comptable/balance-agee?type=${auxType}`);

  const { mutate: creerCompteAux, loading: creatingCompteAux } = useMutation<{ data: { id: number; numero: string } }, object>(
    "/api/comptable/auxiliaires", "POST",
  );

  async function handleCreerCompteAux(entry: AuxiliaireEntry) {
    const res = await creerCompteAux({ type: auxType, id: entry.id });
    if (res) {
      refetchAux();
      setAuxSelectedCompte({
        id: res.data.id,
        numero: res.data.numero,
        nom: auxType === "FOURNISSEUR" ? entry.nom : `${entry.prenom ?? ""} ${entry.nom}`.trim(),
      });
    }
  }

  const { data: lettrageData, loading: lettrageLoading, refetch: refetchLettrage } =
    useApi<LettrageResponse>(auxSelectedCompte ? `/api/comptable/lettrage?compteId=${auxSelectedCompte.id}` : null);

  const { mutate: appliquerLettrageApi, loading: applyingLettrage } = useMutation<{ data: { code: string } }, object>(
    "/api/comptable/lettrage", "POST",
    { successMessage: "Lignes lettrées" }
  );
  const lettrageCodeRef = useRef<string>("");
  const { mutate: delettrerApi } = useMutation<unknown, object>(
    () => `/api/comptable/lettrage/${lettrageCodeRef.current}`, "DELETE",
    { successMessage: "Lettrage retiré" }
  );

  function toggleLigneSelection(id: number) {
    setLettrageSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  async function handleAppliquerLettrage(ligneIds: number[]) {
    const res = await appliquerLettrageApi({ ligneIds });
    if (res) { refetchLettrage(); setLettrageSelection([]); }
  }
  async function handleDelettrer(code: string) {
    lettrageCodeRef.current = code;
    const res = await delettrerApi({});
    if (res) refetchLettrage();
  }

  return (
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-violet-600" size={22} /> Comptabilité auxiliaire
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["auxiliaire"] && <AideComptable contenu={AIDE_COMPTABLE["auxiliaire"]} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
            <Users className="text-violet-600" size={20} /> Comptabilité auxiliaire
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Chaque client/fournisseur peut avoir son propre sous-compte (411xxx/401xxx), créé automatiquement.
            Sélectionnez-en un pour lettrer ses lignes non rapprochées.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setAuxType("CLIENT"); setAuxSelectedCompte(null); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${auxType === "CLIENT" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              Clients
            </button>
            <button onClick={() => { setAuxType("FOURNISSEUR"); setAuxSelectedCompte(null); }}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${auxType === "FOURNISSEUR" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              Fournisseurs
            </button>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={auxSearch} onChange={(e) => setAuxSearch(e.target.value)}
                placeholder="Rechercher un nom…"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          {auxLoading ? (
            <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {(auxData?.data ?? []).map((entry) => {
                const nom = auxType === "FOURNISSEUR" ? entry.nom : `${entry.prenom ?? ""} ${entry.nom}`.trim();
                const code = auxType === "FOURNISSEUR" ? entry.code : entry.codeClient;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{nom}</p>
                      {code && <p className="text-xs text-slate-400">{code}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={auxType === "CLIENT"
                          ? `/dashboard/user/comptables/auxiliaire/clients/${entry.id}`
                          : `/dashboard/user/comptables/auxiliaire/fournisseurs/${entry.id}`}
                        title={auxType === "CLIENT"
                          ? "Fiche client comptable (grand livre, créances, avoirs, litiges)"
                          : "Fiche fournisseur comptable (grand livre, avoirs, avances)"}
                        className="p-1.5 text-violet-500 hover:bg-violet-50 rounded-lg">
                        <FileText size={15} />
                      </Link>
                      {entry.compteAuxiliaire ? (
                        <button
                          onClick={() => { setAuxSelectedCompte({ id: entry.compteAuxiliaire!.id, numero: entry.compteAuxiliaire!.numero, nom }); setLettrageSelection([]); }}
                          className={`font-mono text-xs px-3 py-1.5 rounded-lg border ${auxSelectedCompte?.id === entry.compteAuxiliaire.id ? "bg-violet-600 text-white border-violet-600" : "border-violet-200 text-violet-700 hover:bg-violet-50"}`}
                        >
                          {entry.compteAuxiliaire.numero}
                        </button>
                      ) : (
                        <button onClick={() => handleCreerCompteAux(entry)} disabled={creatingCompteAux}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 disabled:opacity-50">
                          <PlusCircle size={13} /> Créer compte
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {(auxData?.data ?? []).length === 0 && (
                <p className="text-center text-slate-400 text-sm py-6">Aucun résultat.</p>
              )}
            </div>
          )}
        </div>

        {/* Balance âgée (CDC §16-17) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-slate-800">
              Balance âgée — {auxType === "FOURNISSEUR" ? "Fournisseurs" : "Clients"}
            </h4>
            <button
              onClick={() => {
                const rows = (balanceAgeeData?.data ?? []).map((l) => ({
                  compte: l.compteNumero, tiers: l.tiersNom,
                  t0: l.tranche0_30, t1: l.tranche31_60, t2: l.tranche61_90, t3: l.tranche90Plus, total: l.total,
                }));
                exportToXlsx(rows, [
                  { label: "Compte", key: "compte" },
                  { label: "Tiers", key: "tiers" },
                  { label: "0-30j", key: "t0", type: "currency", format: (v) => Number(v) },
                  { label: "31-60j", key: "t1", type: "currency", format: (v) => Number(v) },
                  { label: "61-90j", key: "t2", type: "currency", format: (v) => Number(v) },
                  { label: "90j+", key: "t3", type: "currency", format: (v) => Number(v) },
                  { label: "Total dû", key: "total", type: "currency", format: (v) => Number(v) },
                ], `balance-agee-${auxType.toLowerCase()}.xlsx`, { sheetName: "Balance âgée" });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-xs font-medium"
            >
              <Download size={13} /> Exporter
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Solde dû par tiers (lignes non lettrées), ventilé par ancienneté depuis la date de l&apos;écriture.
          </p>
          {balanceAgeeLoading ? (
            <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                    <th className="py-2 pr-3">Tiers</th>
                    <th className="py-2 px-3 text-right">0-30j</th>
                    <th className="py-2 px-3 text-right">31-60j</th>
                    <th className="py-2 px-3 text-right">61-90j</th>
                    <th className="py-2 px-3 text-right">90j+</th>
                    <th className="py-2 pl-3 text-right">Total dû</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(balanceAgeeData?.data ?? []).map((l) => (
                    <tr key={l.tiersId}>
                      <td className="py-2 pr-3">
                        <span className="font-medium text-slate-800">{l.tiersNom}</span>
                        <span className="font-mono text-xs text-slate-400 ml-2">{l.compteNumero}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">{l.tranche0_30 !== 0 ? formatCurrency(l.tranche0_30) : "—"}</td>
                      <td className="py-2 px-3 text-right text-amber-600">{l.tranche31_60 !== 0 ? formatCurrency(l.tranche31_60) : "—"}</td>
                      <td className="py-2 px-3 text-right text-orange-600">{l.tranche61_90 !== 0 ? formatCurrency(l.tranche61_90) : "—"}</td>
                      <td className="py-2 px-3 text-right text-red-600 font-medium">{l.tranche90Plus !== 0 ? formatCurrency(l.tranche90Plus) : "—"}</td>
                      <td className="py-2 pl-3 text-right font-bold text-slate-800">{formatCurrency(l.total)}</td>
                    </tr>
                  ))}
                  {(balanceAgeeData?.data ?? []).length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-400 text-sm py-6">Aucun solde dû.</td></tr>
                  )}
                </tbody>
                {balanceAgeeData && balanceAgeeData.data.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold text-slate-800">
                      <td className="py-2 pr-3">Total</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(balanceAgeeData.totaux.tranche0_30)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(balanceAgeeData.totaux.tranche31_60)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(balanceAgeeData.totaux.tranche61_90)}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(balanceAgeeData.totaux.tranche90Plus)}</td>
                      <td className="py-2 pl-3 text-right">{formatCurrency(balanceAgeeData.totaux.total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {auxSelectedCompte && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                <BadgeCheck size={16} className="text-violet-600" />
                Lettrage — <span className="font-mono text-violet-700">{auxSelectedCompte.numero}</span> {auxSelectedCompte.nom}
              </h4>
              <button onClick={() => setAuxSelectedCompte(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={15} /></button>
            </div>

            {lettrageLoading ? (
              <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
            ) : (
              <>
                {(lettrageData?.data.propositions ?? []).length > 0 && (
                  <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-700 mb-2">Correspondances exactes proposées</p>
                    <div className="space-y-1.5">
                      {lettrageData!.data.propositions.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{formatCurrency(p.montant)} — {p.ligneIds.length} lignes</span>
                          <button onClick={() => handleAppliquerLettrage(p.ligneIds)} disabled={applyingLettrage}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">
                            Lettrer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase">Lignes non lettrées</p>
                  <button onClick={() => handleAppliquerLettrage(lettrageSelection)}
                    disabled={lettrageSelection.length < 2 || applyingLettrage}
                    className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 disabled:opacity-40">
                    <BadgeCheck size={13} /> Lettrer la sélection ({lettrageSelection.length})
                  </button>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {(lettrageData?.data.lignes ?? []).map((l) => (
                    <label key={l.id} className="flex items-center gap-3 py-2 text-sm cursor-pointer hover:bg-slate-50 px-1 rounded-lg">
                      <input type="checkbox" checked={lettrageSelection.includes(l.id)} onChange={() => toggleLigneSelection(l.id)}
                        className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span className="text-xs text-slate-400 w-24 flex-shrink-0">{formatDateShort(l.ecriture.date)}</span>
                      <span className="font-mono text-xs text-slate-500 w-28 flex-shrink-0">{l.ecriture.reference}</span>
                      <span className="flex-1 text-slate-700 truncate">{l.libelle}</span>
                      <span className="text-blue-700 font-medium w-28 text-right">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : ""}</span>
                      <span className="text-emerald-700 font-medium w-28 text-right">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : ""}</span>
                    </label>
                  ))}
                  {(lettrageData?.data.lignes ?? []).length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-6">Toutes les lignes de ce compte sont lettrées.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
