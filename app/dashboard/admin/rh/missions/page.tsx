"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus,
  MapPin, Calendar, CheckCircle, Clock,
  XCircle, PlayCircle, Flag, User,
  ChevronRight, X, Save, FileText, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Collaborateur {
  id:        number;
  matricule: string;
  gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
}

interface Mission {
  id:             number;
  reference:      string;
  titre:          string;
  objectifs:      string | null;
  livrables:      string | null;
  destination:    string | null;
  dateDepart:     string;
  dateRetour:     string | null;
  dateRetourReel: string | null;
  statut:         string;
  rapport:        string | null;
  notes:          string | null;
  collaborateur:  Collaborateur;
  validePar: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
  createdAt: string;
}

interface MissionsResponse {
  data:  Mission[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: Collaborateur[];
}

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  CREE:     { label: "Créée",     badge: "bg-slate-100 text-slate-600",   icon: <Clock     className="w-3.5 h-3.5" /> },
  VALIDE:   { label: "Validée",   badge: "bg-blue-100 text-blue-700",     icon: <CheckCircle className="w-3.5 h-3.5" /> },
  EN_COURS: { label: "En cours",  badge: "bg-amber-100 text-amber-700",   icon: <PlayCircle  className="w-3.5 h-3.5" /> },
  CLOTURE:  { label: "Clôturée",  badge: "bg-emerald-100 text-emerald-700", icon: <Flag      className="w-3.5 h-3.5" /> },
  ANNULE:   { label: "Annulée",   badge: "bg-red-100 text-red-700",       icon: <XCircle    className="w-3.5 h-3.5" /> },
};

const WORKFLOW_ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  CREE:     [{ action: "VALIDER",  label: "Valider",  color: "bg-blue-600 text-white hover:bg-blue-700" },
             { action: "ANNULER",  label: "Annuler",  color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" }],
  VALIDE:   [{ action: "DEMARRER", label: "Démarrer", color: "bg-amber-600 text-white hover:bg-amber-700" },
             { action: "ANNULER",  label: "Annuler",  color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" }],
  EN_COURS: [{ action: "CLOTURER", label: "Clôturer", color: "bg-emerald-600 text-white hover:bg-emerald-700" }],
  CLOTURE:  [],
  ANNULE:   [],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [statut, setStatut] = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate,  setShowCreate]  = useState(false);
  const [selected,    setSelected]    = useState<Mission | null>(null);
  const [clotureMission, setClotureMission] = useState<Mission | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (search) params.set("search", search);
  params.set("page",  String(page));
  params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<MissionsResponse>(
    `/api/admin/rh/missions?${params}`
  );

  const missions   = res?.data   ?? [];
  const meta       = res?.meta;
  const stats      = res?.stats  ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleStatut = useCallback((v: string) => { setStatut(v); setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Missions & déplacements</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestion des missions des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nouvelle mission
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => handleStatut(statut === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${
                statut === key
                  ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
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
              placeholder="Rechercher (titre, ref, collaborateur…)"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statut}
              onChange={(e) => handleStatut(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUT_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Liste ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : missions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
            <MapPin className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune mission trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {missions.map((m) => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  onAction={(action) => {
                    if (action === "CLOTURER") { setClotureMission(m); return; }
                    setSelected(m);
                  }}
                  onOpenDetail={() => setSelected(m)}
                  onRefetch={refetch}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{meta.total} missions</p>
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
        <CreateMissionModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
      {selected && (
        <MissionDetailModal
          mission={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); refetch(); }}
        />
      )}
      {clotureMission && (
        <ClotureModal
          mission={clotureMission}
          onClose={() => setClotureMission(null)}
          onCloture={() => { setClotureMission(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Ligne mission ──────────────────────────────────────────────────────────────

function MissionRow({
  mission, onAction, onOpenDetail, onRefetch,
}: {
  mission:      Mission;
  onAction:     (action: string) => void;
  onOpenDetail: () => void;
  onRefetch:    () => void;
}) {
  const { mutate, loading } = useMutation(`/api/admin/rh/missions/${mission.id}`, "PATCH");
  const cfg     = STATUT_CONFIG[mission.statut] ?? STATUT_CONFIG.CREE;
  const actions = WORKFLOW_ACTIONS[mission.statut] ?? [];
  const member  = mission.collaborateur.gestionnaire.member;

  const handleAction = async (action: string) => {
    if (action === "CLOTURER") { onAction(action); return; }
    const result = await mutate({ action });
    if (result) { toast.success(`Mission ${action === "VALIDER" ? "validée" : action === "DEMARRER" ? "démarrée" : "annulée"}`); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 group">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        {member.prenom[0]}{member.nom[0]}
      </div>

      {/* Contenu principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onOpenDetail}
                className="text-sm font-semibold text-slate-900 hover:text-emerald-600 text-left"
              >
                {mission.titre}
              </button>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Link
                href={`/dashboard/admin/rh/collaborateurs/${mission.collaborateur.id}`}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600"
              >
                <User className="w-3 h-3" />
                {member.prenom} {member.nom}
                <span className="text-slate-400 font-mono">{mission.collaborateur.matricule}</span>
              </Link>
              {mission.destination && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="w-3 h-3" /> {mission.destination}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                {formatDate(mission.dateDepart)}
                {mission.dateRetour && ` → ${formatDate(mission.dateRetour)}`}
              </span>
              <span className="text-xs font-mono text-slate-300">{mission.reference}</span>
            </div>
          </div>

          {/* Actions workflow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions.map((act) => (
              <button
                key={act.action}
                onClick={() => handleAction(act.action)}
                disabled={loading}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${act.color}`}
              >
                {act.label}
              </button>
            ))}
            <button
              onClick={onOpenDetail}
              className="p-1.5 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateMissionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/missions", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    collaborateurId: "",
    titre:       "",
    objectifs:   "",
    livrables:   "",
    destination: "",
    dateDepart:  "",
    dateRetour:  "",
    notes:       "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.collaborateurId || !form.titre || !form.dateDepart) {
      toast.error("Collaborateur, titre et date de départ sont obligatoires");
      return;
    }
    const result = await mutate({
      collaborateurId: Number(form.collaborateurId),
      titre:       form.titre,
      objectifs:   form.objectifs   || null,
      livrables:   form.livrables   || null,
      destination: form.destination || null,
      dateDepart:  form.dateDepart,
      dateRetour:  form.dateRetour  || null,
      notes:       form.notes       || null,
    });
    if (result) { toast.success("Mission créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle mission</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <MField label="Collaborateur *">
            <select value={form.collaborateurId} onChange={(e) => set("collaborateurId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
                </option>
              ))}
            </select>
          </MField>

          <MField label="Titre *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)}
              placeholder="Objet de la mission"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </MField>

          <div className="grid grid-cols-2 gap-3">
            <MField label="Date de départ *">
              <input type="date" value={form.dateDepart} onChange={(e) => set("dateDepart", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </MField>
            <MField label="Date de retour prévue">
              <input type="date" value={form.dateRetour} onChange={(e) => set("dateRetour", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </MField>
          </div>

          <MField label="Destination">
            <input value={form.destination} onChange={(e) => set("destination", e.target.value)}
              placeholder="Ville / pays"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </MField>

          <MField label="Objectifs">
            <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2}
              placeholder="Décrire les objectifs de la mission…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </MField>

          <MField label="Livrables attendus">
            <textarea value={form.livrables} onChange={(e) => set("livrables", e.target.value)} rows={2}
              placeholder="Rapports, comptes-rendus, résultats attendus…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </MField>

          <MField label="Notes internes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </MField>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Créer la mission
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail / édition ─────────────────────────────────────────────────────

function MissionDetailModal({
  mission, onClose, onUpdated,
}: { mission: Mission; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/missions/${mission.id}`, "PATCH");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    titre:       mission.titre,
    objectifs:   mission.objectifs   ?? "",
    livrables:   mission.livrables   ?? "",
    destination: mission.destination ?? "",
    dateDepart:  mission.dateDepart.slice(0, 10),
    dateRetour:  mission.dateRetour?.slice(0, 10) ?? "",
    notes:       mission.notes       ?? "",
    rapport:     mission.rapport     ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const result = await mutate({
      titre:       form.titre,
      objectifs:   form.objectifs   || null,
      livrables:   form.livrables   || null,
      destination: form.destination || null,
      dateDepart:  form.dateDepart,
      dateRetour:  form.dateRetour  || null,
      notes:       form.notes       || null,
      rapport:     form.rapport     || null,
    });
    if (result) { toast.success("Mission mise à jour"); onUpdated(); }
  };

  const cfg    = STATUT_CONFIG[mission.statut] ?? STATUT_CONFIG.CREE;
  const member = mission.collaborateur.gestionnaire.member;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900 truncate">{mission.titre}</h2>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{mission.reference}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Collaborateur */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {member.prenom[0]}{member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</p>
              <p className="text-xs text-slate-400 font-mono">{mission.collaborateur.matricule}</p>
            </div>
          </div>

          {editMode ? (
            <div className="space-y-3">
              <MField label="Titre">
                <input value={form.titre} onChange={(e) => set("titre", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </MField>
              <div className="grid grid-cols-2 gap-3">
                <MField label="Date de départ">
                  <input type="date" value={form.dateDepart} onChange={(e) => set("dateDepart", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </MField>
                <MField label="Date de retour prévue">
                  <input type="date" value={form.dateRetour} onChange={(e) => set("dateRetour", e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </MField>
              </div>
              <MField label="Destination">
                <input value={form.destination} onChange={(e) => set("destination", e.target.value)}
                  placeholder="Ville / pays"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </MField>
              <MField label="Objectifs">
                <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </MField>
              <MField label="Livrables">
                <textarea value={form.livrables} onChange={(e) => set("livrables", e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </MField>
              <MField label="Rapport / compte-rendu">
                <textarea value={form.rapport} onChange={(e) => set("rapport", e.target.value)} rows={3}
                  placeholder="URL du fichier ou texte du rapport…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </MField>
              <MField label="Notes">
                <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </MField>
            </div>
          ) : (
            <div className="space-y-3">
              <DetailRow label="Date de départ" value={formatDate(mission.dateDepart)} />
              {mission.dateRetour && <DetailRow label="Date de retour prévue" value={formatDate(mission.dateRetour)} />}
              {mission.dateRetourReel && <DetailRow label="Date de retour réelle" value={formatDate(mission.dateRetourReel)} />}
              {mission.destination && <DetailRow label="Destination" value={mission.destination} icon={<MapPin className="w-3.5 h-3.5" />} />}
              {mission.objectifs && <DetailRow label="Objectifs" value={mission.objectifs} multiline />}
              {mission.livrables && <DetailRow label="Livrables" value={mission.livrables} multiline />}
              {mission.rapport   && <DetailRow label="Rapport" value={mission.rapport} multiline />}
              {mission.notes     && <DetailRow label="Notes" value={mission.notes} />}
              {mission.validePar && (
                <DetailRow
                  label="Validé par"
                  value={`${mission.validePar.gestionnaire?.member.prenom} ${mission.validePar.gestionnaire?.member.nom} (${mission.validePar.matricule})`}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={() => setEditMode((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200"
          >
            {editMode ? <X className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {editMode ? "Annuler" : "Modifier"}
          </button>
          {editMode && (
            <button onClick={handleSave} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          )}
          {!editMode && (
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal clôture ──────────────────────────────────────────────────────────────

function ClotureModal({
  mission, onClose, onCloture,
}: { mission: Mission; onClose: () => void; onCloture: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/missions/${mission.id}`, "PATCH");
  const [dateRetourReel, setDateRetourReel] = useState(new Date().toISOString().slice(0, 10));
  const [rapport,        setRapport]        = useState(mission.rapport ?? "");

  const handleCloture = async () => {
    const result = await mutate({ action: "CLOTURER", dateRetourReel, rapport: rapport || null });
    if (result) { toast.success("Mission clôturée"); onCloture(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Clôturer la mission</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Mission : <span className="font-medium">{mission.titre}</span>
          </p>
          <MField label="Date de retour réelle *">
            <input type="date" value={dateRetourReel} onChange={(e) => setDateRetourReel(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </MField>
          <MField label="Rapport / compte-rendu">
            <textarea value={rapport} onChange={(e) => setRapport(e.target.value)} rows={4}
              placeholder="Synthèse de la mission, résultats obtenus, URL du rapport complet…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </MField>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleCloture} disabled={loading || !dateRetourReel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
            Clôturer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value, icon, multiline }: {
  label: string; value: string; icon?: React.ReactNode; multiline?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-slate-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className={`flex items-start gap-1 text-sm text-slate-700 ${multiline ? "" : "truncate"}`}>
        {icon && <span className="text-slate-400 mt-0.5 flex-shrink-0">{icon}</span>}
        <span className={multiline ? "whitespace-pre-wrap break-words" : ""}>{value}</span>
      </div>
    </div>
  );
}
