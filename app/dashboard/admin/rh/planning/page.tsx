"use client";

import { useState } from "react";
import {
  RefreshCw, Plus, Save, Trash2, CalendarDays,
  Users, Send, Undo2, Info,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

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
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Planning d&apos;équipe</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Roulement hebdomadaire des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
            <Button onClick={() => setShowNew(true)} icon={<Plus className="w-4 h-4" />}>
              Nouveau planning
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-3 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl text-xs text-primary-800 dark:text-primary-200">
          <Info className="w-4 h-4 text-primary-500 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <p>Indépendant des horaires de référence individuels (onglet Horaires) — ce planning gère l&apos;affectation d&apos;équipe semaine par semaine. Un planning n&apos;est visible des collaborateurs qu&apos;une fois <strong>publié</strong>.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : plannings.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun planning d&apos;équipe créé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plannings.map((p) => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{semaineLabel(p.semaineDebut)}</span>
                  <Badge variant={p.statut === "PUBLIE" ? "success" : "warning"}>
                    {p.statut === "PUBLIE" ? "Publié" : "Brouillon"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p._count.affectations} affectation{p._count.affectations > 1 ? "s" : ""}</p>
                {p.notes && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">{p.notes}</p>}
              </button>
            ))}
          </div>
        )}

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
    <Modal open onClose={onClose} title="Nouveau planning d'équipe" size="sm">
      <div className="space-y-4">
        <Input type="date" label="Lundi de la semaine *" value={semaineDebut} onChange={(e) => setSemaineDebut(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} disabled={loading} loading={loading} icon={<Save className="w-4 h-4" />}>Créer</Button>
      </div>
    </Modal>
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
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={planning ? semaineLabel(planning.semaineDebut) : "Planning"}
    >
      <div className="space-y-4">
          {planning && (
            <Badge variant={planning.statut === "PUBLIE" ? "success" : "warning"}>
              {planning.statut === "PUBLIE" ? "Publié" : "Brouillon"}
            </Badge>
          )}

          {loading || !planning ? (
            <div className="flex justify-center py-10 text-slate-400 dark:text-slate-500"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              {!showAdd && (
                <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                  <Plus className="w-4 h-4" /> Ajouter une affectation
                </button>
              )}

              {showAdd && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-3">
                  <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500">
                    <option value="">— Collaborateur —</option>
                    {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
                  </select>
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="date" value={form.date}
                      min={planning.semaineDebut.slice(0, 10)}
                      onChange={(e) => set("date", e.target.value)} />
                    <Input type="time" value={form.heureDebut} onChange={(e) => set("heureDebut", e.target.value)} />
                    <Input type="time" value={form.heureFin} onChange={(e) => set("heureFin", e.target.value)} />
                  </div>
                  <Input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Rôle / poste (facultatif)" />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
                    <Button size="sm" onClick={handleAdd} disabled={adding} loading={adding} icon={<Save className="w-3.5 h-3.5" />}>Ajouter</Button>
                  </div>
                </div>
              )}

              {parJour.size === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">Aucune affectation pour ce planning.</p>
              ) : (
                <div className="space-y-4">
                  {Array.from(parJour.entries()).map(([jour, affs]) => (
                    <div key={jour}>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
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

      <div className="flex justify-between gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={planning?.statut === "PUBLIE"}
          icon={<Trash2 className="w-4 h-4" />}
        >
          Supprimer
        </Button>
        <Button
          onClick={handlePublier}
          disabled={savingPlanning || !planning}
          loading={savingPlanning}
          icon={planning?.statut === "PUBLIE" ? <Undo2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
        >
          {planning?.statut === "PUBLIE" ? "Repasser en brouillon" : "Publier"}
        </Button>
      </div>
    </Modal>
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
    <div className="flex items-center gap-3 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.prenom} {member.nom}</span>
        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">{a.heureDebut} – {a.heureFin}</span>
        {a.role && <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">· {a.role}</span>}
      </div>
      <button onClick={handleDelete} disabled={loading} className="text-slate-300 dark:text-slate-600 hover:text-red-400 flex-shrink-0">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
