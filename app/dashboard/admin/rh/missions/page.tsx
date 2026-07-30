"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, Plus,
  MapPin, Calendar, CheckCircle, Clock,
  XCircle, PlayCircle, Flag, User,
  ChevronRight, Save, FileText,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Badge, { type BadgeVariant } from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import KpiCard from "@/components/ui/KpiCard";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";

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

const STATUT_CONFIG: Record<string, { label: string; variant: BadgeVariant; accent: "neutral" | "primary" | "warning" | "success" | "error"; icon: React.ReactNode }> = {
  CREE:     { label: "Créée",     variant: "neutral", accent: "neutral", icon: <Clock     className="w-3.5 h-3.5" /> },
  VALIDE:   { label: "Validée",   variant: "info",    accent: "primary", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  EN_COURS: { label: "En cours",  variant: "warning", accent: "warning", icon: <PlayCircle  className="w-3.5 h-3.5" /> },
  CLOTURE:  { label: "Clôturée",  variant: "success", accent: "success", icon: <Flag      className="w-3.5 h-3.5" /> },
  ANNULE:   { label: "Annulée",   variant: "error",   accent: "error",   icon: <XCircle    className="w-3.5 h-3.5" /> },
};

const WORKFLOW_ACTIONS: Record<string, { action: string; label: string; variant: "primary" | "danger" | "success" }[]> = {
  CREE:     [{ action: "VALIDER",  label: "Valider",  variant: "primary" },
             { action: "ANNULER",  label: "Annuler",  variant: "danger" }],
  VALIDE:   [{ action: "DEMARRER", label: "Démarrer", variant: "primary" },
             { action: "ANNULER",  label: "Annuler",  variant: "danger" }],
  EN_COURS: [{ action: "CLOTURER", label: "Clôturer", variant: "primary" }],
  CLOTURE:  [],
  ANNULE:   [],
};

const selectCls = "w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500";

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
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Missions & déplacements</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gestion des missions des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="border border-slate-200 dark:border-slate-700" title="Rafraîchir" />
            <Button onClick={() => setShowCreate(true)} icon={<Plus className="w-4 h-4" />}>
              Nouvelle mission
            </Button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => handleStatut(statut === key ? "" : key)} className="text-left">
              <KpiCard
                label={cfg.label}
                value={stats[key] ?? 0}
                icon={cfg.icon}
                accent={cfg.accent}
                className={statut === key ? "border-primary-400 dark:border-primary-600 ring-1 ring-primary-400 dark:ring-primary-600" : ""}
              />
            </button>
          ))}
        </div>

        {/* ── Filtres ── */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher (titre, ref, collaborateur…)"
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statut}
              onChange={(e) => handleStatut(e.target.value)}
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500"
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
          <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : missions.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <MapPin className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune mission trouvée</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
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
        {meta && (
          <Pagination page={page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} itemLabel="mission(s)" />
        )}

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
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 group">
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
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 text-left"
              >
                {mission.titre}
              </button>
              <Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <Link
                href={`/dashboard/admin/rh/collaborateurs/${mission.collaborateur.id}`}
                className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
              >
                <User className="w-3 h-3" />
                {member.prenom} {member.nom}
                <span className="text-slate-400 dark:text-slate-500 font-mono">{mission.collaborateur.matricule}</span>
              </Link>
              {mission.destination && (
                <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                  <MapPin className="w-3 h-3" /> {mission.destination}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                <Calendar className="w-3 h-3" />
                {formatDate(mission.dateDepart)}
                {mission.dateRetour && ` → ${formatDate(mission.dateRetour)}`}
              </span>
              <span className="text-xs font-mono text-slate-300 dark:text-slate-600">{mission.reference}</span>
            </div>
          </div>

          {/* Actions workflow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions.map((act) => (
              <Button
                key={act.action}
                size="sm"
                variant={act.variant}
                onClick={() => handleAction(act.action)}
                disabled={loading}
              >
                {act.label}
              </Button>
            ))}
            <button
              onClick={onOpenDetail}
              className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100"
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
    <Modal open onClose={onClose} title="Nouvelle mission" size="md">
        <div className="space-y-4">
          <MField label="Collaborateur *">
            <select value={form.collaborateurId} onChange={(e) => set("collaborateurId", e.target.value)}
              className={selectCls}>
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
                </option>
              ))}
            </select>
          </MField>

          <Input label="Titre *" value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Objet de la mission" />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de départ *" type="date" value={form.dateDepart} onChange={(e) => set("dateDepart", e.target.value)} />
            <Input label="Date de retour prévue" type="date" value={form.dateRetour} onChange={(e) => set("dateRetour", e.target.value)} />
          </div>

          <Input label="Destination" value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Ville / pays" />

          <MField label="Objectifs">
            <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2}
              placeholder="Décrire les objectifs de la mission…"
              className={`${selectCls} resize-none`} />
          </MField>

          <MField label="Livrables attendus">
            <textarea value={form.livrables} onChange={(e) => set("livrables", e.target.value)} rows={2}
              placeholder="Rapports, comptes-rendus, résultats attendus…"
              className={`${selectCls} resize-none`} />
          </MField>

          <Input label="Notes internes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optionnel" />
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading} loading={loading} icon={<Save className="w-4 h-4" />}>
            Créer la mission
          </Button>
        </div>
    </Modal>
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
    <Modal open onClose={onClose} size="md" title={mission.titre}>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono -mt-3 mb-3">{mission.reference}</p>
        <div className="mb-3"><Badge variant={cfg.variant} icon={cfg.icon}>{cfg.label}</Badge></div>

        <div className="space-y-4">
          {/* Collaborateur */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {member.prenom[0]}{member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{member.prenom} {member.nom}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">{mission.collaborateur.matricule}</p>
            </div>
          </div>

          {editMode ? (
            <div className="space-y-3">
              <Input label="Titre" value={form.titre} onChange={(e) => set("titre", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Date de départ" type="date" value={form.dateDepart} onChange={(e) => set("dateDepart", e.target.value)} />
                <Input label="Date de retour prévue" type="date" value={form.dateRetour} onChange={(e) => set("dateRetour", e.target.value)} />
              </div>
              <Input label="Destination" value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Ville / pays" />
              <MField label="Objectifs">
                <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2} className={`${selectCls} resize-none`} />
              </MField>
              <MField label="Livrables">
                <textarea value={form.livrables} onChange={(e) => set("livrables", e.target.value)} rows={2} className={`${selectCls} resize-none`} />
              </MField>
              <MField label="Rapport / compte-rendu">
                <textarea value={form.rapport} onChange={(e) => set("rapport", e.target.value)} rows={3}
                  placeholder="URL du fichier ou texte du rapport…"
                  className={`${selectCls} resize-none`} />
              </MField>
              <Input label="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
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

        <div className="flex justify-between gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" onClick={() => setEditMode((v) => !v)} icon={editMode ? undefined : <FileText className="w-4 h-4" />}>
            {editMode ? "Annuler" : "Modifier"}
          </Button>
          {editMode && (
            <Button onClick={handleSave} disabled={loading} loading={loading} icon={<Save className="w-4 h-4" />}>
              Enregistrer
            </Button>
          )}
          {!editMode && (
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
          )}
        </div>
    </Modal>
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
    <Modal open onClose={onClose} title="Clôturer la mission" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Mission : <span className="font-medium">{mission.titre}</span>
          </p>
          <Input label="Date de retour réelle *" type="date" value={dateRetourReel} onChange={(e) => setDateRetourReel(e.target.value)} />
          <MField label="Rapport / compte-rendu">
            <textarea value={rapport} onChange={(e) => setRapport(e.target.value)} rows={4}
              placeholder="Synthèse de la mission, résultats obtenus, URL du rapport complet…"
              className={`${selectCls} resize-none`} />
          </MField>
        </div>
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={handleCloture} disabled={loading || !dateRetourReel} loading={loading} icon={<Flag className="w-4 h-4" />}>
            Clôturer
          </Button>
        </div>
    </Modal>
  );
}

// ── Helpers UI ─────────────────────────────────────────────────────────────────

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ label, value, icon, multiline }: {
  label: string; value: string; icon?: React.ReactNode; multiline?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-xs text-slate-400 dark:text-slate-500 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <div className={`flex items-start gap-1 text-sm text-slate-700 dark:text-slate-300 ${multiline ? "" : "truncate"}`}>
        {icon && <span className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0">{icon}</span>}
        <span className={multiline ? "whitespace-pre-wrap break-words" : ""}>{value}</span>
      </div>
    </div>
  );
}
