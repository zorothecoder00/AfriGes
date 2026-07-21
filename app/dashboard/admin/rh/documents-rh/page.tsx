"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus, Wand2,
  FileText, Archive, ArchiveRestore, History,
  ExternalLink, Save, X, User,
  CheckCircle, Clock, Download, ArrowLeft,
  Eye, Printer, ChevronDown, ChevronRight,
  FileCheck, ScrollText, Briefcase, Mail,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DocRH {
  id:        number;
  type:      string;
  titre:     string;
  version:   number;
  fileUrl:   string | null;
  contenu:   string | null;
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

interface CollabItem {
  id: number;
  matricule: string;
  fonction: string | null;
  departement: string | null;
  gestionnaire: { member: { nom: string; prenom: string } };
}

interface CollabsResponse {
  data: CollabItem[];
}

interface HistoriqueDoc {
  id: number; type: string; titre: string; version: number;
  fileUrl: string | null; contenu: string | null; notes: string | null;
  archive: boolean; generePar: number; createdAt: string;
}

interface HistoriqueResponse {
  profil: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
  };
  grouped: Record<string, HistoriqueDoc[]>;
  total: number;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

/** Spécification d'un champ libre d'un type de document (renvoyée par /documents-rh/types). */
interface DocFieldSpec {
  name: string;
  label: string;
  type: "text" | "date" | "number" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}
interface DocTypeMeta { type: string; label: string; fields: DocFieldSpec[]; }

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ATTESTATION_TRAVAIL:  { label: "Attestation de travail",  color: "bg-blue-100 text-blue-700",     icon: FileCheck   },
  CERTIFICAT_PRESENCE:  { label: "Certificat de présence",  color: "bg-teal-100 text-teal-700",     icon: FileText    },
  DECISION_AFFECTATION: { label: "Décision d'affectation",  color: "bg-indigo-100 text-indigo-700", icon: ScrollText  },
  LETTRE_MISSION:       { label: "Lettre de mission",       color: "bg-amber-100 text-amber-700",   icon: Briefcase   },
  CONTRAT_CDI:          { label: "Contrat de travail (CDI)",color: "bg-emerald-100 text-emerald-700",icon: FileCheck  },
  CONTRAT_CDD:          { label: "Contrat de travail (CDD)",color: "bg-cyan-100 text-cyan-700",     icon: FileText    },
  CONTRAT_STAGE:        { label: "Contrat de stage",        color: "bg-violet-100 text-violet-700", icon: Briefcase   },
  AVENANT_CONTRAT:      { label: "Avenant au contrat",      color: "bg-orange-100 text-orange-700", icon: ScrollText  },
  CERTIFICAT_TRAVAIL:   { label: "Certificat de travail",   color: "bg-slate-100 text-slate-700",   icon: FileCheck   },
  SOLDE_TOUT_COMPTE:    { label: "Solde de tout compte",    color: "bg-rose-100 text-rose-700",     icon: FileText    },
  ATTESTATION_EMPLOI:   { label: "Attestation d'emploi",    color: "bg-sky-100 text-sky-700",       icon: Mail        },
  AUTRE:                { label: "Autre",                   color: "bg-gray-100 text-gray-600",     icon: Mail        },
};

type TabKey = "documents" | "generer" | "historique";

// ── Page principale ────────────────────────────────────────────────────────────

export default function DocumentsRHPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("documents");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* En-tête */}
        <div>
          <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={15} /> Dashboard RH
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Documents RH</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Génération automatique · Attestations · Certificats · Lettres de mission · Décisions
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            { key: "documents",  label: "Tous les documents", icon: FileText },
            { key: "generer",    label: "Générer",             icon: Wand2    },
            { key: "historique", label: "Historique collab",   icon: History  },
          ] as { key: TabKey; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Contenu par onglet */}
        {activeTab === "documents"  && <DocumentsTab />}
        {activeTab === "generer"    && <GenererTab onGenerated={() => setActiveTab("documents")} />}
        {activeTab === "historique" && <HistoriqueTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ONGLET 1 — LISTE DES DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

function DocumentsTab() {
  const [type,        setType]        = useState("");
  const [search,      setSearch]      = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [page,        setPage]        = useState(1);
  const [showCreate,  setShowCreate]  = useState(false);
  const [editDoc,     setEditDoc]     = useState<DocRH | null>(null);
  const [previewDoc,  setPreviewDoc]  = useState<DocRH | null>(null);

  const params = new URLSearchParams();
  if (type)   params.set("type",    type);
  if (search) params.set("search",  search);
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
    <div className="space-y-5">

      {/* Stats par type */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              onClick={() => handleType(type === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                type === key
                  ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${cfg.color}`}><Icon className="w-3.5 h-3.5" /></div>
                <p className="text-xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              </div>
              <p className="text-xs text-slate-500 leading-snug">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* Barre d'actions */}
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
            showArchive ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
          }`}
        >
          <Archive className="w-4 h-4" /> {showArchive ? "Archivés" : "Actifs"}
        </button>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" /> Manuel
        </button>
      </div>

      {/* Liste */}
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
                onPreview={() => setPreviewDoc(doc)}
                onRefetch={refetch}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
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

      {/* Modals */}
      {showCreate && <CreateDocModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {editDoc    && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} onUpdated={() => { setEditDoc(null); refetch(); }} />}
      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ── Ligne document ─────────────────────────────────────────────────────────────

function DocRow({ doc, onEdit, onPreview, onRefetch }: {
  doc: DocRH; onEdit: () => void; onPreview: () => void; onRefetch: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/admin/rh/documents-rh/${doc.id}`, "PATCH");
  const cfg    = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.AUTRE;
  const Icon   = cfg.icon;
  const member = doc.profilRH.gestionnaire.member;

  const toggleArchive = async () => {
    const result = await mutate({ archive: !doc.archive });
    if (result) { toast.success(doc.archive ? "Document restauré" : "Document archivé"); onRefetch(); }
  };

  return (
    <div className={`flex items-start gap-4 px-5 py-4 hover:bg-slate-50 group ${doc.archive ? "opacity-60" : ""}`}>
      <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900">{doc.titre}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">v{doc.version}</span>
          {doc.archive && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">
              <Archive className="w-3 h-3" /> Archivé
            </span>
          )}
          {doc.contenu && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="w-3 h-3" /> Généré
            </span>
          )}
          {doc.fileUrl ? (
            <span className="flex items-center gap-1 text-xs text-blue-600">
              <CheckCircle className="w-3 h-3" /> Fichier lié
            </span>
          ) : !doc.contenu ? (
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Clock className="w-3 h-3" /> En attente
            </span>
          ) : null}
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
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {doc.contenu && (
          <button onClick={onPreview}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
            <Eye className="w-3.5 h-3.5" /> Aperçu
          </button>
        )}
        {doc.contenu && (
          <a href={`/api/admin/rh/documents-rh/${doc.id}/pdf`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">
            <Download className="w-3.5 h-3.5" /> PDF
          </a>
        )}
        {doc.fileUrl && (
          <a href={doc.fileUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
            <Download className="w-3.5 h-3.5" /> Télécharger
          </a>
        )}
        <button onClick={onEdit}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
          Modifier
        </button>
        <button onClick={toggleArchive} disabled={loading}
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

// ── Modal aperçu ───────────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose }: { doc: DocRH; onClose: () => void }) {
  const cfg  = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.AUTRE;
  const Icon = cfg.icon;

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="utf-8">
        <title>${doc.titre}</title>
        <style>@media print { body { margin: 0; } }</style>
      </head><body>${doc.contenu}</body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${cfg.color}`}><Icon className="w-4 h-4" /></div>
            <div>
              <h2 className="font-semibold text-slate-900">{doc.titre}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs font-mono text-slate-400">v{doc.version}</span>
                <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
              <Printer className="w-4 h-4" /> Imprimer
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 bg-slate-50">
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            dangerouslySetInnerHTML={{ __html: doc.contenu ?? "" }}
          />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ONGLET 2 — GÉNÉRER UN DOCUMENT
// ══════════════════════════════════════════════════════════════════════════════

function GenererTab({ onGenerated }: { onGenerated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/documents-rh/generer", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const { data: typesRes }  = useApi<{ data: DocTypeMeta[] }>("/api/admin/rh/documents-rh/types");
  const collabs = collabRes?.data ?? [];
  const types   = typesRes?.data ?? [];

  const [profilRHId,  setProfilRHId]  = useState("");
  const [docType,     setDocType]     = useState("");
  const [notes,       setNotes]       = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generated,   setGenerated]   = useState<DocRH | null>(null);

  const currentFields = types.find((t) => t.type === docType)?.fields ?? [];
  const selectedCollab = collabs.find((c) => String(c.id) === profilRHId);

  // Changer de type réinitialise les champs libres (évite de traîner des valeurs d'un autre type).
  const selectType = (t: string) => { setDocType(t); setFieldValues({}); };
  const setField   = (name: string, v: string) => setFieldValues((f) => ({ ...f, [name]: v }));
  const resetAll   = () => { setGenerated(null); setProfilRHId(""); setDocType(""); setNotes(""); setFieldValues({}); };

  const handleGenerate = async () => {
    if (!profilRHId || !docType) {
      toast.error("Collaborateur et type sont obligatoires");
      return;
    }
    const missing = currentFields.find((f) => f.required && !(fieldValues[f.name] ?? "").trim());
    if (missing) {
      toast.error(`Champ requis : ${missing.label}`);
      return;
    }
    // On n'envoie que les champs libres non vides, en plus des méta.
    const payloadFields = Object.fromEntries(
      Object.entries(fieldValues).filter(([, v]) => v.trim() !== ""),
    );
    const result = await mutate({
      profilRHId: Number(profilRHId),
      type:       docType,
      notes:      notes || null,
      ...payloadFields,
    });
    if (result) {
      toast.success("Document généré avec succès !");
      setGenerated((result as { data: DocRH }).data);
    }
  };

  if (generated) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">{generated.titre}</p>
            <p className="text-xs text-emerald-600">Version {generated.version} générée — {formatDate(generated.createdAt)}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={resetAll}
              className="px-3 py-1.5 text-sm text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50"
            >
              Nouveau
            </button>
            <button onClick={onGenerated}
              className="px-3 py-1.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              Voir dans Documents
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Aperçu du document généré</h3>
            <button
              onClick={() => {
                const win = window.open("", "_blank");
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${generated.titre}</title><style>@media print{body{margin:0}}</style></head><body>${generated.contenu}</body></html>`);
                win.document.close(); win.print();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer
            </button>
          </div>
          <div className="p-6 bg-slate-50">
            <div
              className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
              dangerouslySetInnerHTML={{ __html: generated.contenu ?? "" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* Infos */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex gap-3">
        <Wand2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
        <div>
          <strong>Génération automatique</strong> — Le contenu du document est pré-rempli à partir
          des données du collaborateur (poste, département, date d&apos;embauche, etc.).
          Chaque génération incrémente le numéro de version.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2">Type de document *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {types.map((t) => {
              const c = TYPE_CONFIG[t.type] ?? { label: t.label, color: "bg-gray-100 text-gray-600", icon: FileText };
              const Icon = c.icon;
              return (
                <button
                  key={t.type}
                  onClick={() => selectType(t.type)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    docType === t.type
                      ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                      : "border-slate-200 hover:border-slate-300 bg-slate-50"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${c.color} flex-shrink-0`}><Icon className="w-4 h-4" /></div>
                  <span className="text-sm font-medium text-slate-800">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collaborateur */}
        <GField label="Collaborateur *">
          <select
            value={profilRHId}
            onChange={(e) => setProfilRHId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Sélectionner —</option>
            {collabs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
              </option>
            ))}
          </select>
          {selectedCollab && (
            <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 flex gap-4 flex-wrap">
              {selectedCollab.fonction    && <span><strong>Poste :</strong> {selectedCollab.fonction}</span>}
              {selectedCollab.departement && <span><strong>Dép. :</strong> {selectedCollab.departement}</span>}
            </div>
          )}
        </GField>

        {/* Champs libres propres au type sélectionné (formulaire par type) */}
        {docType && currentFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {currentFields.map((f) => {
              const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
              const val = fieldValues[f.name] ?? "";
              return (
                <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                  <GField label={f.required ? `${f.label} *` : f.label}>
                    {f.type === "textarea" ? (
                      <textarea rows={2} value={val} onChange={(e) => setField(f.name, e.target.value)}
                        placeholder={f.placeholder} className={`${inputCls} resize-none`} />
                    ) : f.type === "select" ? (
                      <select value={val} onChange={(e) => setField(f.name, e.target.value)} className={`${inputCls} bg-white`}>
                        <option value="">— Sélectionner —</option>
                        {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                        value={val} onChange={(e) => setField(f.name, e.target.value)}
                        placeholder={f.placeholder} className={inputCls} />
                    )}
                  </GField>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <GField label="Notes internes (optionnel)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Demandé par l'intéressé, dossier banque…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </GField>

        <button
          onClick={handleGenerate}
          disabled={loading || !profilRHId || !docType}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Génération en cours…</>
            : <><Wand2 className="w-4 h-4" /> Générer le document</>}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ONGLET 3 — HISTORIQUE PAR COLLABORATEUR
// ══════════════════════════════════════════════════════════════════════════════

function HistoriqueTab() {
  const [profilRHId, setProfilRHId] = useState("");
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({});
  const [previewDoc, setPreviewDoc] = useState<HistoriqueDoc | null>(null);

  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const { data: histRes, loading, refetch } = useApi<HistoriqueResponse>(
    profilRHId ? `/api/admin/rh/documents-rh/historique?profilRHId=${profilRHId}` : null
  );

  const toggleType = (t: string) => setExpanded((p) => ({ ...p, [t]: !p[t] }));

  const selectedCollab = collabs.find((c) => String(c.id) === profilRHId);

  return (
    <div className="space-y-5">

      {/* Sélection collaborateur */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <label className="block text-xs font-semibold text-slate-600 mb-2">Sélectionner un collaborateur</label>
        <div className="flex gap-3">
          <select
            value={profilRHId}
            onChange={(e) => { setProfilRHId(e.target.value); setExpanded({}); }}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— Sélectionner un collaborateur —</option>
            {collabs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
              </option>
            ))}
          </select>
          {profilRHId && (
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
        {selectedCollab && (
          <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {selectedCollab.gestionnaire.member.prenom[0]}{selectedCollab.gestionnaire.member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {selectedCollab.gestionnaire.member.prenom} {selectedCollab.gestionnaire.member.nom}
              </p>
              <p className="text-xs text-slate-500 font-mono">{selectedCollab.matricule}
                {selectedCollab.fonction && ` · ${selectedCollab.fonction}`}
              </p>
            </div>
            {histRes && (
              <span className="ml-auto text-xs text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
                {histRes.total} document{histRes.total > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Historique groupé */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      )}

      {histRes && !loading && (
        Object.keys(histRes.grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <History className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucun document pour ce collaborateur</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(histRes.grouped).map(([type, docs]) => {
              const cfg    = TYPE_CONFIG[type] ?? TYPE_CONFIG.AUTRE;
              const Icon   = cfg.icon;
              const isOpen = expanded[type] ?? true;
              const latest = docs[0];
              return (
                <div key={type} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Header type */}
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 text-left"
                  >
                    <div className={`p-2 rounded-lg ${cfg.color} flex-shrink-0`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{cfg.label}</p>
                      <p className="text-xs text-slate-500">
                        {docs.length} version{docs.length > 1 ? "s" : ""} · Dernière : v{latest.version} le {formatDate(latest.createdAt)}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${cfg.color}`}>×{docs.length}</span>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  </button>

                  {/* Versions */}
                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {docs.map((doc) => (
                        <div key={doc.id} className={`flex items-center gap-4 px-5 py-3 hover:bg-slate-50 ${doc.archive ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-8 text-center flex-shrink-0">
                              v{doc.version}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm text-slate-800 truncate">{doc.titre}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-400">{formatDate(doc.createdAt)}</span>
                                {doc.archive && (
                                  <span className="flex items-center gap-0.5 text-xs text-slate-400">
                                    <Archive className="w-3 h-3" /> Archivé
                                  </span>
                                )}
                                {doc.contenu && (
                                  <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                                    <CheckCircle className="w-3 h-3" /> Généré auto
                                  </span>
                                )}
                                {doc.fileUrl && (
                                  <span className="flex items-center gap-0.5 text-xs text-blue-600">
                                    <CheckCircle className="w-3 h-3" /> Fichier lié
                                  </span>
                                )}
                                {doc.notes && <span className="text-xs text-slate-400 italic">{doc.notes}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {doc.contenu && (
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                              >
                                <Eye className="w-3 h-3" /> Aperçu
                              </button>
                            )}
                            {doc.fileUrl && (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                <ExternalLink className="w-3 h-3" /> PDF
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {previewDoc && <PreviewModal doc={previewDoc as unknown as DocRH} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALS CRÉATION / ÉDITION MANUELLE
// ══════════════════════════════════════════════════════════════════════════════

function CreateDocModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/documents-rh", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({ profilRHId: "", type: "", titre: "", fileUrl: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleTypeChange = (v: string) => {
    const collab = collabs.find((c) => String(c.id) === form.profilRHId);
    const nomCollab = collab ? `${collab.gestionnaire.member.prenom} ${collab.gestionnaire.member.nom}` : "";
    const defaultTitre = v ? `${TYPE_CONFIG[v]?.label ?? v}${nomCollab ? ` — ${nomCollab}` : ""}` : "";
    setForm((f) => ({ ...f, type: v, titre: f.titre || defaultTitre }));
  };

  const handleCollabChange = (v: string) => {
    const collab = collabs.find((c) => String(c.id) === v);
    const nomCollab = collab ? `${collab.gestionnaire.member.prenom} ${collab.gestionnaire.member.nom}` : "";
    const defaultTitre = form.type ? `${TYPE_CONFIG[form.type]?.label ?? form.type}${nomCollab ? ` — ${nomCollab}` : ""}` : "";
    setForm((f) => ({ ...f, profilRHId: v, titre: f.titre || defaultTitre }));
  };

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.type || !form.titre) { toast.error("Collaborateur, type et titre sont obligatoires"); return; }
    const result = await mutate({ profilRHId: Number(form.profilRHId), type: form.type, titre: form.titre, fileUrl: form.fileUrl || null, notes: form.notes || null });
    if (result) { toast.success("Document créé"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau document (manuel)</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <GField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => handleCollabChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>
              ))}
            </select>
          </GField>
          <GField label="Type *">
            <select value={form.type} onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {Object.entries(TYPE_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
            </select>
          </GField>
          <GField label="Titre *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex: Attestation de travail — Jean Dupont"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </GField>
          <GField label="URL du fichier PDF">
            <div className="relative">
              <input value={form.fileUrl} onChange={(e) => set("fileUrl", e.target.value)} placeholder="https://… (optionnel)"
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {form.fileUrl && (
                <a href={form.fileUrl} target="_blank" rel="noreferrer" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </GField>
          <GField label="Notes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </GField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDocModal({ doc, onClose, onUpdated }: { doc: DocRH; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/documents-rh/${doc.id}`, "PATCH");
  const [fileUrl, setFileUrl] = useState(doc.fileUrl ?? "");
  const [notes,   setNotes]   = useState(doc.notes   ?? "");
  const cfg    = TYPE_CONFIG[doc.type] ?? TYPE_CONFIG.AUTRE;
  const Icon   = cfg.icon;
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
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <Icon className="w-3 h-3" /> {cfg.label}
              </span>
              <span className="text-xs font-mono text-slate-400">v{doc.version}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {member.prenom[0]}{member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</p>
              <p className="text-xs text-slate-400 font-mono">{doc.profilRH.matricule}</p>
            </div>
          </div>
          <GField label="URL du fichier PDF">
            <div className="relative">
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://… (URL du PDF)"
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              {fileUrl && (
                <a href={fileUrl} target="_blank" rel="noreferrer" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">{doc.fileUrl ? "Fichier déjà lié — vous pouvez le remplacer" : "Aucun fichier lié"}</p>
          </GField>
          <GField label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </GField>
          <p className="text-xs text-slate-400">Créé le {formatDate(doc.createdAt)}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

function GField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
