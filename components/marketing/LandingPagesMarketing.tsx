"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Layout, Plus, Loader2, X, Power, PowerOff, Copy, ExternalLink } from "lucide-react";

/** Landing pages marketing (CDC §44). */

interface LandingPage {
  id: number; slug: string; titre: string; actif: boolean; nbVues: number;
  campagne: { id: number; code: string; nom: string } | null;
  formulaire: { id: number; nom: string } | null;
  _count: { soumissions: number };
}
interface Campagne { id: number; code: string; nom: string }
interface Formulaire { id: number; nom: string }

function NouvelleLandingPageModal({ campagnes, formulaires, onClose, onCreated }: { campagnes: Campagne[]; formulaires: Formulaire[]; onClose: () => void; onCreated: () => void }) {
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [offreTexte, setOffreTexte] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [campagneId, setCampagneId] = useState("");
  const [formulaireId, setFormulaireId] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titre.trim()) { toast.error("Le titre est requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/landing-pages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: titre.trim(), description: description.trim() || null, offreTexte: offreTexte.trim() || null,
          ctaLabel: ctaLabel.trim() || null, ctaUrl: ctaUrl.trim() || null,
          campagneId: campagneId ? Number(campagneId) : null, formulaireId: formulaireId ? Number(formulaireId) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Page créée (/lp/${j.data.slug}) ✓`); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Layout className="w-5 h-5 text-fuchsia-600" /> Nouvelle landing page</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Titre *</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Pack Famille — Rentrée" className={field} />
          </label>
          <label className="block"><span className={lbl}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={field} />
          </label>
          <label className="block"><span className={lbl}>Offre (bandeau)</span>
            <input value={offreTexte} onChange={(e) => setOffreTexte(e.target.value)} placeholder="-10% jusqu'au 30 septembre" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Libellé bouton</span>
              <input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Appeler l'agence" className={field} />
            </label>
            <label className="block"><span className={lbl}>Lien bouton</span>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="tel:+228..." className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Campagne (optionnel)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <label className="block"><span className={lbl}>Formulaire (optionnel)</span>
            <select value={formulaireId} onChange={(e) => setFormulaireId(e.target.value)} className={field}>
              <option value="">Aucun</option>
              {formulaires.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LandingPagesMarketing() {
  const [rows, setRows] = useState<LandingPage[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [formulaires, setFormulaires] = useState<Formulaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/landing-pages");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {});
    fetch("/api/admin/marketing/formulaires").then((r) => r.json()).then((j) => setFormulaires((j.data ?? []).map((f: { id: number; nom: string }) => ({ id: f.id, nom: f.nom })))).catch(() => {});
  }, []);

  const toggleActif = async (p: LandingPage) => {
    const r = await fetch(`/api/admin/marketing/landing-pages/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !p.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(p.actif ? "Page désactivée" : "Page activée"); load();
  };

  const copierLien = (slug: string) => {
    const url = `${window.location.origin}/lp/${slug}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Layout className="w-5 h-5 text-fuchsia-600" /> Landing pages</h2>
          <p className="text-sm text-slate-400">{rows.length} page(s).</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouvelle page
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucune landing page pour l&apos;instant</p>
        ) : rows.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">{p.titre}</p>
              <p className="text-xs text-slate-400 font-mono">/lp/{p.slug} · {p.nbVues} vue(s) · {p._count.soumissions} soumission(s)</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => copierLien(p.slug)} title="Copier le lien" className="p-1.5 text-slate-400 hover:text-fuchsia-600 rounded-lg hover:bg-fuchsia-50"><Copy className="w-4 h-4" /></button>
              <a href={`/lp/${p.slug}`} target="_blank" rel="noreferrer" title="Ouvrir" className="p-1.5 text-slate-400 hover:text-fuchsia-600 rounded-lg hover:bg-fuchsia-50"><ExternalLink className="w-4 h-4" /></a>
              <button onClick={() => toggleActif(p)} title={p.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                {p.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <NouvelleLandingPageModal campagnes={campagnes} formulaires={formulaires} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
