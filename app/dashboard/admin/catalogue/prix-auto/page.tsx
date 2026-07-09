"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Wand2, Loader2, Save } from "lucide-react";

const s = (v: unknown) => (v == null ? "" : String(v));

export default function PrixAutoPage() {
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/catalogue/prix-auto");
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? "Erreur");
        const p = j.data;
        setForm({
          actif: !!p.actif, appliquerSurCredit: !!p.appliquerSurCredit,
          margeCiblePct: s(p.margeCiblePct), fraisLogistiquePct: s(p.fraisLogistiquePct),
          margeCreditPct: s(p.margeCreditPct), arrondi: s(p.arrondi),
        });
      } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/catalogue/prix-auto", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Paramétrage enregistré ✓");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wand2 className="w-6 h-6 text-violet-600" /> Moteur de prix automatique</h2>
        <p className="text-sm text-gray-400 -mt-3">Recalcule le prix de vente à partir du coût d&apos;achat : revient = achat + frais logistiques, vente = revient + marge cible.</p>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
            <Toggle label="Moteur activé (le recalcul reste manuel par produit)" value={!!form.actif} onChange={(v) => set("actif", v)} color="violet" />
            <Num label="Marge cible (%)" k="margeCiblePct" form={form} set={set} placeholder="20" />
            <Num label="Frais logistiques (% du coût d'achat)" k="fraisLogistiquePct" form={form} set={set} placeholder="0" />
            <Num label="Arrondir le prix au multiple de (0 = aucun)" k="arrondi" form={form} set={set} placeholder="0" />
            <div className="pt-2 border-t border-gray-100" />
            <Toggle label="Recalculer aussi le prix crédit" value={!!form.appliquerSurCredit} onChange={(v) => set("appliquerSurCredit", v)} color="violet" />
            <Num label="Marge additionnelle crédit (%)" k="margeCreditPct" form={form} set={set} placeholder="0" disabled={!form.appliquerSurCredit} />
            <div className="flex justify-end pt-2">
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Num({ label, k, form, set, placeholder, disabled }:
  { label: string; k: string; form: Record<string, string | boolean>; set: (k: string, v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-600">{label}</label>
      <input type="number" min={0} step="0.1" disabled={disabled} value={String(form[k] ?? "")} onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder} className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50" />
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-600">{label}</span>
      <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-violet-500" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
