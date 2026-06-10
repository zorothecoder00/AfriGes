"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Plus, Search, Filter,
  Briefcase, Users, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Eye, Play, MoreHorizontal,
  User, Phone, Mail, Calendar, Star, AlertCircle,
  KeyRound, ExternalLink, BarChart3, Copy, Check,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Poste {
  id: number; reference: string; titre: string; statut: string;
  typeContrat: string | null; departement: string | null; service: string | null;
  nbPostes: number; description: string | null; dateOuverture: string | null;
  dateCloture: string | null; createdAt: string;
  pointDeVente: { id: number; nom: string; code: string } | null;
  _count: { candidatures: number };
}

interface Candidature {
  id: number; nomCandidat: string; prenomCandidat: string; email: string | null;
  telephone: string | null; statut: string; dateCandidature: string;
  noteEntretien: number | null; noteTest: number | null; scoreCandidat: number | null;
  dateEntretien: string | null; commentaire: string | null; cvUrl: string | null;
  posteId: number;
}

interface PostesRes {
  data:  Poste[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: { total: number; BROUILLON: number; OUVERT: number; EN_COURS: number; POURVU: number; ANNULE: number };
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUT_POSTE_CFG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: "Brouillon",   color: "bg-slate-100 text-slate-500"    },
  OUVERT:    { label: "Ouvert",      color: "bg-emerald-100 text-emerald-700" },
  EN_COURS:  { label: "En cours",    color: "bg-blue-100 text-blue-700"       },
  POURVU:    { label: "Pourvu",      color: "bg-purple-100 text-purple-700"   },
  ANNULE:    { label: "Annulé",      color: "bg-red-100 text-red-700"         },
};

const STATUT_CAND_CFG: Record<string, { label: string; color: string }> = {
  RECU:           { label: "Reçu",            color: "bg-slate-100 text-slate-600"    },
  PRE_QUALIFICATION:{ label: "Pré-qualifié",  color: "bg-cyan-100 text-cyan-700"      },
  SHORTLISTE:     { label: "Shortlisté",      color: "bg-indigo-100 text-indigo-700"  },
  ENTRETIEN:      { label: "Entretien",        color: "bg-blue-100 text-blue-700"      },
  TEST:           { label: "Test",             color: "bg-violet-100 text-violet-700"  },
  VALIDATION:     { label: "Validation",       color: "bg-amber-100 text-amber-700"    },
  OFFRE:          { label: "Offre",            color: "bg-orange-100 text-orange-700"  },
  INTEGRATION:    { label: "Intégration",      color: "bg-teal-100 text-teal-700"      },
  ACCEPTE:        { label: "Accepté",          color: "bg-emerald-100 text-emerald-700"},
  REJETE:         { label: "Rejeté",           color: "bg-red-100 text-red-700"        },
};

const PIPELINE_ACTIONS: Record<string, { label: string; action: string; color: string }[]> = {
  RECU:              [{ label: "Pré-qualifier",    action: "PRE_QUALIFIER",       color: "bg-cyan-600 text-white"    }, { label: "Shortlister",     action: "SHORTLISTER",          color: "bg-indigo-600 text-white" }, { label: "Rejeter", action: "REJETER", color: "bg-red-100 text-red-700" }],
  PRE_QUALIFICATION: [{ label: "Shortlister",      action: "SHORTLISTER",         color: "bg-indigo-600 text-white"  }, { label: "→ Entretien",    action: "PLANIFIER_ENTRETIEN",   color: "bg-blue-600 text-white" }, { label: "Rejeter", action: "REJETER", color: "bg-red-100 text-red-700" }],
  SHORTLISTE:        [{ label: "→ Entretien",      action: "PLANIFIER_ENTRETIEN", color: "bg-blue-600 text-white"    }, { label: "Faire offre",    action: "FAIRE_OFFRE",           color: "bg-orange-600 text-white" }, { label: "Rejeter", action: "REJETER", color: "bg-red-100 text-red-700" }],
  ENTRETIEN:         [{ label: "→ Test",           action: "ENVOYER_TEST",        color: "bg-violet-600 text-white"  }, { label: "→ Validation",  action: "VALIDER_CANDIDATURE",   color: "bg-amber-600 text-white" }, { label: "Rejeter", action: "REJETER", color: "bg-red-100 text-red-700" }],
  TEST:              [{ label: "→ Validation",     action: "VALIDER_CANDIDATURE", color: "bg-amber-600 text-white"   }, { label: "Rejeter",        action: "REJETER",               color: "bg-red-100 text-red-700" }],
  VALIDATION:        [{ label: "Faire offre",      action: "FAIRE_OFFRE",         color: "bg-orange-600 text-white"  }, { label: "Rejeter",        action: "REJETER",               color: "bg-red-100 text-red-700" }],
  OFFRE:             [{ label: "→ Intégration",    action: "DEMARRER_INTEGRATION",color: "bg-teal-600 text-white"    }, { label: "Accepter ✓",    action: "ACCEPTER",              color: "bg-emerald-600 text-white" }, { label: "Rejeter", action: "REJETER", color: "bg-red-100 text-red-700" }],
  INTEGRATION:       [{ label: "Accepter ✓",      action: "ACCEPTER",            color: "bg-emerald-600 text-white" }, { label: "Rejeter",        action: "REJETER",               color: "bg-red-100 text-red-700" }],
};

// ── Page principale ───────────────────────────────────────────────────────────

export default function RecrutementRHPage() {
  const [view, setView] = useState<"postes" | "pipeline">("postes");
  const [selectedPosteId, setSelectedPosteId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/responsablesRH" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Recrutement</h1>
            <p className="text-sm text-slate-500 mt-0.5">Gestion des postes et pipeline de candidature</p>
          </div>
        </div>

        {/* Tabs vue */}
        <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 w-fit">
          {[
            { key: "postes",   label: "Postes ouverts",   icon: <Briefcase className="w-4 h-4" /> },
            { key: "pipeline", label: "Pipeline ATS",     icon: <BarChart3 className="w-4 h-4" /> },
          ].map((t) => (
            <button key={t.key} onClick={() => setView(t.key as "postes" | "pipeline")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                view === t.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {view === "postes" && <PostesView onPipeline={(id) => { setSelectedPosteId(id); setView("pipeline"); }} />}
        {view === "pipeline" && <PipelineView selectedPosteId={selectedPosteId} onSelectPoste={setSelectedPosteId} />}
      </div>
    </div>
  );
}

// ── Vue : Postes ──────────────────────────────────────────────────────────────

function PostesView({ onPipeline }: { onPipeline: (id: number) => void }) {
  const [search,    setSearch]    = useState("");
  const [searchIn,  setSearchIn]  = useState("");
  const [statut,    setStatut]    = useState("");
  const [page,      setPage]      = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [expanded,  setExpanded]  = useState<number | null>(null);

  const query = new URLSearchParams({ page: String(page), limit: "15",
    ...(search && { search }), ...(statut && { statut }) }).toString();
  const { data: res, loading, refetch } = useApi<PostesRes>(`/api/responsableRH/recrutement/postes?${query}`);

  const handleWorkflow = async (posteId: number, action: string) => {
    try {
      const r = await fetch(`/api/responsableRH/recrutement/postes/${posteId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await r.json();
      if (!r.ok) { toast.error(json.error ?? "Erreur"); return; }
      toast.success("Statut mis à jour"); refetch();
    } catch { toast.error("Erreur réseau"); }
  };

  const stats = res?.stats;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",     value: stats?.total    ?? 0, color: "text-slate-700" },
          { label: "Ouverts",   value: stats?.OUVERT   ?? 0, color: "text-emerald-700" },
          { label: "En cours",  value: stats?.EN_COURS ?? 0, color: "text-blue-700" },
          { label: "Pourvus",   value: stats?.POURVU   ?? 0, color: "text-purple-700" },
          { label: "Annulés",   value: stats?.ANNULE   ?? 0, color: "text-red-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchIn} onChange={(e) => setSearchIn(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchIn); setPage(1); } }}
              placeholder="Titre du poste, référence…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <button onClick={() => { setSearch(searchIn); setPage(1); }} className="px-3 py-2 bg-emerald-600 text-white rounded-lg">
            <Search className="w-4 h-4" />
          </button>
        </div>
        <select value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white">
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_POSTE_CFG).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Créer un poste
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : !res?.data.length ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Briefcase className="w-12 h-12 mb-2 opacity-30" /><p>Aucun poste trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {res.data.map((p) => {
            const cfg   = STATUT_POSTE_CFG[p.statut] ?? { label: p.statut, color: "bg-gray-100 text-gray-500" };
            const open  = expanded === p.id;
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-start gap-4 p-4 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(open ? null : p.id)}>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{p.titre}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                      {p.typeContrat && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{p.typeContrat}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="font-mono text-xs text-slate-400">{p.reference}</span>
                      {p.departement && <span className="text-xs text-slate-500">{p.departement}</span>}
                      {p.pointDeVente && <span className="text-xs text-slate-500 flex items-center gap-0.5">📍{p.pointDeVente.nom}</span>}
                      <span className="flex items-center gap-1 text-xs text-slate-500"><Users className="w-3 h-3" />{p._count.candidatures} candidat(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {["OUVERT", "EN_COURS"].includes(p.statut) && (
                      <CopyLinkButton posteId={p.id} />
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onPipeline(p.id); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200">
                      <Eye className="w-3.5 h-3.5" /> Pipeline
                    </button>
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-slate-100 p-4 space-y-4">
                    {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      {[
                        { label: "Nb de postes", value: p.nbPostes },
                        { label: "Ouverture",    value: p.dateOuverture ? formatDate(p.dateOuverture) : "—" },
                        { label: "Clôture",      value: p.dateCloture   ? formatDate(p.dateCloture)   : "—" },
                        { label: "Créé le",      value: formatDate(p.createdAt) },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="font-semibold text-slate-800 mt-0.5">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.statut === "BROUILLON" && <ActionBtn label="Ouvrir" color="emerald" onClick={() => handleWorkflow(p.id, "VALIDER")} />}
                      {p.statut === "OUVERT"    && <ActionBtn label="Démarrer" color="blue" onClick={() => handleWorkflow(p.id, "DEMARRER")} />}
                      {p.statut === "EN_COURS"  && <ActionBtn label="Marquer pourvu" color="purple" onClick={() => handleWorkflow(p.id, "MARQUER_POURVU")} />}
                      {["OUVERT","EN_COURS"].includes(p.statut) && <ActionBtn label="Annuler" color="red" onClick={() => handleWorkflow(p.id, "ANNULER")} />}
                      {p.statut === "ANNULE"    && <ActionBtn label="Rouvrir" color="slate" onClick={() => handleWorkflow(p.id, "ROUVRIR")} />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {res && res.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {res.meta.page} / {res.meta.totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Précédent</button>
            <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Suivant</button>
          </div>
        </div>
      )}

      {showModal && <CreerPosteModal onClose={() => setShowModal(false)} onCreated={refetch} />}
    </div>
  );
}

function CopyLinkButton({ posteId }: { posteId: number }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/postes/${posteId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={(e) => { e.stopPropagation(); copy(); }} title="Copier le lien de candidature"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors flex-shrink-0 ${
        copied
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copié !" : "Lien"}
    </button>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const MAP: Record<string, string> = {
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700",
    blue:    "bg-blue-600 text-white hover:bg-blue-700",
    purple:  "bg-purple-600 text-white hover:bg-purple-700",
    red:     "bg-red-100 text-red-700 hover:bg-red-200",
    slate:   "bg-slate-200 text-slate-700 hover:bg-slate-300",
  };
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg ${MAP[color] ?? MAP.slate}`}>
      <Play className="w-3 h-3" /> {label}
    </button>
  );
}

// ── Modal créer poste ─────────────────────────────────────────────────────────

function CreerPosteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/responsableRH/recrutement/postes", "POST");
  const [form, setForm] = useState({
    titre: "", typeContrat: "", departement: "", service: "",
    description: "", nbPostes: "1", dateOuverture: "", dateCloture: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titre.trim()) { toast.error("Le titre est obligatoire"); return; }
    const r = await mutate({
      titre:         form.titre,
      typeContrat:   form.typeContrat   || null,
      departement:   form.departement   || null,
      service:       form.service       || null,
      description:   form.description   || null,
      nbPostes:      Number(form.nbPostes) || 1,
      dateOuverture: form.dateOuverture || null,
      dateCloture:   form.dateCloture   || null,
    });
    if (r) { toast.success("Poste créé"); onCreated(); onClose(); }
  };

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Créer un poste</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Titre du poste *</label>
            <input value={form.titre} onChange={(e) => set("titre", e.target.value)} placeholder="Ex: Responsable commercial" className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Type de contrat</label>
              <select value={form.typeContrat} onChange={(e) => set("typeContrat", e.target.value)} className={`${inputCls} bg-white`}>
                <option value="">—</option>{["CDI","CDD","STAGE","CONSULTANT","PRESTATAIRE"].map((v) => <option key={v} value={v}>{v}</option>)}
              </select></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Nb de postes</label>
              <input type="number" min={1} value={form.nbPostes} onChange={(e) => set("nbPostes", e.target.value)} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Département</label>
              <input value={form.departement} onChange={(e) => set("departement", e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Service</label>
              <input value={form.service} onChange={(e) => set("service", e.target.value)} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Date ouverture</label>
              <input type="date" value={form.dateOuverture} onChange={(e) => set("dateOuverture", e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Date clôture</label>
              <input type="date" value={form.dateCloture} onChange={(e) => set("dateCloture", e.target.value)} className={inputCls} /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" /></div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue : Pipeline ATS ────────────────────────────────────────────────────────

function PipelineView({ selectedPosteId, onSelectPoste }: { selectedPosteId: number | null; onSelectPoste: (id: number) => void }) {
  const { data: postesRes } = useApi<PostesRes>("/api/responsableRH/recrutement/postes?limit=100&statut=EN_COURS");
  const { data: postesOuvert } = useApi<PostesRes>("/api/responsableRH/recrutement/postes?limit=100&statut=OUVERT");

  const allPostes = [
    ...(postesRes?.data ?? []),
    ...(postesOuvert?.data ?? []).filter((p) => !postesRes?.data.find((x) => x.id === p.id)),
  ];
  const posteActif = selectedPosteId ?? allPostes[0]?.id ?? null;

  return (
    <div className="space-y-5">
      {/* Sélecteur de poste */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
        <Briefcase className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <label className="text-sm font-medium text-slate-700 flex-shrink-0">Poste :</label>
        <select value={posteActif ?? ""} onChange={(e) => onSelectPoste(Number(e.target.value))}
          className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
          <option value="" disabled>Sélectionner un poste actif…</option>
          {allPostes.map((p) => <option key={p.id} value={p.id}>{p.reference} — {p.titre}</option>)}
        </select>
      </div>

      {posteActif ? (
        <CandidaturesPipeline posteId={posteActif} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <BarChart3 className="w-12 h-12 mb-2 opacity-30" /><p>Sélectionner un poste pour voir le pipeline</p>
        </div>
      )}
    </div>
  );
}

// ── Pipeline d'un poste ───────────────────────────────────────────────────────

function CandidaturesPipeline({ posteId }: { posteId: number }) {
  const { data: res, loading, refetch } = useApi<{ data: Candidature[] }>(
    `/api/responsableRH/recrutement/postes/${posteId}/candidatures`
  );
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [selectedCand,  setSelectedCand]  = useState<Candidature | null>(null);
  const [tempPassModal, setTempPassModal] = useState<{ tempPassword: string; profilRHId: number } | null>(null);

  const candidatures = res?.data ?? [];

  const handleAction = async (candId: number, action: string) => {
    try {
      const res2 = await fetch(`/api/responsableRH/recrutement/candidatures/${candId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res2.json();
      if (!res2.ok) { toast.error(json.error ?? "Erreur"); return; }
      toast.success(json.message ?? "Statut mis à jour");
      if (json.collaborateurCree && json.tempPassword) {
        setTempPassModal({ tempPassword: json.tempPassword, profilRHId: json.profilRHId });
      }
      refetch();
      setSelectedCand(null);
    } catch { toast.error("Erreur réseau"); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>;

  const byStatut = candidatures.reduce<Record<string, Candidature[]>>((acc, c) => {
    (acc[c.statut] ??= []).push(c); return acc;
  }, {});

  const COLUMNS = ["RECU","PRE_QUALIFICATION","SHORTLISTE","ENTRETIEN","TEST","VALIDATION","OFFRE","INTEGRATION","ACCEPTE"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">{candidatures.length} candidat(s) au total</p>
        <div className="flex gap-2">
          <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Ajouter candidat
          </button>
        </div>
      </div>

      {/* Board Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map((col) => {
            const list = byStatut[col] ?? [];
            const cfg  = STATUT_CAND_CFG[col];
            return (
              <div key={col} className="w-56 flex-shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-400 font-medium">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((c) => (
                    <div key={c.id} onClick={() => setSelectedCand(c)}
                      className="bg-white border border-slate-200 rounded-xl p-3 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.prenomCandidat} {c.nomCandidat}</p>
                          {c.email && <p className="text-xs text-slate-400 truncate"><Mail className="w-3 h-3 inline mr-0.5" />{c.email}</p>}
                          {c.telephone && <p className="text-xs text-slate-400"><Phone className="w-3 h-3 inline mr-0.5" />{c.telephone}</p>}
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      </div>
                      {(c.scoreCandidat != null || c.noteEntretien != null) && (
                        <div className="flex gap-2 mt-2">
                          {c.scoreCandidat  != null && <span className="flex items-center gap-0.5 text-[11px] text-amber-600"><Star className="w-3 h-3" /> {c.scoreCandidat}/10</span>}
                          {c.noteEntretien  != null && <span className="text-[11px] text-slate-400">E:{c.noteEntretien}/10</span>}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-300 mt-1">{formatDate(c.dateCandidature)}</p>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-300">Vide</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Colonne REJETE */}
          {(byStatut["REJETE"] ?? []).length > 0 && (
            <div className="w-56 flex-shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejetés</span>
                <span className="text-xs text-slate-400 font-medium">{byStatut["REJETE"].length}</span>
              </div>
              <div className="space-y-2">
                {byStatut["REJETE"].map((c) => (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3 opacity-60">
                    <p className="text-sm font-semibold text-slate-600 truncate">{c.prenomCandidat} {c.nomCandidat}</p>
                    <p className="text-[11px] text-slate-300">{formatDate(c.dateCandidature)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedCand  && <CandidatureDetailModal cand={selectedCand} onClose={() => setSelectedCand(null)} onAction={handleAction} />}
      {showAddModal  && <AjouterCandidatModal posteId={posteId} onClose={() => setShowAddModal(false)} onAdded={refetch} />}
      {tempPassModal && <TempPasswordModal {...tempPassModal} onClose={() => setTempPassModal(null)} />}
    </div>
  );
}

// ── Modal détail candidature ──────────────────────────────────────────────────

function CandidatureDetailModal({ cand, onClose, onAction }: {
  cand: Candidature; onClose: () => void; onAction: (id: number, action: string) => void;
}) {
  const cfg     = STATUT_CAND_CFG[cand.statut];
  const actions = PIPELINE_ACTIONS[cand.statut] ?? [];
  const { mutate, loading: saving } = useMutation(`/api/responsableRH/recrutement/candidatures/${cand.id}`, "PATCH");
  const [note, setNote]   = useState(cand.commentaire ?? "");
  const [score, setScore] = useState(String(cand.scoreCandidat ?? ""));

  const handleSave = async () => {
    const r = await mutate({ commentaire: note || null, scoreCandidat: score ? Number(score) : null });
    if (r) toast.success("Notes enregistrées");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900">{cand.prenomCandidat} {cand.nomCandidat}</h2>
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {cand.email     && <div className="col-span-2"><Mail className="w-3.5 h-3.5 inline mr-1 text-slate-400" /><span className="text-slate-700">{cand.email}</span></div>}
            {cand.telephone && <div><Phone className="w-3.5 h-3.5 inline mr-1 text-slate-400" /><span className="text-slate-700">{cand.telephone}</span></div>}
            {cand.dateEntretien && <div><Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-400" /><span className="text-slate-700">Entretien : {formatDate(cand.dateEntretien)}</span></div>}
            {cand.noteEntretien != null && <div><Star className="w-3.5 h-3.5 inline mr-1 text-amber-400" /><span className="text-slate-700">Note entretien : {cand.noteEntretien}/10</span></div>}
            {cand.noteTest      != null && <div><Star className="w-3.5 h-3.5 inline mr-1 text-violet-400" /><span className="text-slate-700">Note test : {cand.noteTest}/10</span></div>}
          </div>
          {cand.cvUrl && (
            <a href={cand.cvUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-emerald-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Voir le CV
            </a>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Score global (/10)</label>
            <input type="number" min={0} max={10} step={0.5} value={score} onChange={(e) => setScore(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Commentaire / Notes</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Enregistrer notes
          </button>
          {actions.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Actions pipeline</p>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((a) => (
                  <button key={a.action} onClick={() => onAction(cand.id, a.action)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg ${a.color}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal ajouter candidat ────────────────────────────────────────────────────

function AjouterCandidatModal({ posteId, onClose, onAdded }: { posteId: number; onClose: () => void; onAdded: () => void }) {
  const { mutate, loading } = useMutation(`/api/responsableRH/recrutement/postes/${posteId}/candidatures`, "POST");
  const [form, setForm] = useState({ prenomCandidat: "", nomCandidat: "", email: "", telephone: "", sourceCandidat: "", notes: "" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const handleSubmit = async () => {
    if (!form.prenomCandidat || !form.nomCandidat) { toast.error("Nom et prénom obligatoires"); return; }
    const r = await mutate({ ...form, email: form.email || null, telephone: form.telephone || null, sourceCandidat: form.sourceCandidat || null, notes: form.notes || null });
    if (r) { toast.success("Candidat ajouté"); onAdded(); onClose(); }
  };
  const ic = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-900">Ajouter un candidat</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><XCircle className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Prénom *</label><input value={form.prenomCandidat} onChange={(e) => set("prenomCandidat", e.target.value)} className={ic} /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Nom *</label><input value={form.nomCandidat} onChange={(e) => set("nomCandidat", e.target.value)} className={ic} /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={ic} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label><input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} className={ic} /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
            <select value={form.sourceCandidat} onChange={(e) => set("sourceCandidat", e.target.value)} className={`${ic} bg-white`}>
              <option value="">—</option>{["LinkedIn","Indeed","Référence interne","Candidature spontanée","Agence","Réseaux sociaux","Autre"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" /></div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />} Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal mot de passe temporaire ─────────────────────────────────────────────

function TempPasswordModal({ tempPassword, profilRHId, onClose }: { tempPassword: string; profilRHId: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(tempPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto bg-emerald-50 rounded-2xl flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Collaborateur créé !</h2>
            <p className="text-sm text-slate-500 mt-1">Communiquer ce mot de passe temporaire au nouvel employé :</p>
          </div>
          <div className="bg-slate-900 text-emerald-400 font-mono text-lg px-5 py-3 rounded-xl tracking-wider select-all">{tempPassword}</div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Ce mot de passe ne sera plus affiché. Notez-le maintenant.</span>
          </div>
          <div className="flex gap-3">
            <button onClick={copy} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border ${copied ? "border-emerald-400 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
              {copied ? <CheckCircle className="w-4 h-4" /> : null} {copied ? "Copié !" : "Copier"}
            </button>
            <Link href={`/dashboard/user/responsablesRH/collaborateurs/${profilRHId}`}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              Voir dossier
            </Link>
          </div>
          <button onClick={onClose} className="w-full text-sm text-slate-400 hover:text-slate-600 py-1">Fermer</button>
        </div>
      </div>
    </div>
  );
}
