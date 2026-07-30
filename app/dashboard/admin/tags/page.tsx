"use client";

import React, { useState } from "react";
import { Tag, Plus, Pencil, Trash2, Loader2, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import ClienteleTabBar from "@/components/ClienteleTabBar";
import { useTagModal } from "@/contexts/TagModalContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

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
const SEGMENT_BADGE_VARIANT: Record<string, "neutral" | "indigo"> = {
  ORDINAIRE: "neutral",
  RIA:       "indigo",
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
    <Modal open onClose={onClose} title={isEdit ? "Modifier le tag" : "Nouveau tag"} size="sm">
      <div className="space-y-4">
        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom *</label>
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
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Couleur</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COULEURS_PRESET.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCouleur(c)}
                className={`w-7 h-7 rounded-full transition-transform ${couleur === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"}`}
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
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Segment */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Segment applicable</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tous les segments</option>
            <option value="ORDINAIRE">Clients ordinaires uniquement</option>
            <option value="RIA">Clients RIA uniquement</option>
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Laisser vide pour appliquer ce tag à n&apos;importe quel client.
          </p>
        </div>

        {/* Actif (édition seulement) */}
        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setActif((v) => !v)}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${actif ? "bg-primary-500" : "bg-slate-200"}`}
            >
              <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${actif ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-slate-700">Tag {actif ? "actif" : "inactif"}</span>
          </label>
        )}
      </div>

      <div className="flex gap-3 pt-6">
        <Button variant="secondary" className="flex-1" onClick={onClose}>
          Annuler
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={handleSubmit}
          loading={loading}
          icon={<CheckCircle2 size={16} />}
        >
          {isEdit ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TagsPage() {
  const tagModal = useTagModal();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/20 to-purple-50/10 ">
      <ClienteleTabBar>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Tags clients</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {tags.length} tag{tags.length !== 1 ? "s" : ""}
              {!showInactifs && " actif" + (tags.length !== 1 ? "s" : "")}
            </p>
          </div>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setModalTag("new")}>
            Nouveau tag
          </Button>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Segment :</span>
          {(["", "ORDINAIRE", "RIA"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filterSegment === s ? "primary" : "secondary"}
              onClick={() => setFilterSegment(s)}
            >
              {s === "" ? "Tous" : s === "ORDINAIRE" ? "Ordinaire" : "RIA"}
            </Button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-500">
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
            <Loader2 className="w-7 h-7 animate-spin text-primary-400" />
          </div>
        ) : tags.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Aucun tag pour le moment</p>
            <p className="text-slate-400 text-sm mt-1">Créez votre premier tag pour organiser vos clients.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md ${
                  tag.actif ? "border-slate-100" : "border-dashed border-slate-200 opacity-60"
                }`}
              >
                {/* Badge + nom */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={() => tag._count.clients > 0 && tagModal?.openTag({ id: tag.id, nom: tag.nom, couleur: tag.couleur })}
                      className={`px-3 py-1.5 rounded-full text-white text-xs font-bold transition-opacity ${tag._count.clients > 0 ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                      style={{ backgroundColor: tag.couleur }}
                      title={tag._count.clients > 0 ? `Voir les ${tag._count.clients} clients` : "Aucun client"}
                    >
                      {tag.nom}
                    </button>
                    {!tag.actif && (
                      <span className="text-xs text-slate-400 italic">inactif</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModalTag(tag)}
                      title="Modifier"
                      icon={<Pencil className="w-3.5 h-3.5" />}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTag(tag)}
                      title="Supprimer"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>

                {/* Description */}
                {tag.description && (
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{tag.description}</p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => tag._count.clients > 0 && tagModal?.openTag({ id: tag.id, nom: tag.nom, couleur: tag.couleur })}
                    disabled={tag._count.clients === 0}
                    className={`flex items-center gap-1 text-xs transition-colors ${tag._count.clients > 0 ? "text-primary-600 hover:text-primary-800 hover:underline cursor-pointer" : "text-slate-400 cursor-default"}`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{tag._count.clients} client{tag._count.clients !== 1 ? "s" : ""}</span>
                  </button>
                  {tag.segment ? (
                    <Badge variant={SEGMENT_BADGE_VARIANT[tag.segment]}>
                      {SEGMENT_LABELS[tag.segment]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">Tous segments</span>
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
      <Modal open={!!deleteTag} onClose={() => setDeleteTag(null)} size="sm">
        {deleteTag && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Supprimer le tag</h3>
                <p className="text-sm text-slate-500">Cette action est irréversible.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">
              Supprimer <strong>&ldquo;{deleteTag.nom}&rdquo;</strong> ?
              {deleteTag._count.clients > 0 && (
                <span className="block mt-1 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Ce tag est assigné à <strong>{deleteTag._count.clients}</strong> client(s) — ils seront automatiquement mis à jour.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTag(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={handleDelete}
                loading={deleteLoading}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>
      </ClienteleTabBar>
    </div>
  );
}
