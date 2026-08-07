"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Trophy, Plus, Loader2, X, ChevronDown, ChevronUp, Flag } from "lucide-react";

/**
 * Challenges de gamification (CDC §37) — objectif quantifiable minimal
 * (NB_ACHATS ou MONTANT_ACHATS sur une période). Évalués par le cron
 * /api/cron/marketing/fidelisation.
 */

const TYPE_LABEL: Record<string, string> = { NB_ACHATS: "Nombre d'achats", MONTANT_ACHATS: "Montant d'achats (FCFA)" };

interface Challenge {
  id: number; nom: string; description: string | null; typeObjectif: string; seuil: number;
  recompensePoints: number; dateDebut: string; dateFin: string; statut: "ACTIF" | "TERMINE";
  _count: { participations: number }; nbReussis: number;
}
interface Participant { id: number; progression: number; statut: string; client: { id: number; nom: string; prenom: string } }

function NouveauChallengeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [typeObjectif, setTypeObjectif] = useState("NB_ACHATS");
  const [seuil, setSeuil] = useState("");
  const [recompensePoints, setRecompensePoints] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim() || !seuil || !recompensePoints || !dateDebut || !dateFin) { toast.error("Tous les champs sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/challenges", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), typeObjectif, seuil: Number(seuil), recompensePoints: Number(recompensePoints), dateDebut, dateFin }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Challenge créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Trophy className="w-5 h-5 text-fuchsia-600" /> Nouveau challenge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Achetez 5 fois ce mois-ci" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Objectif *</span>
              <select value={typeObjectif} onChange={(e) => setTypeObjectif(e.target.value)} className={field}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className={lbl}>Seuil *</span>
              <input type="number" min={1} value={seuil} onChange={(e) => setSeuil(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Récompense (points) *</span>
            <input type="number" min={1} value={recompensePoints} onChange={(e) => setRecompensePoints(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Début *</span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Fin *</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChallengesMarketing() {
  const [rows, setRows] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [classement, setClassement] = useState<Participant[]>([]);
  const [loadingClassement, setLoadingClassement] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/challenges");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const terminer = async (c: Challenge) => {
    const r = await fetch(`/api/admin/marketing/challenges/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "TERMINE" }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success("Challenge terminé"); load();
  };

  const ouvrirClassement = async (c: Challenge) => {
    if (ouvert === c.id) { setOuvert(null); return; }
    setOuvert(c.id); setLoadingClassement(true);
    try {
      const r = await fetch(`/api/admin/marketing/challenges/${c.id}/classement`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setClassement(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingClassement(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Trophy className="w-5 h-5 text-fuchsia-600" /> Challenges</h2>
          <p className="text-sm text-slate-400">{rows.length} challenge(s) — évalués automatiquement chaque jour.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau challenge
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun challenge pour l&apos;instant</p>
        ) : rows.map((c) => (
          <div key={c.id}>
            <button onClick={() => ouvrirClassement(c)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{c.nom}</p>
                <p className="text-xs text-slate-400">
                  {TYPE_LABEL[c.typeObjectif]} ≥ {c.seuil} · {c.recompensePoints} pts · {c._count.participations} participant(s) · {c.nbReussis} réussi(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.statut === "ACTIF" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {c.statut === "ACTIF" ? "Actif" : "Terminé"}
                </span>
                {c.statut === "ACTIF" && (
                  <button onClick={(e) => { e.stopPropagation(); terminer(c); }} title="Terminer" className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
                    <Flag className="w-4 h-4" />
                  </button>
                )}
                {ouvert === c.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === c.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                {loadingClassement ? (
                  <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                ) : classement.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3">Aucun participant pour l&apos;instant</p>
                ) : (
                  <div className="space-y-1.5 pt-2">
                    {classement.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between text-xs text-slate-600">
                        <span>#{i + 1} {p.client.prenom} {p.client.nom}</span>
                        <span className={`font-semibold ${p.statut === "REUSSI" ? "text-emerald-700" : "text-fuchsia-700"}`}>{p.progression} {p.statut === "REUSSI" ? "✓" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouveauChallengeModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
