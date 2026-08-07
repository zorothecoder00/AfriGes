"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ClipboardList, Plus, Loader2, X, Power, PowerOff, Trash2 } from "lucide-react";

/** Form builder marketing (CDC §45-46) — champs dynamiques. */

interface Champ { cle: string; label: string; type: "text" | "tel" | "email" | "select"; requis: boolean }
interface Formulaire {
  id: number; nom: string; actif: boolean;
  campagne: { id: number; code: string; nom: string } | null;
  _count: { soumissions: number };
}
interface Campagne { id: number; code: string; nom: string }

const CHAMPS_DEFAUT: Champ[] = [
  { cle: "nom", label: "Nom", type: "text", requis: true },
  { cle: "telephone", label: "Téléphone", type: "tel", requis: true },
];

function NouveauFormulaireModal({ campagnes, onClose, onCreated }: { campagnes: Campagne[]; onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [campagneId, setCampagneId] = useState("");
  const [champs, setChamps] = useState<Champ[]>(CHAMPS_DEFAUT);
  const [saving, setSaving] = useState(false);

  const ajouterChamp = () => setChamps((c) => [...c, { cle: "", label: "", type: "text", requis: false }]);
  const retirerChamp = (i: number) => setChamps((c) => c.filter((_, idx) => idx !== i));
  const majChamp = (i: number, patch: Partial<Champ>) => setChamps((c) => c.map((ch, idx) => idx === i ? { ...ch, ...patch } : ch));

  const submit = async () => {
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    if (champs.some((c) => !c.cle.trim() || !c.label.trim())) { toast.error("Chaque champ doit avoir une clé et un libellé"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/formulaires", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), campagneId: campagneId ? Number(campagneId) : null, champs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Formulaire créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-fuchsia-600" /> Nouveau formulaire</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Formulaire Pack Famille" className={field} />
          </label>
          <label className="block"><span className={lbl}>Campagne (optionnel)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>

          <div>
            <div className="flex items-center justify-between">
              <span className={lbl}>Champs</span>
              <button onClick={ajouterChamp} className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700">+ Ajouter un champ</button>
            </div>
            <div className="mt-2 space-y-2">
              {champs.map((c, i) => (
                <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl p-2">
                  <input value={c.cle} onChange={(e) => majChamp(i, { cle: e.target.value })} placeholder="cle" className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                  <input value={c.label} onChange={(e) => majChamp(i, { label: e.target.value })} placeholder="Libellé" className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs" />
                  <select value={c.type} onChange={(e) => majChamp(i, { type: e.target.value as Champ["type"] })} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs">
                    <option value="text">Texte</option>
                    <option value="tel">Téléphone</option>
                    <option value="email">Email</option>
                    <option value="select">Liste</option>
                  </select>
                  <label className="flex items-center gap-1 text-[11px] text-slate-500">
                    <input type="checkbox" checked={c.requis} onChange={(e) => majChamp(i, { requis: e.target.checked })} className="w-3.5 h-3.5" /> requis
                  </label>
                  <button onClick={() => retirerChamp(i)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FormulairesMarketing() {
  const [rows, setRows] = useState<Formulaire[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/formulaires");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {}); }, []);

  const toggleActif = async (f: Formulaire) => {
    const r = await fetch(`/api/admin/marketing/formulaires/${f.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !f.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(f.actif ? "Formulaire désactivé" : "Formulaire activé"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-fuchsia-600" /> Formulaires</h2>
          <p className="text-sm text-slate-400">{rows.length} formulaire(s) — associés à une landing page ou un QR.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau formulaire
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun formulaire pour l&apos;instant</p>
        ) : rows.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{f.nom}</p>
              <p className="text-xs text-slate-400">{f.campagne ? f.campagne.nom : "Sans campagne"} · {f._count.soumissions} soumission(s)</p>
            </div>
            <button onClick={() => toggleActif(f)} title={f.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
              {f.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>

      {modalOpen && <NouveauFormulaireModal campagnes={campagnes} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
