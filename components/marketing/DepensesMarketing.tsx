"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Loader2, X } from "lucide-react";

/** Dépenses marketing (CDC §53) — reliées à la comptabilité automatiquement. */

interface Depense {
  id: number; categorie: string; montant: number; date: string; description: string | null; ecritureComptableId: number | null;
  campagne: { id: number; code: string; nom: string };
}
interface Campagne { id: number; code: string; nom: string }

const CATEGORIE_LABEL: Record<string, string> = {
  PUBLICITE: "Publicité", IMPRESSION: "Impression", INFLUENCE: "Influence", EVENEMENT: "Événement",
  TRANSPORT: "Transport", TERRAIN: "Terrain", SMS: "SMS", WHATSAPP: "WhatsApp", EMAIL: "Email",
  MEDIA: "Média", SPONSORING: "Sponsoring", CREATION_GRAPHIQUE: "Création graphique", AUTRE: "Autre",
};

function NouvelleDepenseModal({ campagnes, onClose, onCreated }: { campagnes: Campagne[]; onClose: () => void; onCreated: () => void }) {
  const [campagneId, setCampagneId] = useState("");
  const [categorie, setCategorie] = useState("PUBLICITE");
  const [montant, setMontant] = useState("");
  const [description, setDescription] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!campagneId || !Number(montant)) { toast.error("Campagne et montant requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/depenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagneId: Number(campagneId), categorie, montant: Number(montant), description: description.trim() || null, modePaiement }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Dépense enregistrée ✓ (écriture comptable créée)"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Receipt className="w-5 h-5 text-fuchsia-600" /> Nouvelle dépense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Campagne *</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">— choisir —</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Catégorie *</span>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className={field}>
                {Object.entries(CATEGORIE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className={lbl}>Montant (FCFA) *</span>
              <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Mode de règlement</span>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={field}>
              <option value="ESPECES">Espèces</option>
              <option value="VIREMENT">Virement</option>
              <option value="CHEQUE">Chèque</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
            </select>
          </label>
          <label className="block"><span className={lbl}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={field} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepensesMarketing() {
  const [rows, setRows] = useState<Depense[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/depenses");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {}); }, []);

  const total = rows.reduce((s, d) => s + d.montant, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Receipt className="w-5 h-5 text-fuchsia-600" /> Dépenses</h2>
          <p className="text-sm text-slate-400">{rows.length} dépense(s) · {total.toLocaleString("fr-FR")} FCFA — comptabilisées automatiquement.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouvelle dépense
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune dépense pour l&apos;instant</p>
        ) : rows.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{CATEGORIE_LABEL[d.categorie]} — {d.campagne.nom}</p>
              <p className="text-xs text-slate-400">{new Date(d.date).toLocaleDateString("fr-FR")}{d.description ? ` · ${d.description}` : ""}{d.ecritureComptableId ? " · écriture comptable créée" : ""}</p>
            </div>
            <span className="text-sm font-semibold text-slate-800">{d.montant.toLocaleString("fr-FR")} FCFA</span>
          </div>
        ))}
      </div>

      {modalOpen && <NouvelleDepenseModal campagnes={campagnes} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
