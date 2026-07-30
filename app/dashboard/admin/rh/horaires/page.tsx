"use client";

import { useState } from "react";
import {
  ArrowLeft, Plus, RefreshCw, Clock, Edit2, Trash2,
  Star, StarOff, Users, CheckCircle, Save,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh/pointages" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-2">
              <ArrowLeft size={15} /> Pointages
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Configurations d&apos;horaires</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Définissez les plages horaires de référence pour le calcul automatique</p>
          </div>
          <Button onClick={() => { setEditing(null); setShowModal(true); }} icon={<Plus className="w-4 h-4" />}>
            Nouvel horaire
          </Button>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400 dark:text-slate-500"><RefreshCw className="w-6 h-6 animate-spin" /></div>
        ) : configs.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center py-16 text-slate-400 dark:text-slate-500">
            <Clock className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune configuration d&apos;horaires</p>
            <Button onClick={() => { setEditing(null); setShowModal(true); }} className="mt-4" size="sm">
              Créer la première config
            </Button>
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
    <div className={`bg-white dark:bg-slate-800 rounded-2xl border shadow-sm overflow-hidden ${cfg.estDefaut ? "border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-200 dark:ring-emerald-800" : "border-slate-200 dark:border-slate-700"}`}>
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${cfg.estDefaut ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-slate-100 dark:bg-slate-700"}`}>
          <Clock className={`w-5 h-5 ${cfg.estDefaut ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cfg.nom ?? "Horaire sans nom"}</h3>
            {cfg.estDefaut && <Badge variant="success" icon={<Star className="w-3 h-3" />}>Par défaut</Badge>}
            {cfg._count.collaborateurs > 0 && (
              <Badge variant="neutral" icon={<Users className="w-3 h-3" />}>
                {cfg._count.collaborateurs} collaborateur{cfg._count.collaborateurs > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">Arrivée</span>
              <span className="font-mono font-medium">{cfg.heureArrivee ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">Départ</span>
              <span className="font-mono font-medium">{cfg.heureDepart ?? "—"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">Durée</span>
              <span className="font-medium">{fmtMin(cfg.dureeJourneeMinutes)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">Pause</span>
              <span className="font-medium">{fmtMin(cfg.pauseDejeunnerMinutes)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-slate-500">Tolérance</span>
              <span className="font-medium">{cfg.toleranceRetardMin != null ? `${cfg.toleranceRetardMin}min` : "—"}</span>
            </div>
            <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-400 dark:text-slate-500">Jours</span>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7].map((j) => (
                  <span key={j} className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                    joursOuvres.includes(j) ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
                  }`}>{JOURS_NOMS[j]}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!cfg.estDefaut && (
            <button onClick={onToggleDefault} title="Définir par défaut"
              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-500 transition-colors">
              <StarOff className="w-4 h-4" />
            </button>
          )}
          <button onClick={onEdit} title="Modifier"
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Supprimer"
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors">
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
    <Modal open onClose={onClose} title={isEdit ? "Modifier l'horaire" : "Nouvel horaire"} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nom de la configuration"
            type="text" value={nom} onChange={(e) => setNom(e.target.value)}
            placeholder="Ex: Standard bureau, Équipe du matin…"
          />

          {/* Heures */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Heure d'arrivée" type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)} />
            <Input label="Heure de départ" type="time" value={heureDepart} onChange={(e) => setHeureDepart(e.target.value)} />
          </div>

          {/* Durée calculée automatiquement */}
          {dureeAuto && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Durée calculée automatiquement : <strong>{fmtMin(dureeAuto)}</strong> (après {Number(pause) || 0}min de pause)
            </p>
          )}

          {/* Pause & Tolérance */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pause déjeuner (min)" type="number" min="0" max="180" value={pause} onChange={(e) => setPause(e.target.value)} />
            <Input label="Tolérance retard (min)" type="number" min="0" max="60" value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
          </div>

          {/* Jours ouvrés */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Jours ouvrés</label>
            <div className="flex gap-1.5">
              {[1,2,3,4,5,6,7].map((j) => (
                <button key={j} type="button" onClick={() => toggleJour(j)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    joursOuvres.includes(j)
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}>
                  {JOURS_NOMS[j]}
                </button>
              ))}
            </div>
          </div>

          {/* Par défaut */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-10 h-5 rounded-full transition-colors ${estDefaut ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
              onClick={() => setEstDefaut((v) => !v)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${estDefaut ? "left-5" : "left-0.5"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Horaire par défaut</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Appliqué aux nouveaux collaborateurs sans config</p>
            </div>
          </label>

          {/* Boutons */}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 justify-center">
              Annuler
            </Button>
            <Button type="submit" disabled={saving} loading={saving} icon={<Save className="w-4 h-4" />} className="flex-1 justify-center">
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </form>
    </Modal>
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
    <Modal open onClose={onCancel} size="sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl"><Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Supprimer la configuration</h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Voulez-vous supprimer <strong>«{cfg.nom ?? "cette config"}»</strong> ?
          {cfg._count.collaborateurs > 0 && (
            <span className="block mt-1 text-red-600 dark:text-red-400">
              Cette config est utilisée par {cfg._count.collaborateurs} collaborateur(s). La suppression sera bloquée.
            </span>
          )}
        </p>
        <div className="flex gap-2 pt-4">
          <Button variant="secondary" onClick={onCancel} className="flex-1 justify-center">
            Annuler
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={loading} loading={loading} icon={<Trash2 className="w-4 h-4" />} className="flex-1 justify-center">
            Supprimer
          </Button>
        </div>
    </Modal>
  );
}
