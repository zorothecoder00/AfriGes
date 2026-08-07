"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2 } from "lucide-react";

/** Animation des agences (CDC §4) — pilotage local du marketing, comparatif par agence. */

interface LigneAgence { pointDeVenteId: number; nom: string; code: string; budget: number; leads: number; clients: number; caAttribue: number; roi: number | null }

const fmt = (v: number) => Math.round(v).toLocaleString("fr-FR");

export default function AnimationAgencesMarketing() {
  const [rows, setRows] = useState<LigneAgence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/marketing/stats")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setRows(j.data.parAgence);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-fuchsia-600" /> Animation des agences</h2>
      <p className="text-sm text-slate-400">Pilotage marketing local (CDC §4-5) — comparatif budget/leads/clients/CA/ROI par agence, mois en cours.</p>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune donnée pour l&apos;instant</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Agence</th>
                  <th className="text-right px-4 py-3 font-semibold">Budget</th>
                  <th className="text-right px-4 py-3 font-semibold">Leads</th>
                  <th className="text-right px-4 py-3 font-semibold">Clients</th>
                  <th className="text-right px-4 py-3 font-semibold">CA attribué</th>
                  <th className="text-right px-4 py-3 font-semibold">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => (
                  <tr key={r.pointDeVenteId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.nom}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{r.code}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmt(r.budget)} F</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.leads}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.clients}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(r.caAttribue)} F</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.roi !== null && r.roi >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{r.roi === null ? "—" : `${r.roi.toFixed(0)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        Vue actuellement réservée aux profils marketing (Admin/Responsable Marketing) — un responsable d&apos;agence
        n&apos;a pas encore d&apos;accès restreint à sa seule agence sur cet écran (extension possible, non construite).
      </p>
    </div>
  );
}
