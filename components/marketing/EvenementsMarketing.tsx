"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CalendarDays, Plus, Loader2, X, ChevronDown, ChevronUp, UserPlus, UserCheck } from "lucide-react";

/** Événements marketing (CDC §42). */

interface Participant { id: number; nom: string; telephone: string | null; email: string | null; statut: string; client: { id: number; nom: string; prenom: string } | null }
interface Evenement {
  id: number; nom: string; lieu: string | null; dateDebut: string; dateFin: string; budget: number; statut: string;
  campagne: { id: number; code: string; nom: string } | null;
  _count: { participants: number; soumissions: number };
  nbPresents: number;
}
interface Campagne { id: number; code: string; nom: string }

const STATUT_LABEL: Record<string, string> = { PLANIFIE: "Planifié", EN_COURS: "En cours", TERMINE: "Terminé", ANNULE: "Annulé" };
const STATUT_STYLE: Record<string, string> = {
  PLANIFIE: "bg-blue-100 text-blue-700", EN_COURS: "bg-emerald-100 text-emerald-700",
  TERMINE: "bg-slate-100 text-slate-500", ANNULE: "bg-rose-100 text-rose-600",
};
const PARTICIPANT_STATUT_LABEL: Record<string, string> = { INVITE: "Invité", INSCRIT: "Inscrit", PRESENT: "Présent", ABSENT: "Absent" };

function NouvelEvenementModal({ campagnes, onClose, onCreated }: { campagnes: Campagne[]; onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [campagneId, setCampagneId] = useState("");
  const [lieu, setLieu] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim() || !dateDebut || !dateFin) { toast.error("Nom et période sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/evenements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), campagneId: campagneId ? Number(campagneId) : null, lieu: lieu.trim() || null, dateDebut, dateFin, budget: Number(budget) || 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Événement créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-fuchsia-600" /> Nouvel événement</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Journée portes ouvertes Lomé" className={field} />
          </label>
          <label className="block"><span className={lbl}>Campagne (optionnel)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <label className="block"><span className={lbl}>Lieu</span>
            <input value={lieu} onChange={(e) => setLieu(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Début *</span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Fin *</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Budget (FCFA)</span>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantsPanel({ evenementId }: { evenementId: number }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/marketing/evenements/${evenementId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setParticipants(j.data.participants);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [evenementId]);

  useEffect(() => { load(); }, [load]);

  const ajouter = async () => {
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    setAdding(true);
    try {
      const r = await fetch(`/api/admin/marketing/evenements/${evenementId}/participants`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: nom.trim(), telephone: telephone.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setNom(""); setTelephone(""); toast.success("Participant ajouté"); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setAdding(false); }
  };

  const changerStatut = async (p: Participant, statut: string) => {
    const r = await fetch(`/api/admin/marketing/evenements/${evenementId}/participants/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    load();
  };

  const convertir = async (p: Participant) => {
    const r = await fetch(`/api/admin/marketing/evenements/${evenementId}/participants/${p.id}/convertir`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success("Client créé ✓"); load();
  };

  const field = "px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white";

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className={field} />
        <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className={field} />
        <button onClick={ajouter} disabled={adding} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Ajouter
        </button>
      </div>
      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
      ) : participants.length === 0 ? (
        <p className="text-xs text-slate-400">Aucun participant pour l&apos;instant</p>
      ) : (
        <div className="space-y-1.5">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
              <span className="text-slate-700">{p.nom}{p.telephone ? ` · ${p.telephone}` : ""}{p.client ? " · Client" : ""}</span>
              <div className="flex items-center gap-2">
                <select value={p.statut} onChange={(e) => changerStatut(p, e.target.value)} className="text-[11px] border border-slate-200 rounded px-1 py-0.5">
                  {Object.entries(PARTICIPANT_STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {!p.client && (
                  <button onClick={() => convertir(p)} title="Convertir en client" className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50">
                    <UserCheck className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EvenementsMarketing() {
  const [rows, setRows] = useState<Evenement[]>([]);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/evenements");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-fuchsia-600" /> Événements</h2>
          <p className="text-sm text-slate-400">{rows.length} événement(s).</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouvel événement
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun événement pour l&apos;instant</p>
        ) : rows.map((e) => (
          <div key={e.id}>
            <button onClick={() => setOuvert(ouvert === e.id ? null : e.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{e.nom}</p>
                <p className="text-xs text-slate-400">{e.lieu ?? "—"} · {e._count.participants} participant(s) · {e.nbPresents} présent(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_STYLE[e.statut]}`}>{STATUT_LABEL[e.statut]}</span>
                {ouvert === e.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>
            {ouvert === e.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                <ParticipantsPanel evenementId={e.id} />
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouvelEvenementModal campagnes={campagnes} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
