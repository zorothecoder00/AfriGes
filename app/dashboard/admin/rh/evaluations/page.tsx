"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Plus, X, Save,
  Star, CheckCircle, Clock, PlayCircle,
  Trash2, ChevronDown, ChevronUp, User, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Critere { id?: number; libelle: string; note: number; commentaire?: string }

interface Evaluation {
  id:               number;
  periode:          string;
  annee:            number;
  statut:           string;
  noteGlobale:      number | null;
  appreciation:     string | null;
  pointsForts:      string | null;
  axesAmelioration: string | null;
  objectifsN1:      string | null;
  dateDebut:        string;
  dateFin:          string | null;
  notes:            string | null;
  createdAt:        string;
  criteres:         Critere[];
  profilRH: {
    id: number; matricule: string;
    gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
  };
  evaluateur: {
    id: number; matricule: string;
    gestionnaire: { member: { nom: string; prenom: string } } | null;
  } | null;
}

interface EvalResponse  { data: Evaluation[]; meta: { page: number; limit: number; total: number; totalPages: number }; stats: Record<string, number> }
interface CollabsResponse { data: { id: number; matricule: string; gestionnaire: { member: { nom: string; prenom: string } } }[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-100 text-slate-600",    icon: <Clock       className="w-3.5 h-3.5" /> },
  EN_COURS:  { label: "En cours",  badge: "bg-amber-100 text-amber-700",    icon: <PlayCircle  className="w-3.5 h-3.5" /> },
  CLOTURE:   { label: "Clôturée",  badge: "bg-emerald-100 text-emerald-700",icon: <CheckCircle className="w-3.5 h-3.5" /> },
};

const PERIODE_LABEL: Record<string, string> = {
  ANNUELLE: "Annuelle", SEMESTRIELLE: "Semestrielle", TRIMESTRIELLE: "Trimestrielle", PROBATOIRE: "Probatoire",
};

const ANNEE_COURANTE = new Date().getFullYear();
const ANNEES = Array.from({ length: 4 }, (_, i) => ANNEE_COURANTE - i);

const CRITERES_DEFAUT = [
  "Qualité du travail", "Productivité", "Ponctualité & présence",
  "Travail en équipe", "Initiative & autonomie",
];

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`w-4 h-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const [statut, setStatut] = useState("");
  const [annee,  setAnnee]  = useState(String(ANNEE_COURANTE));
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState<Evaluation | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (annee)  params.set("annee",  annee);
  if (search) params.set("search", search);
  params.set("page", String(page)); params.set("limit", "20");

  const { data: res, loading, refetch } = useApi<EvalResponse>(`/api/admin/rh/evaluations?${params}`);
  const evaluations = res?.data ?? [];
  const meta        = res?.meta;
  const stats       = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Évaluations de performance</h1>
            <p className="text-sm text-slate-500 mt-0.5">Suivi des évaluations périodiques des collaborateurs</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 bg-white border border-slate-200 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Nouvelle évaluation
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatut(statut === key ? "" : key)}
              className={`p-4 rounded-xl border text-left transition-all ${statut === key ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400" : "bg-white border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center gap-2 mb-1"><span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span></div>
              <p className="text-2xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500">{cfg.label}</p>
            </button>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Rechercher un collaborateur…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <select value={annee} onChange={(e) => { setAnnee(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            <option value="">Toutes années</option>
            {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : evaluations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-20 text-slate-400">
            <Star className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune évaluation trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {evaluations.map((e) => (
                <EvalRow key={e.id} eval_={e} onOpen={() => setSelected(e)} onRefetch={refetch} />
              ))}
            </div>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{meta.total} évaluations</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Précédent</button>
              <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {meta.totalPages}</span>
              <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Suivant</button>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateEvalModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refetch(); }} />}
      {selected   && <EvalDetailModal eval_={selected} onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); refetch(); }} />}
    </div>
  );
}

// ── Ligne ──────────────────────────────────────────────────────────────────────

function EvalRow({ eval_: e, onOpen, onRefetch }: { eval_: Evaluation; onOpen: () => void; onRefetch: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/evaluations/${e.id}`, "PATCH");
  const cfg    = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG.BROUILLON;
  const member = e.profilRH.gestionnaire.member;
  const noteMoy = e.criteres.length > 0 ? (e.criteres.reduce((s, c) => s + Number(c.note), 0) / e.criteres.length) : null;

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onRefetch(); }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 group">
      <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/dashboard/admin/rh/collaborateurs/${e.profilRH.id}`}
            className="text-sm font-semibold text-slate-800 hover:text-emerald-600">{member.prenom} {member.nom}</Link>
          <span className="text-xs text-slate-400 font-mono">{e.profilRH.matricule}</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">{PERIODE_LABEL[e.periode] ?? e.periode} {e.annee}</span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          {noteMoy !== null && <StarRating value={Math.round(noteMoy)} />}
          {e.noteGlobale !== null && <span className="font-semibold text-slate-700">{Number(e.noteGlobale).toFixed(1)}/5</span>}
          <span>{formatDate(e.dateDebut)}</span>
          {e.evaluateur && <span className="flex items-center gap-1"><User className="w-3 h-3" />{e.evaluateur.gestionnaire?.member.prenom} {e.evaluateur.gestionnaire?.member.nom}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100">
        {e.statut === "BROUILLON" && (
          <button onClick={() => doAction("DEMARRER")} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50">Démarrer</button>
        )}
        {e.statut === "EN_COURS" && (
          <button onClick={() => doAction("CLOTURER")} disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50">Clôturer</button>
        )}
        <button onClick={onOpen} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">Détail</button>
      </div>
    </div>
  );
}

// ── Modal création ─────────────────────────────────────────────────────────────

function CreateEvalModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/admin/rh/evaluations", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/admin/rh/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({ profilRHId: "", periode: "ANNUELLE", annee: String(ANNEE_COURANTE), dateDebut: new Date().toISOString().slice(0, 10), dateFin: "" });
  const [criteres, setCriteres] = useState<Critere[]>(CRITERES_DEFAUT.map((l) => ({ libelle: l, note: 3 })));
  const [showCriteres, setShowCriteres] = useState(true);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.periode || !form.annee || !form.dateDebut) { toast.error("Champs obligatoires manquants"); return; }
    const result = await mutate({
      profilRHId: Number(form.profilRHId), periode: form.periode, annee: Number(form.annee),
      dateDebut: form.dateDebut, dateFin: form.dateFin || null, criteres,
    });
    if (result) { toast.success("Évaluation créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle évaluation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <EField label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => <option key={c.id} value={c.id}>{c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})</option>)}
            </select>
          </EField>
          <div className="grid grid-cols-3 gap-3">
            <EField label="Période *">
              <select value={form.periode} onChange={(e) => set("periode", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {Object.entries(PERIODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </EField>
            <EField label="Année *">
              <select value={form.annee} onChange={(e) => set("annee", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </EField>
            <EField label="Date début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </EField>
          </div>

          {/* Critères */}
          <div>
            <button onClick={() => setShowCriteres((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              {showCriteres ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Critères d&apos;évaluation ({criteres.length})
            </button>
            {showCriteres && (
              <div className="space-y-2 p-4 bg-slate-50 rounded-xl">
                {criteres.map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-700">{c.libelle}</span>
                    <StarRating value={c.note} onChange={(v) => setCriteres((prev) => prev.map((x, j) => j === i ? { ...x, note: v } : x))} />
                    <button onClick={() => setCriteres((prev) => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setCriteres((prev) => [...prev, { libelle: "", note: 3 }])}
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter un critère
                </button>
                {criteres.map((c, i) => !c.id && c.libelle === "" && (
                  <input key={`new-${i}`} value={c.libelle}
                    onChange={(e) => setCriteres((prev) => prev.map((x, j) => j === i ? { ...x, libelle: e.target.value } : x))}
                    placeholder="Libellé du critère…"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                ))}
              </div>
            )}
          </div>
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

// ── Modal détail ───────────────────────────────────────────────────────────────

function EvalDetailModal({ eval_: e, onClose, onUpdated }: { eval_: Evaluation; onClose: () => void; onUpdated: () => void }) {
  const { mutate, loading } = useMutation(`/api/admin/rh/evaluations/${e.id}`, "PATCH");
  const [criteres, setCriteres] = useState<Critere[]>(e.criteres.map((c) => ({ ...c, note: Number(c.note) })));
  const [form, setForm] = useState({
    appreciation: e.appreciation ?? "", pointsForts: e.pointsForts ?? "",
    axesAmelioration: e.axesAmelioration ?? "", objectifsN1: e.objectifsN1 ?? "",
    noteGlobale: e.noteGlobale !== null ? String(e.noteGlobale) : "",
  });
  const [editMode, setEditMode] = useState(false);
  const cfg  = STATUT_CONFIG[e.statut] ?? STATUT_CONFIG.BROUILLON;
  const m    = e.profilRH.gestionnaire.member;

  const noteMoy = criteres.length > 0 ? criteres.reduce((s, c) => s + c.note, 0) / criteres.length : null;

  const handleSave = async () => {
    const result = await mutate({
      noteGlobale:      form.noteGlobale ? Number(form.noteGlobale) : noteMoy ? Math.round(noteMoy * 10) / 10 : null,
      appreciation:     form.appreciation      || null,
      pointsForts:      form.pointsForts       || null,
      axesAmelioration: form.axesAmelioration  || null,
      objectifsN1:      form.objectifsN1       || null,
      criteres: criteres.map((c) => ({ libelle: c.libelle, note: c.note, commentaire: c.commentaire ?? null })),
    });
    if (result) { toast.success("Évaluation mise à jour"); onUpdated(); }
  };

  const doAction = async (action: string) => {
    const result = await mutate({ action });
    if (result) { toast.success("Statut mis à jour"); onUpdated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{PERIODE_LABEL[e.periode]} {e.annee}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <User className="w-3 h-3" /> {m.prenom} {m.nom} — {e.profilRH.matricule}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Note globale */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-500">Note globale</p>
              {noteMoy !== null && (
                <div className="flex items-center gap-2 mt-1">
                  <StarRating value={Math.round(noteMoy)} />
                  <span className="text-lg font-bold text-slate-800">{noteMoy.toFixed(1)}/5</span>
                </div>
              )}
            </div>
            {!editMode && e.statut !== "CLOTURE" && (
              <button onClick={() => setEditMode(true)} className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Modifier</button>
            )}
          </div>

          {/* Critères */}
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase mb-2">Critères ({criteres.length})</p>
            <div className="space-y-2">
              {criteres.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-slate-600">{c.libelle}</span>
                  {editMode
                    ? <StarRating value={c.note} onChange={(v) => setCriteres((prev) => prev.map((x, j) => j === i ? { ...x, note: v } : x))} />
                    : <StarRating value={c.note} />}
                  <span className="text-xs text-slate-400 w-6">{c.note}/5</span>
                </div>
              ))}
            </div>
          </div>

          {/* Champs texte */}
          {editMode ? (
            <div className="space-y-3">
              {[
                ["appreciation", "Appréciation générale"],
                ["pointsForts", "Points forts"],
                ["axesAmelioration", "Axes d'amélioration"],
                ["objectifsN1", "Objectifs pour la prochaine période"],
              ].map(([k, l]) => (
                <EField key={k} label={l}>
                  <textarea value={form[k as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
                </EField>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {e.appreciation     && <DetailBlock label="Appréciation" value={e.appreciation} />}
              {e.pointsForts      && <DetailBlock label="Points forts" value={e.pointsForts} />}
              {e.axesAmelioration && <DetailBlock label="Axes d'amélioration" value={e.axesAmelioration} />}
              {e.objectifsN1      && <DetailBlock label="Objectifs N+1" value={e.objectifsN1} />}
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <div className="flex gap-2">
            {e.statut === "BROUILLON" && !editMode && (
              <button onClick={() => doAction("DEMARRER")} disabled={loading}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">Démarrer</button>
            )}
            {e.statut === "EN_COURS" && !editMode && (
              <button onClick={() => doAction("CLOTURER")} disabled={loading}
                className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">Clôturer</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setEditMode(false); onClose(); }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Fermer</button>
            {editMode && (
              <button onClick={handleSave} disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function EField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
