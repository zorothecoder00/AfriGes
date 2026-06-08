"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Plus, X, Save,
  BookOpen, CheckCircle, Clock, PlayCircle,
  XCircle, Flag, User, Calendar, MapPin,
  UserPlus, Award, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Participation {
  id:           number;
  statut:       string;
  note:         number | null;
  certificatUrl:string | null;
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string; photo: string | null } };
  };
}

interface Formation {
  id:           number;
  titre:        string;
  objectifs:    string | null;
  lieu:         string | null;
  formateur:    string | null;
  dateDebut:    string;
  dateFin:      string | null;
  dureeHeures:  number | null;
  cout:         number | null;
  statut:       string;
  notes:        string | null;
  createdAt:    string;
  participations: Participation[];
  _count: { participations: number };
}

interface FormationsResponse {
  data: Formation[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  PLANIFIEE: { label: "Planifiée",  badge: "bg-slate-100 text-slate-600",    icon: <Clock       className="w-3.5 h-3.5" /> },
  EN_COURS:  { label: "En cours",   badge: "bg-amber-100 text-amber-700",    icon: <PlayCircle  className="w-3.5 h-3.5" /> },
  TERMINEE:  { label: "Terminée",   badge: "bg-emerald-100 text-emerald-700",icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ANNULEE:   { label: "Annulée",    badge: "bg-red-100 text-red-700",        icon: <XCircle     className="w-3.5 h-3.5" /> },
};

const STATUT_PART: Record<string, { label: string; badge: string }> = {
  INSCRIT:  { label: "Inscrit",   badge: "bg-slate-100 text-slate-600"     },
  PRESENT:  { label: "Présent",   badge: "bg-blue-100 text-blue-700"       },
  ABSENT:   { label: "Absent",    badge: "bg-red-100 text-red-600"         },
  CERTIFIE: { label: "Certifié",  badge: "bg-emerald-100 text-emerald-700" },
};

const WORKFLOW: Record<string, { action: string; label: string; color: string }[]> = {
  PLANIFIEE: [{ action: "DEMARRER", label: "Démarrer", color: "bg-amber-600 text-white hover:bg-amber-700" },
              { action: "ANNULER",  label: "Annuler",  color: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" }],
  EN_COURS:  [{ action: "TERMINER", label: "Terminer", color: "bg-emerald-600 text-white hover:bg-emerald-700" }],
  TERMINEE:  [],
  ANNULEE:   [],
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FormationsPage() {
  const [statut, setStatut] = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState<Formation | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (search) params.set("search", search);
  params.set("page", String(page)); params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<FormationsResponse>(`/api/admin/rh/formations?${params}`);
  const formations = res?.data ?? [];
  const meta       = res?.meta;
  const stats      = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Formations & Développement</h1>
            <p className="text-sm text-slate-500 mt-0.5">Plan de formation des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Nouvelle formation
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-2 mb-1"><span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span></div>
              <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* Filtre */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher (titre, formateur, lieu…)"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : formations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
            <BookOpen className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune formation trouvée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {formations.map((f) => (
              <FormationCard key={f.id} formation={f} onOpen={() => setSelected(f)} onRefetch={refetch} />
            ))}
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{meta.total} formations</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateFormationModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {selected   && <FormationDetailModal formation={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />}
    </div>
  );
}

// ── Card formation ─────────────────────────────────────────────────────────────

function FormationCard({ formation, onOpen, onRefetch }: { formation: Formation; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/${formation.id}`, "PATCH");
  const cfg     = STATUT_CONFIG[formation.statut] ?? STATUT_CONFIG.PLANIFIEE;
  const actions = WORKFLOW[formation.statut] ?? [];

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onRefetch(); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onOpen} className="text-base font-semibold text-slate-900 hover:text-emerald-600 text-left">
              {formation.titre}
            </button>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-slate-400">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(formation.dateDebut)}{formation.dateFin && ` → ${formatDate(formation.dateFin)}`}</span>
            {formation.lieu && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {formation.lieu}</span>}
            {formation.formateur && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {formation.formateur}</span>}
            {formation.dureeHeures && <span>{formation.dureeHeures}h</span>}
            {formation.cout && <span>{fmt(formation.cout)} FCFA</span>}
            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {formation._count.participations} participant{formation._count.participations > 1 ? "s" : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions.map((act) => (
            <button key={act.action} onClick={() => doAction(act.action)} disabled={loading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${act.color}`}>
              {act.label}
            </button>
          ))}
          <button onClick={onOpen} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">
            Détail
          </button>
        </div>
      </div>
      {/* Participants aperçu */}
      {formation.participations.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {formation.participations.slice(0, 8).map((p) => {
            const m = p.profilRH.gestionnaire.member;
            const sp = STATUT_PART[p.statut] ?? STATUT_PART.INSCRIT;
            return (
              <Link key={p.id} href={`/dashboard/admin/rh/collaborateurs/${p.profilRH.id}`}
                title={`${m.prenom} ${m.nom} — ${sp.label}`}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white ring-1 ${sp.badge}`}>
                {m.prenom[0]}{m.nom[0]}
              </Link>
            );
          })}
          {formation._count.participations > 8 && (
            <span className="text-xs text-slate-400">+{formation._count.participations - 8}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateFormationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/formations", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const [selectedParts, setSelectedParts] = useState<number[]>([]);

  const [form, setForm] = useState({ titre: "", objectifs: "", lieu: "", formateur: "", dateDebut: "", dateFin: "", dureeHeures: "", cout: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const togglePart = (id: number) => setSelectedParts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!form.titre || !form.dateDebut) { toast.error("Titre et date de début obligatoires"); return; }
    const result = await mutate({
      titre: form.titre, objectifs: form.objectifs || null, lieu: form.lieu || null,
      formateur: form.formateur || null, dateDebut: form.dateDebut, dateFin: form.dateFin || null,
      dureeHeures: form.dureeHeures ? Number(form.dureeHeures) : null,
      cout: form.cout ? Number(form.cout) : null, notes: form.notes || null,
      participantIds: selectedParts,
    });
    if (result) { toast.success("Formation créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle formation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <FField label="Titre *">
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex: Formation Excel avancé"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </FField>
          <div className="grid grid-cols-2 gap-3">
            <FField label="Date de début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Date de fin">
              <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Lieu">
              <input value={form.lieu} onChange={(e) => set("lieu", e.target.value)} placeholder="Ville / salle"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Formateur">
              <input value={form.formateur} onChange={(e) => set("formateur", e.target.value)} placeholder="Nom du formateur"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Durée (heures)">
              <input type="number" value={form.dureeHeures} onChange={(e) => set("dureeHeures", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
            <FField label="Coût (FCFA)">
              <input type="number" value={form.cout} onChange={(e) => set("cout", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </FField>
          </div>
          <FField label="Objectifs">
            <textarea value={form.objectifs} onChange={(e) => set("objectifs", e.target.value)} rows={2} placeholder="Objectifs de la formation…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </FField>
          {/* Participants */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">
              <UserPlus className="w-3.5 h-3.5 inline mr-1" />
              Participants ({selectedParts.length} sélectionnés)
            </p>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {collabs.map((c) => {
                const m = c.gestionnaire.member;
                const sel = selectedParts.includes(c.id);
                return (
                  <button key={c.id} onClick={() => togglePart(c.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${sel ? "bg-emerald-50" : ""}`}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${sel ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                      {sel && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span>{m.prenom} {m.nom}</span>
                    <span className="text-slate-400 text-xs font-mono">{c.matricule}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
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

// ── Modal détail ───────────────────────────────────────────────────────────────

function FormationDetailModal({ formation, onClose, onUpdated }: { formation: Formation; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/formations/${formation.id}`, "PATCH");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];
  const cfg = STATUT_CONFIG[formation.statut] ?? STATUT_CONFIG.PLANIFIEE;

  const addParticipant = async (profilRHId: number) => {
    const result = await mutate({ addParticipants: [profilRHId] });
    if (result) { toast.success("Participant ajouté"); onUpdated(); }
  };

  const updateStatutPart = async (participantId: number, statutParticipation: string) => {
    const result = await mutate({ participantId, statutParticipation });
    if (result) { toast.success("Statut mis à jour"); onUpdated(); }
  };

  const existingIds = new Set(formation.participations.map((p) => p.profilRH.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900 truncate">{formation.titre}</h2>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(formation.dateDebut)}</span>
              {formation.lieu && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{formation.lieu}</span>}
              {formation.formateur && <span className="flex items-center gap-1"><User className="w-3 h-3" />{formation.formateur}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {formation.objectifs && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600 whitespace-pre-wrap">{formation.objectifs}</div>
          )}

          {/* Participants */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase mb-2">
              Participants ({formation._count.participations})
            </p>
            {formation.participations.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun participant inscrit</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {formation.participations.map((p) => {
                  const m  = p.profilRH.gestionnaire.member;
                  const sp = STATUT_PART[p.statut] ?? STATUT_PART.INSCRIT;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {m.prenom[0]}{m.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{m.prenom} {m.nom}</p>
                        {p.note !== null && <p className="text-xs text-slate-400">Note : {p.note}/20</p>}
                      </div>
                      <select
                        value={p.statut}
                        onChange={(e) => updateStatutPart(p.profilRH.id, e.target.value)}
                        disabled={loading}
                        className={`text-xs px-2 py-1 rounded-lg border font-medium ${sp.badge} focus:outline-none`}
                      >
                        {Object.entries(STATUT_PART).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      {p.statut === "CERTIFIE" && (
                        <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ajouter participant */}
          {formation.statut !== "ANNULEE" && (
            <div>
              <p className="text-xs font-semibold text-slate-700 uppercase mb-2">Ajouter un participant</p>
              <select onChange={(e) => { if (e.target.value) { addParticipant(Number(e.target.value)); e.target.value = ""; } }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">— Sélectionner un collaborateur —</option>
                {collabs.filter((c) => !existingIds.has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Fermer</button>
        </div>
      </div>
    </div>
  );
}

function FField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
