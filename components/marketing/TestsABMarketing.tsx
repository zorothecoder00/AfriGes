"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { FlaskConical, Plus, Loader2, X, ChevronDown, ChevronUp, Play } from "lucide-react";

/** Tests A/B marketing (CDC §7, Phase 7). */

interface TestAB {
  id: number; nom: string; statut: "BROUILLON" | "EN_COURS" | "TERMINE";
  campagne: { id: number; code: string; nom: string };
  canal: { id: number; libelle: string };
  modeleA: { id: number; nom: string };
  modeleB: { id: number; nom: string };
  _count: { assignations: number };
}
interface StatsVariante { total: number; conversions: number; tauxConversion: number | null; envoyes: number; lus: number; tauxLecture: number | null }
interface Campagne { id: number; code: string; nom: string }
interface Canal { id: number; libelle: string }
interface Modele { id: number; nom: string; canalId: number }

const STATUT_LABEL: Record<string, string> = { BROUILLON: "Brouillon", EN_COURS: "En cours", TERMINE: "Terminé" };
const STATUT_STYLE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-500", EN_COURS: "bg-emerald-100 text-emerald-700", TERMINE: "bg-blue-100 text-blue-700",
};

function NouveauTestModal({ campagnes, canaux, modeles, onClose, onCreated }: { campagnes: Campagne[]; canaux: Canal[]; modeles: Modele[]; onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [campagneId, setCampagneId] = useState("");
  const [canalId, setCanalId] = useState("");
  const [modeleAId, setModeleAId] = useState("");
  const [modeleBId, setModeleBId] = useState("");
  const [saving, setSaving] = useState(false);

  const modelesDuCanal = modeles.filter((m) => !canalId || m.canalId === Number(canalId));

  const submit = async () => {
    if (!nom.trim() || !campagneId || !canalId || !modeleAId || !modeleBId) { toast.error("Tous les champs sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/tests-ab", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), campagneId: Number(campagneId), canalId: Number(canalId), modeleAId: Number(modeleAId), modeleBId: Number(modeleBId) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Test créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-fuchsia-600" /> Nouveau test A/B</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Objet email vs. Offre directe" className={field} />
          </label>
          <label className="block"><span className={lbl}>Campagne * (avec audience)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">— choisir —</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <label className="block"><span className={lbl}>Canal *</span>
            <select value={canalId} onChange={(e) => { setCanalId(e.target.value); setModeleAId(""); setModeleBId(""); }} className={field}>
              <option value="">— choisir —</option>
              {canaux.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Variante A *</span>
              <select value={modeleAId} onChange={(e) => setModeleAId(e.target.value)} className={field}>
                <option value="">— choisir —</option>
                {modelesDuCanal.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </label>
            <label className="block"><span className={lbl}>Variante B *</span>
              <select value={modeleBId} onChange={(e) => setModeleBId(e.target.value)} className={field}>
                <option value="">— choisir —</option>
                {modelesDuCanal.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function VarianteStats({ label, stats }: { label: string; stats: StatsVariante }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <p className="text-[11px] text-slate-500 mt-1">{stats.total} client(s) · {stats.envoyes} envoyé(s)</p>
      <p className="text-sm mt-1">Lecture : <span className="font-semibold">{stats.tauxLecture === null ? "—" : `${stats.tauxLecture.toFixed(0)}%`}</span></p>
      <p className="text-sm">Conversion : <span className="font-semibold text-fuchsia-700">{stats.tauxConversion === null ? "—" : `${stats.tauxConversion.toFixed(0)}%`}</span> ({stats.conversions})</p>
    </div>
  );
}

export default function TestsABMarketing() {
  const [rows, setRows] = useState<TestAB[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [canaux, setCanaux] = useState<Canal[]>([]);
  const [modeles, setModeles] = useState<Modele[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [stats, setStats] = useState<{ A: StatsVariante; B: StatsVariante } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [lancement, setLancement] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/tests-ab");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {});
    fetch("/api/admin/marketing/canaux").then((r) => r.json()).then((j) => setCanaux(j.data ?? [])).catch(() => {});
    fetch("/api/admin/marketing/modeles").then((r) => r.json()).then((j) => setModeles((j.data ?? []).map((m: { id: number; nom: string; canal: { id: number } }) => ({ id: m.id, nom: m.nom, canalId: m.canal.id })))).catch(() => {});
  }, []);

  const ouvrir = async (t: TestAB) => {
    if (ouvert === t.id) { setOuvert(null); return; }
    setOuvert(t.id);
    if (t.statut === "BROUILLON") { setStats(null); return; }
    setLoadingStats(true);
    try {
      const r = await fetch(`/api/admin/marketing/tests-ab/${t.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setStats(j.stats);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingStats(false); }
  };

  const lancer = async (t: TestAB) => {
    setLancement(t.id);
    try {
      const r = await fetch(`/api/admin/marketing/tests-ab/${t.id}/lancer`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Test lancé : ${j.data.envoyesA} + ${j.data.envoyesB} envoi(s)`); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLancement(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-fuchsia-600" /> Tests A/B</h2>
          <p className="text-sm text-slate-400">{rows.length} test(s) — comparaison de deux variantes de message.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau test
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun test pour l&apos;instant</p>
        ) : rows.map((t) => (
          <div key={t.id}>
            <button onClick={() => ouvrir(t)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{t.nom}</p>
                <p className="text-xs text-slate-400">{t.campagne.nom} · {t.canal.libelle} · A: {t.modeleA.nom} vs B: {t.modeleB.nom}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[t.statut]}`}>{STATUT_LABEL[t.statut]}</span>
                {t.statut === "BROUILLON" && (
                  <button onClick={(e) => { e.stopPropagation(); lancer(t); }} disabled={lancement === t.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-semibold">
                    {lancement === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Lancer
                  </button>
                )}
                {ouvert === t.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === t.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                {t.statut === "BROUILLON" ? (
                  <p className="text-xs text-slate-400 py-2">Ce test n&apos;a pas encore été lancé.</p>
                ) : loadingStats ? (
                  <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                ) : stats ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <VarianteStats label="Variante A" stats={stats.A} />
                    <VarianteStats label="Variante B" stats={stats.B} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouveauTestModal campagnes={campagnes} canaux={canaux} modeles={modeles} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
