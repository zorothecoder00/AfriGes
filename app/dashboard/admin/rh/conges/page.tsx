"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, CheckCircle,
  Clock, XCircle, CalendarDays, User,
  ChevronRight, AlertTriangle, Settings,
  X, Save,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Demande {
  id:         number;
  type:       string;
  statut:     string;
  dateDebut:  string;
  dateFin:    string;
  nbJours:    number;
  motif:      string | null;
  commentaireRefus: string | null;
  createdAt:  string;
  profilRH: {
    id:        number;
    matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
}

interface DemandesResponse {
  data:  Demande[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface Politique {
  id:            number;
  type:          string;
  joursParAn:    number;
  reportable:    boolean;
  joursMaxReport:number;
  description:   string | null;
  actif:         boolean;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE:      "bg-amber-100 text-amber-700",
  VALIDE_MANAGER:  "bg-blue-100 text-blue-700",
  VALIDE_RH:       "bg-indigo-100 text-indigo-700",
  APPROUVE:        "bg-emerald-100 text-emerald-700",
  REJETE:          "bg-red-100 text-red-700",
  ANNULE:          "bg-gray-100 text-gray-500",
};

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE:     "En attente",
  VALIDE_MANAGER: "Validé manager",
  VALIDE_RH:      "Validé RH",
  APPROUVE:       "Approuvé",
  REJETE:         "Rejeté",
  ANNULE:         "Annulé",
};

const TYPE_LABEL: Record<string, string> = {
  ANNUEL:       "Congé annuel",
  MALADIE:      "Maladie",
  EXCEPTIONNEL: "Exceptionnel",
  PERMISSION:   "Permission",
  FORMATION:    "Formation",
  MATERNITE:    "Maternité",
  PATERNITE:    "Paternité",
  SANS_SOLDE:   "Sans solde",
};

const TYPE_COLOR: Record<string, string> = {
  ANNUEL:       "bg-emerald-100 text-emerald-700",
  MALADIE:      "bg-red-100 text-red-700",
  EXCEPTIONNEL: "bg-purple-100 text-purple-700",
  PERMISSION:   "bg-amber-100 text-amber-700",
  FORMATION:    "bg-blue-100 text-blue-700",
  MATERNITE:    "bg-pink-100 text-pink-700",
  PATERNITE:    "bg-cyan-100 text-cyan-700",
  SANS_SOLDE:   "bg-gray-100 text-gray-600",
};

// Actions disponibles selon le statut
const NEXT_ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  EN_ATTENTE:     [
    { action: "VALIDER_MANAGER", label: "Valider (manager)", color: "bg-blue-600 hover:bg-blue-700" },
    { action: "APPROUVER",       label: "Approuver direct",  color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-600 hover:bg-red-700" },
  ],
  VALIDE_MANAGER: [
    { action: "VALIDER_RH",      label: "Valider (RH)",      color: "bg-indigo-600 hover:bg-indigo-700" },
    { action: "APPROUVER",       label: "Approuver direct",  color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-600 hover:bg-red-700" },
  ],
  VALIDE_RH:      [
    { action: "APPROUVER",       label: "Approuver",         color: "bg-emerald-600 hover:bg-emerald-700" },
    { action: "REJETER",         label: "Rejeter",           color: "bg-red-600 hover:bg-red-700" },
  ],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CongesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [statut,      setStatut]      = useState("EN_ATTENTE");
  const [type,        setType]        = useState("");
  const [page,        setPage]        = useState(1);
  const [showPolitiques, setShowPolitiques] = useState(false);
  const [rejetId,     setRejetId]     = useState<number | null>(null);

  const query = new URLSearchParams({
    page: String(page), limit: "20",
    ...(search && { search }),
    ...(statut && { statut }),
    ...(type   && { type }),
  }).toString();

  const { data: res, loading, refetch } = useApi<DemandesResponse>(
    `/api/admin/rh/conges?${query}`
  );

  const { data: politiquesRes } = useApi<{ data: Politique[] }>(
    "/api/admin/rh/politiques-conges"
  );

  const handleSearch = useCallback(() => { setSearch(searchInput); setPage(1); }, [searchInput]);

  const stats = res?.stats ?? {};
  const enAttente = (stats["EN_ATTENTE"] ?? 0) + (stats["VALIDE_MANAGER"] ?? 0) + (stats["VALIDE_RH"] ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Congés & Absences</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gestion des demandes et validation du workflow RH
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={refetch}
              className="p-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowPolitiques(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              <Settings className="w-4 h-4" /> Politiques
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Clock className="w-5 h-5 text-amber-600" />}   label="En attente de validation" value={enAttente}                      bg="bg-amber-50"   onClick={() => setStatut("EN_ATTENTE")} />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-emerald-600" />} label="Approuvés"           value={stats["APPROUVE"] ?? 0}          bg="bg-emerald-50" onClick={() => setStatut("APPROUVE")} />
          <StatCard icon={<XCircle className="w-5 h-5 text-red-500" />}   label="Rejetés"                  value={stats["REJETE"] ?? 0}            bg="bg-red-50"     onClick={() => setStatut("REJETE")} />
          <StatCard icon={<CalendarDays className="w-5 h-5 text-blue-600" />} label="Total"                value={res?.meta.total ?? 0}            bg="bg-blue-50"    onClick={() => setStatut("")} />
        </div>

        {/* ── Filtres ── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Nom du collaborateur…"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={handleSearch} className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Search className="w-4 h-4" />
            </button>
          </div>

          <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <div className="flex items-center gap-1 text-sm text-slate-500">
            <Filter className="w-4 h-4" /> {res?.meta.total ?? 0} demande(s)
          </div>
        </div>

        {/* ── Liste ── */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : !res?.data.length ? (
            <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
              <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucune demande trouvée</p>
            </div>
          ) : (
            res.data.map((d) => (
              <DemandeCard
                key={d.id}
                demande={d}
                onAction={(action) => {
                  if (action === "REJETER") { setRejetId(d.id); return; }
                  handleAction(d.id, action, undefined, refetch);
                }}
              />
            ))
          )}
        </div>

        {/* ── Pagination ── */}
        {res && res.meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Page {res.meta.page} / {res.meta.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Précédent
              </button>
              <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Suivant
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal Politiques ── */}
      {showPolitiques && (
        <PolitiquesModal
          politiques={politiquesRes?.data ?? []}
          onClose={() => setShowPolitiques(false)}
        />
      )}

      {/* ── Modal Rejet ── */}
      {rejetId !== null && (
        <RejetModal
          demandeId={rejetId}
          onClose={() => setRejetId(null)}
          onRejeted={() => { setRejetId(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── DemandeCard ───────────────────────────────────────────────────────────────

function DemandeCard({
  demande, onAction,
}: { demande: Demande; onAction: (action: string) => void }) {
  const actions = NEXT_ACTIONS[demande.statut] ?? [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-4 flex-wrap">

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {demande.profilRH.gestionnaire.member.prenom[0]}
          {demande.profilRH.gestionnaire.member.nom[0]}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/dashboard/admin/rh/collaborateurs/${demande.profilRH.id}`}
              className="flex items-center gap-1 font-semibold text-slate-800 hover:text-emerald-600"
            >
              <User className="w-3.5 h-3.5" />
              {demande.profilRH.gestionnaire.member.prenom} {demande.profilRH.gestionnaire.member.nom}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
            <span className="font-mono text-xs text-slate-400">{demande.profilRH.matricule}</span>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOR[demande.type] ?? "bg-gray-100 text-gray-600"}`}>
              {TYPE_LABEL[demande.type] ?? demande.type}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[demande.statut] ?? "bg-gray-100 text-gray-500"}`}>
              {STATUT_LABEL[demande.statut] ?? demande.statut}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDate(demande.dateDebut)} → {formatDate(demande.dateFin)}
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {demande.nbJours} jour{demande.nbJours > 1 ? "s" : ""}
            </span>
          </div>

          {demande.motif && (
            <p className="text-xs text-slate-500 mt-1">{demande.motif}</p>
          )}

          {demande.commentaireRefus && (
            <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {demande.commentaireRefus}
            </div>
          )}
        </div>

        {/* Date demande */}
        <div className="text-xs text-slate-400 flex-shrink-0">
          {formatDate(demande.createdAt)}
        </div>
      </div>

      {/* Actions workflow */}
      {actions.length > 0 && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => onAction(a.action)}
              className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Action handler ────────────────────────────────────────────────────────────

async function handleAction(
  id: number, action: string,
  commentaire: string | undefined,
  refetch: () => void
) {
  try {
    const res = await fetch(`/api/admin/rh/conges/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action, commentaire }),
    });
    const json = await res.json();
    if (!res.ok) { toast.error(json.error ?? "Erreur"); return; }
    toast.success(`Demande ${action === "APPROUVER" ? "approuvée" : action === "REJETER" ? "rejetée" : "mise à jour"}`);
    refetch();
  } catch {
    toast.error("Erreur réseau");
  }
}

// ── Modal Rejet ───────────────────────────────────────────────────────────────

function RejetModal({
  demandeId, onClose, onRejeted,
}: { demandeId: number; onClose: () => void; onRejeted: () => void }) {
  const [commentaire, setCommentaire] = useState("");
  const { mutate, loading } = useMutation(`/api/admin/rh/conges/${demandeId}`, "PATCH");

  const handleRejet = async () => {
    const result = await mutate({ action: "REJETER", commentaire: commentaire || undefined });
    if (result) { toast.success("Demande rejetée"); onRejeted(); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Rejeter la demande</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motif du rejet (optionnel)</label>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={3}
              placeholder="Expliquer la raison du rejet…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Annuler
            </button>
            <button onClick={handleRejet} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Confirmer le rejet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Modal Politiques ──────────────────────────────────────────────────────────

function PolitiquesModal({
  politiques, onClose,
}: { politiques: Politique[]; onClose: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ joursParAn: "", reportable: false, joursMaxReport: "", description: "" });
  const { mutate, loading } = useMutation("/api/admin/rh/politiques-conges", "POST");

  const startEdit = (p: Politique) => {
    setEditing(p.type);
    setForm({
      joursParAn:     String(p.joursParAn),
      reportable:     p.reportable,
      joursMaxReport: String(p.joursMaxReport),
      description:    p.description ?? "",
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    const result = await mutate({ type: editing, joursParAn: Number(form.joursParAn), reportable: form.reportable, joursMaxReport: Number(form.joursMaxReport), description: form.description || null });
    if (result) { toast.success("Politique mise à jour"); setEditing(null); }
  };

  const ALL_TYPES = Object.keys(TYPE_LABEL);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[200]" onClick={onClose} />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">Politiques de congés</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-3">
            {ALL_TYPES.map((type) => {
              const p = politiques.find((pol) => pol.type === type);
              const isEditing = editing === type;

              return (
                <div key={type} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLOR[type] ?? "bg-gray-100 text-gray-600"}`}>
                      {TYPE_LABEL[type]}
                    </span>
                    {!isEditing && (
                      <button onClick={() => startEdit(p ?? { id: 0, type, joursParAn: 0, reportable: false, joursMaxReport: 0, description: null, actif: true })}
                        className="text-xs text-emerald-600 hover:underline">
                        Modifier
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Jours / an</label>
                          <input type="number" min={0} value={form.joursParAn}
                            onChange={(e) => setForm((f) => ({ ...f, joursParAn: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Jours max reportables</label>
                          <input type="number" min={0} value={form.joursMaxReport}
                            onChange={(e) => setForm((f) => ({ ...f, joursMaxReport: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input type="checkbox" checked={form.reportable}
                          onChange={(e) => setForm((f) => ({ ...f, reportable: e.target.checked }))}
                          className="rounded" />
                        Reportable sur l&apos;année suivante
                      </label>
                      <input value={form.description}
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Description optionnelle"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg">
                          Annuler
                        </button>
                        <button onClick={handleSave} disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <span><strong>{p?.joursParAn ?? 0}</strong> j/an</span>
                      {p?.reportable && <span className="text-xs text-blue-600">Reportable ({p.joursMaxReport}j max)</span>}
                      {!p && <span className="text-xs text-slate-400 italic">Non configuré</span>}
                      {p?.description && <span className="text-xs text-slate-400">{p.description}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, bg, onClick }: {
  icon: React.ReactNode; label: string; value: number; bg: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 w-full text-left hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>{icon}</div>
      <div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </button>
  );
}
