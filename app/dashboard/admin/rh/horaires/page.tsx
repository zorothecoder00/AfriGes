"use client";

import { useState } from "react";
import {
  ArrowLeft, Plus, RefreshCw, Clock, Edit2, Trash2,
  Star, StarOff, Users, CheckCircle, X, Save,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConfigHoraire {
  id:                    number;
  nom:                   string | null;
  heureArrivee:          string | null;
  heureDepart:           string | null;
  pauseDejeunnerMinutes: number | null;
  dureeJourneeMinutes:   number | null;
  toleranceRetardMin:    number | null;
  joursOuvres:           number[] | null;
  estDefaut:             boolean;
  createdAt:             string;
  _count:                { collaborateurs: number };
}

interface HorairesResponse { data: ConfigHoraire[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const JOURS_NOMS = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function fmtMin(min: number | null) {
  if (min == null) return "—";
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0") : ""}` : `${m}min`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HorairesPage() {
  const [showModal, setShowModal]   = useState(false);
  const [editing,   setEditing]     = useState<ConfigHoraire | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConfigHoraire | null>(null);

  const { data: res, loading, refetch } = useApi<HorairesResponse>("/api/admin/rh/horaires");
  const configs = res?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh/pointages" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Pointages
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Configurations d&apos;horaires</h1>
            <p className="text-sm text-slate-500 mt-0.5">Définissez les plages horaires de référence pour le calcul automatique</p>
          </div>
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Nouvel horaire
          </button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
        ) : configs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
            <Clock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune configuration d&apos;horaires</p>
            <button onClick={() => { setEditing(null); setShowModal(true); }}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700">
              Créer la première config
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {configs.map((cfg) => (
              <ConfigCard
                key={cfg.id}
                cfg={cfg}
                onEdit={() => { setEditing(cfg); setShowModal(true); }}
                onDelete={() => setDeleteTarget(cfg)}
                onToggleDefault={async () => {
                  if (cfg.estDefaut) return;
                  const res2 = await fetch(`/api/admin/rh/horaires/${cfg.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ estDefaut: true }),
                  });
                  if (res2.ok) { toast.success("Horaire défini par défaut"); refetch(); }
                  else { const d = await res2.json(); toast.error(d.error ?? "Erreur"); }
                }}
              />
            ))}
          </div>
        )}

      </div>

      {/* Modal créer / éditer */}
      {showModal && (
        <HoraireModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); refetch(); }}
        />
      )}

      {/* Confirm suppression */}
      {deleteTarget && (
        <ConfirmDelete
          cfg={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Carte config ───────────────────────────────────────────────────────────────

function ConfigCard({ cfg, onEdit, onDelete, onToggleDefault }: {
  cfg:             ConfigHoraire;
  onEdit:          () => void;
  onDelete:        () => void;
  onToggleDefault: () => void;
}) {
  const joursOuvres = (cfg.joursOuvres as number[] | null) ?? [1,2,3,4,5];

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${cfg.estDefaut ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"}`}>
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${cfg.estDefaut ? "bg-emerald-100" : "bg-slate-100"}`}>
          <Clock className={`w-5 h-5 ${cfg.estDefaut ? "text-emerald-600" : "text-slate-500"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900">{cfg.nom ?? "Horaire sans nom"}</h3>
            {cfg.estDefaut && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold rounded-full">
                <Star className="w-3 h-3" /> Par défaut
              </span>
            )}
            {cfg._count.collaborateurs > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-medium rounded-full">
                <Users className="w-3 h-3" /> {cfg._count.collaborateurs} collaborateur{cfg._count.collaborateurs > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Arrivée</span>
              <span className="font-mono font-medium">{cfg.heureArrivee ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Départ</span>
              <span className="font-mono font-medium">{cfg.heureDepart ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Durée</span>
              <span className="font-medium">{fmtMin(cfg.dureeJourneeMinutes)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Pause</span>
              <span className="font-medium">{fmtMin(cfg.pauseDejeunnerMinutes)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Tolérance</span>
              <span className="font-medium">{cfg.toleranceRetardMin != null ? `${cfg.toleranceRetardMin}min` : "—"}</span>
            </div>
            <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400">Jours</span>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7].map((j) => (
                  <span key={j} className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                    joursOuvres.includes(j) ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  }`}>{JOURS_NOMS[j]}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!cfg.estDefaut && (
            <button onClick={onToggleDefault} title="Définir par défaut"
              className="p-1.5 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-500 transition-colors">
              <StarOff className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEdit} title="Modifier"
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Supprimer"
            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal créer / éditer ───────────────────────────────────────────────────────

function HoraireModal({ initial, onClose, onSaved }: {
  initial:  ConfigHoraire | null;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const isEdit = !!initial;

  const [nom,           setNom]           = useState(initial?.nom           ?? "");
  const [heureArrivee,  setHeureArrivee]  = useState(initial?.heureArrivee  ?? "08:00");
  const [heureDepart,   setHeureDepart]   = useState(initial?.heureDepart   ?? "17:00");
  const [pause,         setPause]         = useState(String(initial?.pauseDejeunnerMinutes  ?? 60));
  const [tolerance,     setTolerance]     = useState(String(initial?.toleranceRetardMin     ?? 10));
  const [estDefaut,     setEstDefaut]     = useState(initial?.estDefaut     ?? false);
  const [joursOuvres,   setJoursOuvres]   = useState<number[]>(
    (initial?.joursOuvres as number[] | null) ?? [1,2,3,4,5]
  );
  const [saving, setSaving] = useState(false);

  const toggleJour = (j: number) => {
    setJoursOuvres((prev) => prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j].sort());
  };

  // Calcul duréeJournée auto
  const calcDuree = () => {
    if (!heureArrivee || !heureDepart) return null;
    const [ha, ma] = heureArrivee.split(":").map(Number);
    const [hd, md] = heureDepart.split(":").map(Number);
    const p = Number(pause) || 0;
    const d = (hd * 60 + md) - (ha * 60 + ma) - p;
    return d > 0 ? d : null;
  };

  const dureeAuto = calcDuree();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        nom:                   nom       || null,
        heureArrivee:          heureArrivee || null,
        heureDepart:           heureDepart  || null,
        pauseDejeunnerMinutes: Number(pause)     || null,
        toleranceRetardMin:    Number(tolerance) || null,
        joursOuvres,
        estDefaut,
      };

      const url    = isEdit ? `/api/admin/rh/horaires/${initial!.id}` : "/api/admin/rh/horaires";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success(isEdit ? "Config mise à jour" : "Config créée");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">{isEdit ? "Modifier l'horaire" : "Nouvel horaire"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom de la configuration</label>
            <input type="text" value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="Ex: Standard bureau, Équipe du matin…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {/* Heures */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heure d&apos;arrivée</label>
              <input type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heure de départ</label>
              <input type="time" value={heureDepart} onChange={(e) => setHeureDepart(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Durée calculée automatiquement */}
          {dureeAuto && (
            <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Durée calculée automatiquement : <strong>{fmtMin(dureeAuto)}</strong> (après {Number(pause) || 0}min de pause)
            </p>
          )}

          {/* Pause & Tolérance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pause déjeuner (min)</label>
              <input type="number" min="0" max="180" value={pause} onChange={(e) => setPause(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tolérance retard (min)</label>
              <input type="number" min="0" max="60" value={tolerance} onChange={(e) => setTolerance(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Jours ouvrés */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jours ouvrés</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5,6,7].map((j) => (
                <button key={j} type="button" onClick={() => toggleJour(j)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    joursOuvres.includes(j)
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}>
                  {JOURS_NOMS[j]}
                </button>
              ))}
            </div>
          </div>

          {/* Par défaut */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${estDefaut ? "bg-emerald-500" : "bg-slate-200"}`}
              onClick={() => setEstDefaut((v) => !v)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${estDefaut ? "left-5" : "left-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Horaire par défaut</p>
              <p className="text-xs text-slate-400">Appliqué aux nouveaux collaborateurs sans config</p>
            </div>
          </label>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Confirm suppression ────────────────────────────────────────────────────────

function ConfirmDelete({ cfg, onCancel, onDeleted }: {
  cfg:      ConfigHoraire;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/rh/horaires/${cfg.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Config supprimée");
      onDeleted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-100 rounded-xl"><Trash2 className="w-5 h-5 text-red-600" /></div>
          <h2 className="text-base font-semibold text-slate-900">Supprimer la configuration</h2>
        </div>
        <p className="text-sm text-slate-600">
          Voulez-vous supprimer <strong>«{cfg.nom ?? "cette config"}»</strong> ?
          {cfg._count.collaborateurs > 0 && (
            <span className="block mt-1 text-red-600">
              Cette config est utilisée par {cfg._count.collaborateurs} collaborateur(s). La suppression sera bloquée.
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
