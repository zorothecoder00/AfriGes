"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CalendarClock, AlertTriangle, PackageX, RefreshCw } from "lucide-react";
import { ETAT_PEREMPTION_LABEL, type EtatPeremption } from "@/lib/lotsFefo";

interface LotAlerte {
  id: number; numeroLot: string; quantite: number; dlc: string | null; statut: string;
  produit: { id: number; nom: string; codeProduit: string | null };
  pointDeVente: { id: number; nom: string };
  peremption: { etat: EtatPeremption; joursRestants: number | null };
}
interface Data { seuil: number; resume: { total: number; perimes: number; bientot: number }; lots: LotAlerte[]; }

const ETAT_STYLE: Record<EtatPeremption, string> = {
  SANS_DLC: "bg-slate-100 text-slate-500", OK: "bg-emerald-100 text-emerald-700",
  BIENTOT: "bg-amber-100 text-amber-700", PERIME: "bg-rose-100 text-rose-700",
};

export default function PeremptionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [seuil, setSeuil] = useState(30);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/lots/alertes?seuil=${seuil}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setData(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, [seuil]);

  useEffect(() => { load(); }, [load]);

  const marquerPerimes = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/lots/alertes`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success(`${j.data.traites} lot(s) marqué(s) périmé(s)`); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><CalendarClock className="w-6 h-6 text-blue-600" /> Péremptions</h2>
            <p className="text-sm text-gray-400">Lots bientôt périmés ou dépassés (principe FEFO).</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-gray-500">Horizon
              <select value={seuil} onChange={(e) => setSeuil(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
                {[7, 15, 30, 60, 90].map((d) => <option key={d} value={d}>{d} j</option>)}
              </select>
            </label>
            <button onClick={marquerPerimes} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Marquer les périmés
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-rose-50 text-rose-600 mb-2"><PackageX className="w-5 h-5" /></div>
                <p className="text-2xl font-bold text-gray-900">{data.resume.perimes}</p><p className="text-xs text-gray-400">Périmés</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 text-amber-600 mb-2"><AlertTriangle className="w-5 h-5" /></div>
                <p className="text-2xl font-bold text-gray-900">{data.resume.bientot}</p><p className="text-xs text-gray-400">Bientôt périmés (≤ {data.seuil} j)</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600 mb-2"><CalendarClock className="w-5 h-5" /></div>
                <p className="text-2xl font-bold text-gray-900">{data.resume.total}</p><p className="text-xs text-gray-400">Lots à surveiller</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {data.lots.length === 0 ? (
                <div className="py-16 text-center text-gray-400">Aucun lot à surveiller sur cet horizon.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold">Produit</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Lot</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Site</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Quantité</th>
                        <th className="text-left px-4 py-2.5 font-semibold">DLC</th>
                        <th className="text-center px-4 py-2.5 font-semibold">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.lots.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5"><Link href={`/dashboard/admin/catalogue/produits/${l.produit.id}`} className="font-medium text-gray-800 hover:text-blue-600 hover:underline">{l.produit.nom}</Link><span className="block text-[11px] text-gray-400 font-mono">{l.produit.codeProduit ?? "—"}</span></td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{l.numeroLot}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{l.pointDeVente.nom}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{l.quantite}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{l.dlc ? new Date(l.dlc).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${ETAT_STYLE[l.peremption.etat]}`}>
                              {ETAT_PEREMPTION_LABEL[l.peremption.etat]}{l.peremption.joursRestants != null ? ` (${l.peremption.joursRestants}j)` : ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
