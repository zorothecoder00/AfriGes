"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Users2, Loader2, Save, UserPlus, Coins, TrendingUp, Wallet } from "lucide-react";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format";

/** Parrainage (CDC §2, §84) — paramétrage points + liste des parrainages/statuts + suivi ROI (§38). */

interface Parametrage { actif: boolean; pointsParrain: number; pointsFilleul: number }
interface StatsParrainage {
  totalParrainages: number; enAttente: number; qualifies: number; recompenses: number;
  nouveauxClients: number; coutPoints: number; caGenere: number; caParPoint: number | null;
}
interface Parrainage {
  id: number; statut: "EN_ATTENTE" | "QUALIFIE" | "RECOMPENSE"; dateInscription: string;
  dateQualification: string | null; dateRecompense: string | null;
  parrain: { id: number; nom: string; prenom: string; codeParrainage: string | null };
  filleul: { id: number; nom: string; prenom: string };
}

const STATUT_LABEL: Record<string, string> = { EN_ATTENTE: "En attente", QUALIFIE: "Qualifié", RECOMPENSE: "Récompensé" };
const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700", QUALIFIE: "bg-blue-100 text-blue-700", RECOMPENSE: "bg-emerald-100 text-emerald-700",
};

export default function ParrainageMarketing() {
  const [param, setParam] = useState<Parametrage | null>(null);
  const [rows, setRows] = useState<Parrainage[]>([]);
  const [stats, setStats] = useState<StatsParrainage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/admin/marketing/parrainage/parametrage"), fetch("/api/admin/marketing/parrainage"),
        fetch("/api/admin/marketing/parrainage/stats"),
      ]);
      const [j1, j2, j3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      if (!r1.ok) throw new Error(j1.error ?? "Erreur"); if (!r2.ok) throw new Error(j2.error ?? "Erreur");
      if (!r3.ok) throw new Error(j3.error ?? "Erreur");
      setParam(j1.data); setRows(j2.data); setStats(j3.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const enregistrer = async () => {
    if (!param) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/parrainage/parametrage", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(param),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Paramétrage enregistré ✓");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users2 className="w-5 h-5 text-fuchsia-600" /> Parrainage</h2>

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Nouveaux clients" value={stats.nouveauxClients} icon={<UserPlus size={20} />} accent="success"
            sub={`${stats.enAttente} en attente de 1er achat`} help="Filleuls qualifiés ou récompensés (1er achat détecté)." />
          <KpiCard label="Coût (points attribués)" value={stats.coutPoints} icon={<Coins size={20} />} accent="warning"
            help="Total des points fidélité attribués aux parrains + filleuls récompensés (pas de taux point→FCFA dans ce système)." />
          <KpiCard label="CA généré" value={stats.caGenere} format={(n) => formatCurrency(n)} icon={<Wallet size={20} />} accent="brand"
            help="Somme des ventes des filleuls convertis depuis leur qualification." />
          <KpiCard label="CA par point investi" value={stats.caParPoint ?? 0} format={(n) => `${formatCurrency(n)}`} icon={<TrendingUp size={20} />} accent="purple"
            help="CA généré ÷ points attribués — mesure de rendement du programme, pas un pourcentage classique." />
        </div>
      )}

      {param && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Paramétrage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block"><span className={lbl}>Points pour le parrain</span>
              <input type="number" min={0} value={param.pointsParrain} onChange={(e) => setParam({ ...param, pointsParrain: Number(e.target.value) })} className={field} />
            </label>
            <label className="block"><span className={lbl}>Points pour le filleul</span>
              <input type="number" min={0} value={param.pointsFilleul} onChange={(e) => setParam({ ...param, pointsFilleul: Number(e.target.value) })} className={field} />
            </label>
            <label className="flex items-center gap-2 mt-6 cursor-pointer">
              <input type="checkbox" checked={param.actif} onChange={(e) => setParam({ ...param, actif: e.target.checked })} className="w-4 h-4 rounded" />
              <span className="text-sm text-gray-700">Programme actif</span>
            </label>
          </div>
          <button onClick={enregistrer} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-800 mb-3">Parrainages ({rows.length})</h3>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
          {rows.length === 0 ? <p className="text-center text-slate-400 py-16">Aucun parrainage pour l&apos;instant</p> : rows.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {p.parrain.prenom} {p.parrain.nom} <span className="text-slate-400 font-normal">a parrainé</span> {p.filleul.prenom} {p.filleul.nom}
                </p>
                <p className="text-xs text-slate-400">
                  Code {p.parrain.codeParrainage ?? "—"} · inscrit le {new Date(p.dateInscription).toLocaleDateString("fr-FR")}
                  {p.dateRecompense ? ` · récompensé le ${new Date(p.dateRecompense).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[p.statut]}`}>{STATUT_LABEL[p.statut]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
