"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus,
  FileText, Archive, ArchiveRestore,
  ExternalLink, Save, X, User,
  CheckCircle, Clock, Download,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocRH {
  id:        number;
  type:      string;
  titre:     string;
  version:   number;
  fileUrl:   string | null;
  notes:     string | null;
  archive:   boolean;
  generePar: number;
  createdAt: string;
  profilRH: {
    id:        number;
    matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
}

interface DocsResponse {
  data:  DocRH[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  ATTESTATION_TRAVAIL:   { label: "Attestation de travail",   color: "bg-blue-100 text-blue-700"    },
  CERTIFICAT_PRESENCE:   { label: "Certificat de présence",   color: "bg-teal-100 text-teal-700"    },
  DECISION_AFFECTATION:  { label: "Décision d'affectation",   color: "bg-indigo-100 text-indigo-700"},
  LETTRE_MISSION:        { label: "Lettre de mission",        color: "bg-amber-100 text-amber-700"  },
  AUTRE:                 { label: "Autre",                    color: "bg-gray-100 text-gray-600"    },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsRHPage() {
  const [type,       setType]       = useState("");
  const [search,     setSearch]     = useState("");
  const [showArchive,setShowArchive]= useState(false);
  const [page,       setPage]       = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [editDoc,    setEditDoc]    = useState<DocRH | null>(null);

  const params = new URLSearchParams();
  if (type)   params.set("type",   type);
  if (search) params.set("search", search);
  params.set("archive", showArchive ? "true" : "false");
  params.set("page",    String(page));
  params.set("limit",   "20");

  const { data: res, loading, refetch } = useApi<DocsResponse>(
    `/api/admin/rh/documents-rh?${params}`
  );

  const documents = res?.data  ?? [];
  const meta      = res?.meta;
  const stats     = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleType   = useCallback((v: string) => { setType(v);   setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Documents RH générés</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Attestations, certificats, lettres de mission et décisions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nouveau document
            </button>
          </div>
        </div>

        {/* ── Stats par type ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => handleType(type === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                type === key
                  ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* ── Filtres ── */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher (titre, collaborateur…)"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={type}
              onChange={(e) => handleType(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tous les types</option>
              {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setShowArchive((v) => !v); setPage(1); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
              showArchive
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchive ? "Archivés" : "Actifs"}
          </button>
        </div>

        {/* ── Liste ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
            <FileText className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun document trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onEdit={() => setEditDoc(doc)}
                  onRefetch={refetch}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{meta.total} documents</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Précédent
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Suivant
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateDocModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
      {editDoc && (
        <EditDocModal
          doc={editDoc}
          onClose={() => setEditDoc(null)}
          onUpdated={() => { setEditDoc(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Ligne document ─────────────────────────────────────────────────────────────

function DocRow({ doc, onEdit, onRefetch }: {
  doc: DocRH; onEdit: () => void; onRefetch: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/admin/rh/documents-rh/${doc.id}`, "PATCH");
  const cfg    = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.AUTRE;
  const member = doc.profilRH.gestionnaire.member;

  const toggleArchive = async () => {
    const result = await mutate({ archive: !doc.archive });
    if (result) {
      toast.success(doc.archive ? "Document restauré" : "Document archivé");
      onRefetch();
    }
  };

  return (
    <div className={`flex items-start gap-4 px-5 py-4 hover:bg-slate-50 group ${doc.archive ? "opacity-60" : ""}`}>
      {/* Icône type */}
      <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.color}`}>
        <FileText className="w-4 h-4" />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">{doc.titre}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            {cfg.label}
          </span>
          <span className="text-xs text-slate-400">v{doc.version}</span>
          {doc.archive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
              <Archive className="w-3 h-3" /> Archivé
            </span>
          )}
          {doc.fileUrl ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="w-3 h-3" /> Fichier disponible
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Clock className="w-3 h-3" /> En attente du fichier
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <Link
            href={`/dashboard/admin/rh/collaborateurs/${doc.profilRH.id}`}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600"
          >
            <User className="w-3 h-3" />
            {member.prenom} {member.nom}
            <span className="text-slate-400 font-mono">{doc.profilRH.matricule}</span>
          </Link>
          <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
          {doc.notes && <span className="text-xs text-slate-400 truncate max-w-40">{doc.notes}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.fileUrl && (
          <a
            href={doc.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            <Download className="w-3.5 h-3.5" /> Télécharger
          </a>
        )}
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
        >
          Modifier
        </button>
        <button
          onClick={toggleArchive}
          disabled={loading}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border disabled:opacity-50 ${
            doc.archive
              ? "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100"
              : "text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100"
          }`}
        >
          {doc.archive
            ? <><ArchiveRestore className="w-3.5 h-3.5" /> Restaurer</>
            : <><Archive className="w-3.5 h-3.5" /> Archiver</>}
        </button>
      </div>
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateDocModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/documents-rh", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "",
    type:       "",
    titre:      "",
    fileUrl:    "",
    notes:      "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Titre automatique selon le type sélectionné
  const handleTypeChange = (v: string) => {
    const collab = collabs.find((c) => String(c.id) === form.profilRHId);
    const nomCollab = collab
      ? `${collab.gestionnaire.member.prenom} ${collab.gestionnaire.member.nom}`
      : "";
    const defaultTitre = v ? `${TYPE_CONFIG[v]?.label ?? v}${nomCollab ? ` — ${nomCollab}` : ""}` : "";
    setForm((f) => ({ ...f, type: v, titre: f.titre || defaultTitre }));
  };

  const handleCollabChange = (v: string) => {
    const collab = collabs.find((c) => String(c.id) === v);
    const nomCollab = collab
      ? `${collab.gestionnaire.member.prenom} ${collab.gestionnaire.member.nom}`
      : "";
    const defaultTitre = form.type
      ? `${TYPE_CONFIG[form.type]?.label ?? form.type}${nomCollab ? ` — ${nomCollab}` : ""}`
      : "";
    setForm((f) => ({ ...f, profilRHId: v, titre: f.titre || defaultTitre }));
  };

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type || !form.titre) {
      toast.error("Collaborateur, type et titre sont obligatoires");
      return;
    }
    const result = await mutate({
      profilRHId: Number(form.profilRHId),
      type:       form.type,
      titre:      form.titre,
      fileUrl:    form.fileUrl  || null,
      notes:      form.notes    || null,
    });
    if (result) { toast.success("Document créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau document RH</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <DField label="Collaborateur *">
            <select
              value={form.profilRHId}
              onChange={(e) => handleCollabChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
                </option>
              ))}
            </select>
          </DField>

          <DField label="Type de document *">
            <select
              value={form.type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Sélectionner —</option>
              {Object.entries(TYPE_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
          </DField>

          <DField label="Titre *">
            <input
              value={form.titre}
              onChange={(e) => set("titre", e.target.value)}
              placeholder="Ex: Attestation de travail — Jean Dupont"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </DField>

          <DField label="URL du fichier PDF">
            <div className="relative">
              <input
                value={form.fileUrl}
                onChange={(e) => set("fileUrl", e.target.value)}
                placeholder="https://… (laisser vide si pas encore généré)"
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {form.fileUrl && (
                <a href={form.fileUrl} target="_blank" rel="noreferrer"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </DField>

          <DField label="Notes">
            <input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </DField>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal édition ──────────────────────────────────────────────────────────────

function EditDocModal({ doc, onClose, onUpdated }: {
  doc: DocRH; onClose: () => void; onUpdated: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/admin/rh/documents-rh/${doc.id}`, "PATCH");
  const [fileUrl, setFileUrl] = useState(doc.fileUrl ?? "");
  const [notes,   setNotes]   = useState(doc.notes   ?? "");
  const cfg    = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.AUTRE;
  const member = doc.profilRH.gestionnaire.member;

  const handleSave = async () => {
    const result = await mutate({ fileUrl: fileUrl || null, notes: notes || null });
    if (result) { toast.success("Document mis à jour"); onUpdated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900 truncate">{doc.titre}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-slate-400">v{doc.version}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Collaborateur (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {member.prenom[0]}{member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</p>
              <p className="text-xs text-slate-400 font-mono">{doc.profilRH.matricule}</p>
            </div>
          </div>

          <DField label="URL du fichier PDF">
            <div className="relative">
              <input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://… (URL du PDF généré)"
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noreferrer"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {doc.fileUrl ? "Fichier déjà lié — vous pouvez le remplacer" : "Aucun fichier lié pour l'instant"}
            </p>
          </DField>

          <DField label="Notes">
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </DField>

          <p className="text-xs text-slate-400">
            Créé le {formatDate(doc.createdAt)}
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper UI ──────────────────────────────────────────────────────────────────

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
