"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Pencil, Trash2, RefreshCw, ClipboardList,
  GripVertical, CheckCircle2, ChevronDown, ChevronUp,
  Save, X, ToggleLeft, ToggleRight, AlertTriangle,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────────────── */
type TypeEtape =
  | "SIGNATURE_CONTRAT" | "REMISE_MATERIEL" | "FORMATION"
  | "AFFECTATION" | "ACCES_SYSTEME" | "PRESENTATION" | "AUTRE";

interface EtapeTemplate {
  id?: number;
  ordre: number;
  titre: string;
  description: string;
  type: TypeEtape;
  delaiJours: number;
  obligatoire: boolean;
}

interface Template {
  id: number;
  nom: string;
  description: string | null;
  actif: boolean;
  etapes: EtapeTemplate[];
  _count: { onboardings: number };
}

/* ─── Constantes ─────────────────────────────────────────────── */
const TYPES_ETAPE: { value: TypeEtape; label: string }[] = [
  { value: "SIGNATURE_CONTRAT", label: "Signature contrat"   },
  { value: "REMISE_MATERIEL",   label: "Remise matériel"     },
  { value: "FORMATION",         label: "Formation"           },
  { value: "AFFECTATION",       label: "Affectation"         },
  { value: "ACCES_SYSTEME",     label: "Accès système"       },
  { value: "PRESENTATION",      label: "Présentation équipe" },
  { value: "AUTRE",             label: "Autre"               },
];

const TYPE_COLOR: Record<TypeEtape, string> = {
  SIGNATURE_CONTRAT: "text-purple-600 bg-purple-50",
  REMISE_MATERIEL:   "text-orange-600 bg-orange-50",
  FORMATION:         "text-blue-600 bg-blue-50",
  AFFECTATION:       "text-teal-600 bg-teal-50",
  ACCES_SYSTEME:     "text-gray-600 bg-gray-100",
  PRESENTATION:      "text-pink-600 bg-pink-50",
  AUTRE:             "text-gray-500 bg-gray-50",
};

const ETAPE_DEFAUT: EtapeTemplate = {
  ordre: 1, titre: "", description: "",
  type: "AUTRE", delaiJours: 7, obligatoire: true,
};

/* ─── Composant formulaire d'étape ───────────────────────────── */
function EtapeRow({
  etape, index, total,
  onChange, onRemove, onMoveUp, onMoveDown,
}: {
  etape: EtapeTemplate;
  index: number;
  total: number;
  onChange: (e: EtapeTemplate) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex gap-2 items-start p-3 bg-gray-50 rounded-xl border border-gray-200">
      {/* Ordre + drag handle */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <span className="text-xs font-bold text-gray-400 w-5 text-center">{index + 1}</span>
        <button onClick={onMoveUp}   disabled={index === 0}          className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp   className="w-3.5 h-3.5" /></button>
        <GripVertical className="w-3.5 h-3.5 text-gray-300" />
        <button onClick={onMoveDown} disabled={index === total - 1}  className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
      </div>

      {/* Champs */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Titre de l'étape *"
          value={etape.titre}
          onChange={(e) => onChange({ ...etape, titre: e.target.value })}
          className="col-span-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={etape.type}
          onChange={(e) => onChange({ ...etape, type: e.target.value as TypeEtape })}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TYPES_ETAPE.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            placeholder="Délai (jours)"
            value={etape.delaiJours}
            onChange={(e) => onChange({ ...etape, delaiJours: Number(e.target.value) })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">j max</span>
        </div>
        <input
          type="text"
          placeholder="Description (optionnel)"
          value={etape.description}
          onChange={(e) => onChange({ ...etape, description: e.target.value })}
          className="col-span-2 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={etape.obligatoire}
            onChange={(e) => onChange({ ...etape, obligatoire: e.target.checked })}
            className="w-4 h-4 rounded text-indigo-600"
          />
          <span className="text-xs text-gray-600">Obligatoire</span>
        </label>
      </div>

      {/* Supprimer */}
      <button onClick={onRemove} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Modal création / édition ───────────────────────────────── */
function TemplateModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Template;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [nom, setNom]               = useState(initial?.nom         ?? "");
  const [desc, setDesc]             = useState(initial?.description  ?? "");
  const [etapes, setEtapes]         = useState<EtapeTemplate[]>(
    initial?.etapes.length
      ? initial.etapes.map((e) => ({ ...e, description: e.description ?? "" }))
      : [{ ...ETAPE_DEFAUT }]
  );

  const { mutate: create, loading: creating } = useMutation<unknown, unknown>(
    "/api/admin/rh/onboarding/templates", "POST"
  );
  const { mutate: update, loading: updating } = useMutation<unknown, unknown>(
    `/api/admin/rh/onboarding/templates/${initial?.id}`, "PATCH"
  );

  const loading = creating || updating;

  function addEtape() {
    setEtapes((prev) => [...prev, { ...ETAPE_DEFAUT, ordre: prev.length + 1 }]);
  }

  function updateEtape(i: number, e: EtapeTemplate) {
    setEtapes((prev) => prev.map((x, idx) => idx === i ? e : x));
  }

  function removeEtape(i: number) {
    setEtapes((prev) => prev.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, ordre: idx + 1 })));
  }

  function moveEtape(i: number, dir: -1 | 1) {
    setEtapes((prev) => {
      const arr = [...prev];
      [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
      return arr.map((e, idx) => ({ ...e, ordre: idx + 1 }));
    });
  }

  async function handleSave() {
    if (!nom.trim()) return toast.error("Le nom est requis");
    if (etapes.some((e) => !e.titre.trim())) return toast.error("Toutes les étapes doivent avoir un titre");

    const payload = {
      nom: nom.trim(),
      description: desc.trim() || null,
      etapes: etapes.map((e, i) => ({ ...e, ordre: i + 1 })),
    };

    const res = isEdit ? await update(payload) : await create(payload);
    if (res) {
      toast.success(isEdit ? "Template mis à jour" : "Template créé");
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? "Modifier le template" : "Nouveau template"}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du template *</label>
            <input
              type="text"
              placeholder="ex: Intégration Commercial, Onboarding Tech…"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="Optionnel"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Étapes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Étapes ({etapes.length})
              </label>
              <button
                onClick={addEtape}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />Ajouter une étape
              </button>
            </div>
            <div className="space-y-2">
              {etapes.map((e, i) => (
                <EtapeRow
                  key={i}
                  etape={e}
                  index={i}
                  total={etapes.length}
                  onChange={(updated) => updateEtape(i, updated)}
                  onRemove={() => removeEtape(i)}
                  onMoveUp={() => moveEtape(i, -1)}
                  onMoveDown={() => moveEtape(i, 1)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer le template"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Carte template ─────────────────────────────────────────── */
function TemplateCard({
  template,
  onEdit,
  onRefetch,
}: {
  template: Template;
  onEdit: () => void;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { mutate: toggle,  loading: toggling  } = useMutation<unknown, { actif: boolean }>(
    `/api/admin/rh/onboarding/templates/${template.id}`, "PATCH"
  );
  const { mutate: remove,  loading: removing  } = useMutation<unknown, unknown>(
    `/api/admin/rh/onboarding/templates/${template.id}`, "DELETE"
  );

  async function handleToggle() {
    const res = await toggle({ actif: !template.actif });
    if (res) {
      toast.success(template.actif ? "Template désactivé" : "Template activé");
      onRefetch();
    }
  }

  async function handleDelete() {
    const res = await remove({});
    if (res) {
      toast.success("Template supprimé");
      onRefetch();
      setConfirmDelete(false);
    }
  }

  return (
    <div className={`bg-white rounded-xl border transition-all ${template.actif ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      {/* En-tête */}
      <div className="flex items-start gap-3 p-4">
        <div className="p-2 rounded-lg bg-indigo-50">
          <ClipboardList className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{template.nom}</p>
            {!template.actif && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Inactif</span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
          )}
          <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
            <span>{template.etapes.length} étape{template.etapes.length > 1 ? "s" : ""}</span>
            <span>{template._count.onboardings} onboarding{template._count.onboardings > 1 ? "s" : ""} utilisé{template._count.onboardings > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={template.actif ? "Désactiver" : "Activer"}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            {template.actif
              ? <ToggleRight className="w-4 h-4 text-indigo-500" />
              : <ToggleLeft  className="w-4 h-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Étapes dépliées */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
          {template.etapes.map((e, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-xs font-bold text-gray-400 w-5 text-right pt-0.5">{e.ordre}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{e.titre}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[e.type]}`}>
                    {TYPES_ETAPE.find((t) => t.value === e.type)?.label}
                  </span>
                  {!e.obligatoire && (
                    <span className="text-xs text-gray-400 italic">optionnel</span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Délai max : {e.delaiJours === 0 ? "immédiat" : `${e.delaiJours} jour${e.delaiJours > 1 ? "s" : ""}`}
                </p>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-200 mt-1 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Confirmation suppression */}
      {confirmDelete && (
        <div className="border-t border-red-100 bg-red-50 rounded-b-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {template._count.onboardings > 0
              ? `Ce template sera désactivé (utilisé par ${template._count.onboardings} onboarding${template._count.onboardings > 1 ? "s" : ""}).`
              : "Supprimer définitivement ce template ?"}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              disabled={removing}
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {removing ? "…" : "Confirmer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────── */
export default function TemplatesOnboardingPage() {
  const [modal, setModal]     = useState<"create" | number | null>(null);

  const { data: res, loading, refetch } = useApi<{ data: Template[] }>(
    "/api/admin/rh/onboarding/templates"
  );

  const templates = res?.data ?? [];
  const actifs    = templates.filter((t) => t.actif).length;

  const templateEnEdition = typeof modal === "number"
    ? templates.find((t) => t.id === modal)
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/admin/rh/onboarding" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Templates d&apos;onboarding</h1>
              <p className="text-sm text-gray-500">
                {actifs} template{actifs > 1 ? "s" : ""} actif{actifs > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setModal("create")}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau template
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Aucun template créé</p>
            <button
              onClick={() => setModal("create")}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Créer le premier template
            </button>
          </div>
        )}

        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onEdit={() => setModal(t.id)}
            onRefetch={refetch}
          />
        ))}
      </div>

      {/* Modal */}
      {modal !== null && (
        <TemplateModal
          initial={templateEnEdition}
          onClose={() => setModal(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
