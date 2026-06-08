"use client";

import React, { useState } from "react";
import { Tag, Plus, Pencil, Trash2, X, Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import MessagesLink from "@/components/MessagesLink";
import ClienteleTabBar from "@/components/ClienteleTabBar";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TagData {
  id: number;
  nom: string;
  couleur: string;
  description: string | null;
  segment: "ORDINAIRE" | "RIA" | null;
  actif: boolean;
  createdAt: string;
  _count: { clients: number };
}

interface TagsResponse { data: TagData[] }

// ─── Palette de couleurs prédéfinies ──────────────────────────────────────────

const COULEURS_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#64748b", "#1e293b",
];

const SEGMENT_LABELS: Record<string, string> = {
  ORDINAIRE: "Ordinaire uniquement",
  RIA:       "RIA uniquement",
};
const SEGMENT_STYLE: Record<string, string> = {
  ORDINAIRE: "bg-slate-100 text-slate-600",
  RIA:       "bg-indigo-100 text-indigo-700",
};

// ─── Modal création/édition ────────────────────────────────────────────────────

function TagModal({
  tag,
  onClose,
  onSuccess,
}: {
  tag?: TagData;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!tag;
  const [nom,         setNom]         = useState(tag?.nom         ?? "");
  const [couleur,     setCouleur]      = useState(tag?.couleur     ?? "#6366f1");
  const [description, setDescription] = useState(tag?.description ?? "");
  const [segment,     setSegment]      = useState<string>(tag?.segment ?? "");
  const [actif,       setActif]        = useState(tag?.actif ?? true);
  const [loading,     setLoading]      = useState(false);

  const handleSubmit = async () => {
    if (!nom.trim()) return toast.error("Le nom est obligatoire");
    setLoading(true);
    try {
      const url    = isEdit ? `/api/admin/tags/${tag!.id}` : "/api/admin/tags";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom:         nom.trim(),
          couleur,
          description: description || null,
          segment:     segment     || null,
          ...(isEdit && { actif }),
        }),
      });
      const j = await r.json();
      if (r.ok) {
        toast.success(isEdit ? "Tag modifié" : "Tag créé");
        onSuccess();
      } else {
        toast.error(j.error ?? "Erreur");
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? "Modifier le tag" : "Nouveau tag"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom *</label>
            <div className="flex items-center gap-2">
              {/* Preview badge */}
              <span
                className="px-3 py-1.5 rounded-full text-white text-xs font-semibold whitespace-nowrap"
                style={{ backgroundColor: couleur }}
              >
                {nom || "Aperçu"}
              </span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="ex. VIP, Fidèle, Nouveau…"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Couleur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Couleur</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COULEURS_PRESET.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCouleur(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${couleur === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={couleur}
                onChange={(e) => setCouleur(e.target.value)}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0"
                title="Couleur personnalisée"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Segment applicable</label>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les segments</option>
              <option value="ORDINAIRE">Clients ordinaires uniquement</option>
              <option value="RIA">Clients RIA uniquement</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Laisser vide pour appliquer ce tag à n&apos;importe quel client.
            </p>
          </div>

          {/* Actif (édition seulement) */}
          {isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setActif((v) => !v)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${actif ? "bg-indigo-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${actif ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <span className="text-sm text-gray-700">Tag {actif ? "actif" : "inactif"}</span>
            </label>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const [filterSegment, setFilterSegment] = useState("");
  const [showInactifs,  setShowInactifs]  = useState(false);

  const url = `/api/admin/tags${filterSegment ? `?segment=${filterSegment}` : ""}`;
  const { data, loading, refetch } = useApi<TagsResponse>(url);
  const tags = (data?.data ?? []).filter((t) => showInactifs || t.actif);

  const [modalTag,     setModalTag]     = useState<TagData | "new" | null>(null);
  const [deleteTag,    setDeleteTag]    = useState<TagData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    if (!deleteTag) return;
    setDeleteLoading(true);
    try {
      const r = await fetch(`/api/admin/tags/${deleteTag.id}`, { method: "DELETE" });
      const j = await r.json();
      if (r.ok) {
        toast.success(
          j.clientsAffectes > 0
            ? `Tag supprimé — ${j.clientsAffectes} client(s) mis à jour`
            : "Tag supprimé"
        );
        setDeleteTag(null);
        refetch();
      } else {
        toast.error(j.error ?? "Erreur");
      }
    } finally { setDeleteLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-purple-50/10 font-['DM_Sans',sans-serif]">
      <ClienteleTabBar />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Tags clients</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {tags.length} tag{tags.length !== 1 ? "s" : ""}
              {!showInactifs && " actif" + (tags.length !== 1 ? "s" : "")}
            </p>
          </div>
          <button
            onClick={() => setModalTag("new")}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            <Plus className="w-4 h-4" /> Nouveau tag
          </button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Segment :</span>
          {(["", "ORDINAIRE", "RIA"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterSegment(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterSegment === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {s === "" ? "Tous" : s === "ORDINAIRE" ? "Ordinaire" : "RIA"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-500">
              <input
                type="checkbox"
                checked={showInactifs}
                onChange={(e) => setShowInactifs(e.target.checked)}
                className="rounded"
              />
              Afficher les inactifs
            </label>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
          </div>
        ) : tags.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucun tag pour le moment</p>
            <p className="text-gray-400 text-sm mt-1">Créez votre premier tag pour organiser vos clients.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md ${
                  tag.actif ? "border-gray-100" : "border-dashed border-gray-200 opacity-60"
                }`}
              >
                {/* Badge + nom */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="px-3 py-1.5 rounded-full text-white text-xs font-bold"
                      style={{ backgroundColor: tag.couleur }}
                    >
                      {tag.nom}
                    </span>
                    {!tag.actif && (
                      <span className="text-xs text-gray-400 italic">inactif</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setModalTag(tag)}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTag(tag)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {tag.description && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tag.description}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{tag._count.clients} client{tag._count.clients !== 1 ? "s" : ""}</span>
                  </div>
                  {tag.segment ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEGMENT_STYLE[tag.segment]}`}>
                      {SEGMENT_LABELS[tag.segment]}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Tous segments</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal création / édition */}
      {modalTag !== null && (
        <TagModal
          tag={modalTag === "new" ? undefined : modalTag}
          onClose={() => setModalTag(null)}
          onSuccess={() => { setModalTag(null); refetch(); }}
        />
      )}

      {/* Modal confirmation suppression */}
      {deleteTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Supprimer le tag</h3>
                <p className="text-sm text-gray-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700">
              Supprimer <strong>&ldquo;{deleteTag.nom}&rdquo;</strong> ?
              {deleteTag._count.clients > 0 && (
                <span className="block mt-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Ce tag est assigné à <strong>{deleteTag._count.clients}</strong> client(s) — ils seront automatiquement mis à jour.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTag(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
