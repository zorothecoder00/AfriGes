"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { QrCode, Plus, Loader2, X, Power, PowerOff, Copy } from "lucide-react";

/** Codes QR marketing (CDC §43). */

interface QrRow {
  id: number; code: string; nbScans: number; actif: boolean; destinationUrl: string | null;
  campagne: { id: number; code: string; nom: string } | null;
  landingPage: { id: number; slug: string; titre: string } | null;
}
interface Campagne { id: number; code: string; nom: string }
interface LandingPage { id: number; slug: string; titre: string }

function NouveauQrModal({ campagnes, landingPages, onClose, onCreated }: { campagnes: Campagne[]; landingPages: LandingPage[]; onClose: () => void; onCreated: () => void }) {
  const [campagneId, setCampagneId] = useState("");
  const [landingPageId, setLandingPageId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!landingPageId && !destinationUrl.trim()) { toast.error("Une landing page ou une URL de destination est requise"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/qr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campagneId: campagneId ? Number(campagneId) : null, landingPageId: landingPageId ? Number(landingPageId) : null, destinationUrl: destinationUrl.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`QR créé (${j.data.code}) ✓`); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><QrCode className="w-5 h-5 text-fuchsia-600" /> Nouveau QR</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Campagne (optionnel)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <label className="block"><span className={lbl}>Landing page</span>
            <select value={landingPageId} onChange={(e) => setLandingPageId(e.target.value)} className={field}>
              <option value="">Aucune (utiliser une URL)</option>
              {landingPages.map((l) => <option key={l.id} value={l.id}>{l.titre}</option>)}
            </select>
          </label>
          {!landingPageId && (
            <label className="block"><span className={lbl}>URL de destination</span>
              <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://..." className={field} />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QrCodesMarketing() {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/qr");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {});
    fetch("/api/admin/marketing/landing-pages").then((r) => r.json()).then((j) => setLandingPages((j.data ?? []).map((l: { id: number; slug: string; titre: string }) => ({ id: l.id, slug: l.slug, titre: l.titre })))).catch(() => {});
  }, []);

  const toggleActif = async (q: QrRow) => {
    const r = await fetch(`/api/admin/marketing/qr/${q.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !q.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(q.actif ? "QR désactivé" : "QR activé"); load();
  };

  const copierLien = (code: string) => {
    const url = `${window.location.origin}/api/marketing/qr/${code}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié (à encoder en QR)"));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><QrCode className="w-5 h-5 text-fuchsia-600" /> Codes QR</h2>
          <p className="text-sm text-slate-400">{rows.length} code(s) — chaque scan est tracé.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau QR
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun QR pour l&apos;instant</p>
        ) : rows.map((q) => (
          <div key={q.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-800 font-mono">{q.code}</p>
              <p className="text-xs text-slate-400">{q.landingPage ? q.landingPage.titre : q.destinationUrl ?? "—"} · {q.nbScans} scan(s)</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => copierLien(q.code)} title="Copier le lien à encoder" className="p-1.5 text-slate-400 hover:text-fuchsia-600 rounded-lg hover:bg-fuchsia-50"><Copy className="w-4 h-4" /></button>
              <button onClick={() => toggleActif(q)} title={q.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                {q.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && <NouveauQrModal campagnes={campagnes} landingPages={landingPages} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
