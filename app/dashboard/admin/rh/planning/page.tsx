"use client";

import { useState } from "react";
import {
  ArrowLeft, RefreshCw, Plus, X, Save, Trash2, CalendarDays,
  Users, Send, Undo2, Info,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlanningListItem {
  id:           number;
  semaineDebut: string;
  statut:       string;
  notes:        string | null;
  _count:       { affectations: number };
}

interface Affectation {
  id:         number;
  date:       string;
  heureDebut: string;
  heureFin:   string;
  role:       string | null;
  notes:      string | null;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } };
  };
}

interface PlanningDetail extends PlanningListItem {
  affectations: Affectation[];
}

interface CollabsRes {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function semaineLabel(semaineDebut: string) {
  const d1 = new Date(semaineDebut);
  const d2 = new Date(d1); d2.setDate(d1.getDate() + 6);
  return `${formatDate(d1.toISOString())} → ${formatDate(d2.toISOString())}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PlanningEquipePage() {
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, loading, refetch } = useApi<{ data: PlanningListItem[] }>("/api/admin/rh/planning?limit=30");
  const plannings = data?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Planning d&apos;équipe</h1>
            <p className="text-sm text-slate-500 mt-0.5">Roulement hebdomadaire des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> Nouveau planning
            </button>
          </div>
        </div>

        <div className="flex items-start gap-3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p>Indépendant des horaires de référence individuels (onglet Horaires) — ce planning gère l&apos;affectation d&apos;équipe semaine par semaine. Un planning n&apos;est visible des collaborateurs qu&apos;une fois <strong>publié</strong>.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : plannings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
            <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun planning d&apos;équipe créé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plannings.map((p) => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-indigo-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800">{semaineLabel(p.semaineDebut)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.statut === "PUBLIE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.statut === "PUBLIE" ? "Publié" : "Brouillon"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p._count.affectations} affectation{p._count.affectations > 1 ? "s" : ""}</p>
                {p.notes && <p className="text-xs text-slate-400 mt-1 truncate">{p.notes}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      {showNew && <NewPlanningModal onClose={() => setShowNew(false)} onCreated={(id) => { setShowNew(false); refetch(); setSelectedId(id); }} />}
      {selectedId !== null && (
        <PlanningDetailModal planningId={selectedId} onClose={() => setSelectedId(null)} onUpdated={refetch} />
      )}
    </div>
  );
}

// ── Modal nouveau planning ──────────────────────────────────────────────────────

function NewPlanningModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { mutate, loading } = useMutation<{ data: { id: number } }>("/api/admin/rh/planning", "POST");
  const [semaineDebut, setSemaineDebut] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!semaineDebut) { toast.error("Date de début de semaine requise"); return; }
    const result = await mutate({ semaineDebut, notes: notes || undefined });
    if (result) {
      toast.success("Planning créé");
      onCreated(result.data.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau planning d&apos;équipe</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Lundi de la semaine *</label>
            <input type="date" value={semaineDebut} onChange={(e) => setSemaineDebut(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail planning ────────────────────────────────────────────────────────

function PlanningDetailModal({ planningId, onClose, onUpdated }: { planningId: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: PlanningDetail }>(`/api/admin/rh/planning/${planningId}`);
  const { mutate: mutatePlanning, loading: savingPlanning } = useMutation(`/api/admin/rh/planning/${planningId}`, "PATCH");
  const { mutate: deletePlanning } = useMutation(`/api/admin/rh/planning/${planningId}`, "DELETE");
  const { mutate: addAffectation, loading: adding } = useMutation(`/api/admin/rh/planning/${planningId}/affectations`, "POST");
  const { data: collabRes } = useApi<CollabsRes>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ profilRHId: "", date: "", heureDebut: "08:00", heureFin: "17:00", role: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const planning = data?.data;

  const handlePublier = async () => {
    const result = await mutatePlanning({ action: planning?.statut === "PUBLIE" ? "REPASSER_BROUILLON" : "PUBLIER" });
    if (result) { toast.success(planning?.statut === "PUBLIE" ? "Planning repassé en brouillon" : "Planning publié"); refetch(); onUpdated(); }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce planning et toutes ses affectations ?")) return;
    const result = await deletePlanning({});
    if (result) { toast.success("Planning supprimé"); onUpdated(); onClose(); }
  };

  const handleAdd = async () => {
    if (!form.profilRHId || !form.date || !form.heureDebut || !form.heureFin) {
      toast.error("Collaborateur, date et horaires requis"); return;
    }
    const result = await addAffectation({
      profilRHId: Number(form.profilRHId), date: form.date,
      heureDebut: form.heureDebut, heureFin: form.heureFin, role: form.role || undefined,
    });
    if (result) { toast.success("Affectation ajoutée"); setForm({ profilRHId: "", date: "", heureDebut: "08:00", heureFin: "17:00", role: "" }); setShowAdd(false); refetch(); }
  };

  // Grouper les affectations par jour
  const parJour = new Map<string, Affectation[]>();
  (planning?.affectations ?? []).forEach((a) => {
    const key = a.date.slice(0, 10);
    const list = parJour.get(key) ?? [];
    list.push(a);
    parJour.set(key, list);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{planning ? semaineLabel(planning.semaineDebut) : "Planning"}</h2>
            {planning && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${planning.statut === "PUBLIE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {planning.statut === "PUBLIE" ? "Publié" : "Brouillon"}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !planning ? (
            <div className="flex justify-center py-10 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              {!showAdd && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <Plus className="w-4 h-4" /> Ajouter une affectation
                </button>
              )}

              {showAdd && (
                <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                  <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">— Collaborateur —</option>
                    {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="date" value={form.date}
                      min={planning.semaineDebut.slice(0, 10)}
                      onChange={(e) => set("date", e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="time" value={form.heureDebut} onChange={(e) => set("heureDebut", e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="time" value={form.heureFin} onChange={(e) => set("heureFin", e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Rôle / poste (facultatif)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
                    <button onClick={handleAdd} disabled={adding}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {adding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Ajouter
                    </button>
                  </div>
                </div>
              )}

              {parJour.size === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Aucune affectation pour ce planning.</p>
              ) : (
                <div className="space-y-4">
                  {Array.from(parJour.entries()).map(([jour, affs]) => (
                    <div key={jour}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">
                        {JOURS[(new Date(jour).getDay() + 6) % 7]} {formatDate(jour)}
                      </p>
                      <div className="space-y-1.5">
                        {affs.map((a) => (
                          <AffectationRow key={a.id} affectation={a} planningId={planningId} onChanged={refetch} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={handleDelete} disabled={planning?.statut === "PUBLIE"}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed">
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
          <button onClick={handlePublier} disabled={savingPlanning || !planning}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {savingPlanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : planning?.statut === "PUBLIE" ? <Undo2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {planning?.statut === "PUBLIE" ? "Repasser en brouillon" : "Publier"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AffectationRow({ affectation: a, planningId, onChanged }: { affectation: Affectation; planningId: number; onChanged: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/planning/${planningId}/affectations/${a.id}`, "DELETE");
  const member = a.profilRH.gestionnaire.member;

  const handleDelete = async () => {
    const result = await mutate({});
    if (result) { toast.success("Affectation supprimée"); onChanged(); }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</span>
        <span className="text-xs text-slate-400 ml-2">{a.heureDebut} – {a.heureFin}</span>
        {a.role && <span className="text-xs text-slate-500 ml-2">· {a.role}</span>}
      </div>
      <button onClick={handleDelete} disabled={loading} className="text-slate-300 hover:text-red-400 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
