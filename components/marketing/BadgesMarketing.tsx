"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Award, Plus, Loader2, X, Power, PowerOff, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Badges de gamification (CDC §37) — attribution automatique sur condition
 * simple (niveau de fidélité atteint, ou nb d'achats total). Évalués par le
 * cron /api/cron/marketing/fidelisation.
 */

const NIVEAUX = ["BRONZE", "ARGENT", "OR", "PLATINE"];

interface Badge {
  id: number; nom: string; description: string | null; icone: string | null; actif: boolean;
  condition: { type: "NIVEAU_FIDELITE"; niveau: string } | { type: "NB_ACHATS"; seuil: number };
  _count: { attributions: number };
}
interface Attribution { id: number; dateAttribution: string; client: { id: number; nom: string; prenom: string } }

function conditionLabel(c: Badge["condition"]): string {
  if (c.type === "NIVEAU_FIDELITE") return `Niveau fidélité ≥ ${c.niveau}`;
  if (c.type === "NB_ACHATS") return `≥ ${c.seuil} achat(s)`;
  return "—";
}

function NouveauBadgeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [icone, setIcone] = useState("");
  const [type, setType] = useState<"NIVEAU_FIDELITE" | "NB_ACHATS">("NIVEAU_FIDELITE");
  const [niveau, setNiveau] = useState("OR");
  const [seuil, setSeuil] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    const condition = type === "NIVEAU_FIDELITE" ? { type, niveau } : { type, seuil: Number(seuil) };
    if (type === "NB_ACHATS" && !Number(seuil)) { toast.error("Seuil requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/badges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), icone: icone.trim() || null, condition }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Badge créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Award className="w-5 h-5 text-fuchsia-600" /> Nouveau badge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Client fidèle" className={field} />
          </label>
          <label className="block"><span className={lbl}>Icône (emoji, optionnel)</span>
            <input value={icone} onChange={(e) => setIcone(e.target.value)} placeholder="🏆" className={field} />
          </label>
          <label className="block"><span className={lbl}>Condition d&apos;attribution *</span>
            <select value={type} onChange={(e) => setType(e.target.value as "NIVEAU_FIDELITE" | "NB_ACHATS")} className={field}>
              <option value="NIVEAU_FIDELITE">Niveau de fidélité atteint</option>
              <option value="NB_ACHATS">Nombre d&apos;achats total</option>
            </select>
          </label>
          {type === "NIVEAU_FIDELITE" ? (
            <label className="block"><span className={lbl}>Niveau minimum *</span>
              <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className={field}>
                {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          ) : (
            <label className="block"><span className={lbl}>Seuil d&apos;achats *</span>
              <input type="number" min={1} value={seuil} onChange={(e) => setSeuil(e.target.value)} className={field} />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BadgesMarketing() {
  const [rows, setRows] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [loadingAttr, setLoadingAttr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/badges");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActif = async (b: Badge) => {
    const r = await fetch(`/api/admin/marketing/badges/${b.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !b.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(b.actif ? "Badge désactivé" : "Badge activé"); load();
  };

  const ouvrirAttributions = async (b: Badge) => {
    if (ouvert === b.id) { setOuvert(null); return; }
    setOuvert(b.id); setLoadingAttr(true);
    try {
      const r = await fetch(`/api/admin/marketing/badges/${b.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setAttributions(j.data.attributions);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingAttr(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Award className="w-5 h-5 text-fuchsia-600" /> Badges</h2>
          <p className="text-sm text-slate-400">{rows.length} badge(s) — attribués automatiquement chaque jour.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau badge
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun badge pour l&apos;instant</p>
        ) : rows.map((b) => (
          <div key={b.id}>
            <button onClick={() => ouvrirAttributions(b)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div className="flex items-center gap-2">
                {b.icone && <span className="text-lg">{b.icone}</span>}
                <div>
                  <p className="font-medium text-slate-800">{b.nom}</p>
                  <p className="text-xs text-slate-400">{conditionLabel(b.condition)} · {b._count.attributions} client(s) badgé(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleActif(b); }} title={b.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                  {b.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                </button>
                {ouvert === b.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === b.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                {loadingAttr ? (
                  <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                ) : attributions.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">Aucun client badgé pour l&apos;instant</p>
                ) : (
                  <div className="space-y-1.5 pt-2">
                    {attributions.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-xs text-slate-600">
                        <span>{a.client.prenom} {a.client.nom}</span>
                        <span className="text-slate-400">{new Date(a.dateAttribution).toLocaleDateString("fr-FR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouveauBadgeModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
