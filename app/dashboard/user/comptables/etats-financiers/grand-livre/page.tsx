"use client";

// États financiers — Grand livre.
// Extrait du bloc activeTab === "grandlivre" du monolithe (app/dashboard/user/comptables/page.tsx,
// ~ligne 2535), consommant /api/comptable/journal?grandlivre=1 (~ligne 839 du monolithe).
import { useMemo, useState, type ElementType } from "react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import {
  BookOpen, Filter, Calendar, TrendingUp, CheckCircle, Package, Wallet,
  ShoppingBag, BadgeCheck, Users, ArrowDownRight,
} from "lucide-react";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface JournalEntry {
  id:              string;
  sourceId:        number;
  date:            string;
  type:            "ENCAISSEMENT" | "DECAISSEMENT";
  categorie:       string;
  libelle:         string;
  montant:         number;
  reference:       string;
  valide?:         boolean;
  valideParNom?:   string;
  dateValidation?: string;
}
interface JournalResponse { success: boolean; data: JournalEntry[] }

const CAT_META: Record<string, { label: string; color: string; bg: string; icon: ElementType }> = {
  COTISATION_INITIALE:  { label: "Acompte initial",        color: "text-blue-600",    bg: "bg-blue-100",    icon: Calendar },
  VERSEMENT_PERIODIQUE: { label: "Versement périodique",   color: "text-emerald-600", bg: "bg-emerald-100", icon: TrendingUp },
  REMBOURSEMENT:        { label: "Remboursement",          color: "text-teal-600",    bg: "bg-teal-100",    icon: CheckCircle },
  VERSEMENT_PACK:       { label: "Bonus / Ajustement",     color: "text-violet-600",  bg: "bg-violet-100",  icon: BookOpen },
  APPROVISIONNEMENT:    { label: "Approvisionnement",      color: "text-orange-600",  bg: "bg-orange-100",  icon: Package },
  CAISSE_ENCAISSEMENT:  { label: "Encaissement caisse",    color: "text-cyan-600",    bg: "bg-cyan-100",    icon: Wallet },
  VENTE_DIRECTE:        { label: "Vente directe",          color: "text-indigo-600",  bg: "bg-indigo-100",  icon: ShoppingBag },
  REMBOURSEMENT_CREDIT: { label: "Remb. crédit client",    color: "text-green-600",   bg: "bg-green-100",   icon: BadgeCheck },
  SALAIRE:              { label: "Salaire",                color: "text-red-600",     bg: "bg-red-100",     icon: Users },
  AVANCE:                { label: "Avance",                 color: "text-rose-600",    bg: "bg-rose-100",    icon: ArrowDownRight },
  FOURNISSEUR:          { label: "Fournisseur",            color: "text-amber-600",   bg: "bg-amber-100",   icon: Package },
  CAISSE_AUTRE:         { label: "Autre décaissement",     color: "text-slate-600",   bg: "bg-slate-100",   icon: Filter },
};

export default function GrandLivrePage() {
  const [journalDateDebut, setJournalDateDebut] = useState("");
  const [journalDateFin, setJournalDateFin]     = useState("");

  const grandLivreUrl = useMemo(() => {
    const p = new URLSearchParams({ grandlivre: "1" });
    if (journalDateDebut) p.set("dateDebut", journalDateDebut);
    if (journalDateFin)   p.set("dateFin",   journalDateFin);
    return `/api/comptable/journal?${p.toString()}`;
  }, [journalDateDebut, journalDateFin]);

  const { data: grandLivreData, loading: grandLivreLoading } = useApi<JournalResponse>(grandLivreUrl);

  return (
    <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="text-emerald-600" size={22} /> Grand livre
        </h2>
        {AIDE_COMPTABLE.grandlivre && <AideComptable contenu={AIDE_COMPTABLE.grandlivre} />}
      </div>

      <div className="space-y-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen size={20} className="text-emerald-600" />Grand Livre des Comptes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Toutes les écritures regroupées par compte</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={journalDateDebut}
                onChange={(e) => setJournalDateDebut(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <span className="text-slate-400 text-xs">→</span>
              <input type="date" value={journalDateFin}
                onChange={(e) => setJournalDateFin(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        </div>

        {grandLivreLoading ? (
          <div className="p-16 text-center"><div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto" /></div>
        ) : (
          (() => {
            const entries = grandLivreData?.data ?? [];
            const groups = new Map<string, JournalEntry[]>();
            for (const e of entries) {
              const list = groups.get(e.categorie) ?? [];
              list.push(e);
              groups.set(e.categorie, list);
            }
            const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

            if (sortedGroups.length === 0) {
              return (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm border border-slate-200/60">
                  Aucune écriture pour cette période
                </div>
              );
            }

            return (
              <div className="space-y-5">
                {sortedGroups.map(([cat, catEntries]) => {
                  const meta      = CAT_META[cat] ?? { label: cat, color: "text-slate-600", bg: "bg-slate-100", icon: Filter };
                  const CatIcon   = meta.icon;
                  let runningBal  = 0;
                  const totalDeb  = catEntries.filter((e) => e.type === "DECAISSEMENT").reduce((s, e) => s + e.montant, 0);
                  const totalCred = catEntries.filter((e) => e.type === "ENCAISSEMENT").reduce((s, e) => s + e.montant, 0);

                  return (
                    <div key={cat} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                      <div className={`px-6 py-3 border-b border-slate-200 flex items-center justify-between ${meta.bg}`}>
                        <div className="flex items-center gap-2">
                          <CatIcon size={16} className={meta.color} />
                          <span className={`font-bold ${meta.color}`}>{meta.label}</span>
                          <span className="text-xs text-slate-500 ml-2">{catEntries.length} écritures</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-semibold">
                          <span className="text-red-600">Débit : {formatCurrency(totalDeb)}</span>
                          <span className="text-emerald-600">Crédit : {formatCurrency(totalCred)}</span>
                          <span className={`${(totalCred - totalDeb) >= 0 ? "text-emerald-700" : "text-red-700"} font-bold`}>
                            Solde : {(totalCred - totalDeb) >= 0 ? "+" : ""}{formatCurrency(totalCred - totalDeb)}
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Date</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Référence</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">Libellé</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Débit</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Crédit</th>
                              <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">Solde cumulé</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {catEntries.map((e) => {
                              const deb  = e.type === "DECAISSEMENT" ? e.montant : 0;
                              const cred = e.type === "ENCAISSEMENT" ? e.montant : 0;
                              runningBal += (cred - deb);
                              return (
                                <tr key={e.id} className="hover:bg-slate-50">
                                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateShort(e.date)}</td>
                                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{e.reference}</td>
                                  <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={e.libelle}>{e.libelle}</td>
                                  <td className="px-4 py-2 text-right text-red-600">{deb > 0 ? formatCurrency(deb) : <span className="text-slate-200">—</span>}</td>
                                  <td className="px-4 py-2 text-right text-emerald-600">{cred > 0 ? formatCurrency(cred) : <span className="text-slate-200">—</span>}</td>
                                  <td className={`px-4 py-2 text-right font-semibold ${runningBal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                    {runningBal >= 0 ? "+" : ""}{formatCurrency(runningBal)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
    </main>
  );
}
