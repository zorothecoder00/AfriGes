"use client";

import { useState } from "react";
import {
  ArrowLeft, Plus, RefreshCw, Search, X, Save,
  Star, Zap, Users, Edit2, Trash2, BookOpen,
  ChevronDown, ChevronRight, LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Competence {
  id:          number;
  nom:         string;
  type:        string;
  categorie:   string | null;
  description: string | null;
  actif:       boolean;
  _count:      { collaborateurCompetences: number };
}

interface CompetencesResponse {
  data:  Competence[];
  stats: { total: number; hardSkills: number; softSkills: number; categories: string[] };
}

interface CollabNiveau {
  profilRH:   { id: number; matricule: string; nom: string; prenom: string; departement: string | null; fonction: string | null };
  niveaux:    Record<number, { niveau: string; dateAcquisition: string | null; notes: string | null }>;
}

interface MatriceResponse {
  competences:        { id: number; nom: string; type: string; categorie: string | null }[];
  collaborateurs:     CollabNiveau[];
  statsParCompetence: { competenceId: number; niveau: string; _count: { id: number } }[];
}

interface ProfilRH {
  id: number; matricule: string;
  gestionnaire: { member: { nom: string; prenom: string } };
}

// ── Constantes ────────────────────────────────────────────────────────────────

const NIVEAUX: { key: string; label: string; color: string; bg: string; dot: string }[] = [
  { key: "DEBUTANT",      label: "Débutant",      color: "text-slate-600",   bg: "bg-slate-100",   dot: "bg-slate-400"   },
  { key: "INTERMEDIAIRE", label: "Intermédiaire", color: "text-blue-700",    bg: "bg-blue-100",    dot: "bg-blue-400"    },
  { key: "AVANCE",        label: "Avancé",        color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500" },
  { key: "EXPERT",        label: "Expert",        color: "text-amber-700",   bg: "bg-amber-100",   dot: "bg-amber-500"   },
];

const NIVEAU_MAP = Object.fromEntries(NIVEAUX.map((n) => [n.key, n]));
const NIVEAU_ORDER: Record<string, number> = { DEBUTANT: 1, INTERMEDIAIRE: 2, AVANCE: 3, EXPERT: 4 };

const CATEGORIES_HARD  = ["Informatique", "Finance", "Gestion", "Commerce", "Technique", "Juridique", "Autre"];
const CATEGORIES_SOFT  = ["Leadership", "Communication", "Négociation", "Organisation", "Travail équipe", "Créativité", "Autre"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetencesPage() {
  const [activeTab, setActiveTab] = useState<"referentiel" | "matrice" | "collaborateur">("referentiel");
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Competence | null>(null);

  // Filtres référentiel
  const [filterType, setFilterType]   = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Filtres matrice
  const [matriceDept,  setMatriceDept]  = useState("");
  const [matriceType,  setMatriceType]  = useState("");
  const [matriceCat] = useState("");

  // Onglet collaborateur
  const [selectedCollab, setSelectedCollab] = useState<ProfilRH | null>(null);
  const [collabSearch,   setCollabSearch]   = useState("");

  const refParams = new URLSearchParams();
  if (filterType)   refParams.set("type",   filterType);
  if (filterSearch) refParams.set("search", filterSearch);

  const { data: refRes, loading: refLoading, refetch: refRefetch } =
    useApi<CompetencesResponse>(`/api/admin/rh/competences?${refParams}`);

  const matrParams = new URLSearchParams();
  if (matriceDept) matrParams.set("departement", matriceDept);
  if (matriceType) matrParams.set("type",        matriceType);
  if (matriceCat)  matrParams.set("categorie",   matriceCat);

  const { data: matrRes, loading: matrLoading, refetch: matrRefetch } =
    useApi<MatriceResponse>(
      activeTab === "matrice" ? `/api/admin/rh/competences/matrice?${matrParams}` : null
    );

  const { data: collabRes } =
    useApi<{ data: ProfilRH[] }>("/api/admin/rh/collaborateurs?limit=200");
  const collabs = (collabRes?.data ?? []).filter((c) => {
    if (!collabSearch) return true;
    const m = c.gestionnaire.member;
    return `${m.prenom} ${m.nom} ${c.matricule}`.toLowerCase().includes(collabSearch.toLowerCase());
  });

  const competences = refRes?.data ?? [];

  // Grouper par type puis catégorie
  const grouped: Record<string, Record<string, Competence[]>> = {};
  for (const c of competences) {
    const t = c.type;
    const g = c.categorie ?? "Sans catégorie";
    if (!grouped[t]) grouped[t] = {};
    if (!grouped[t][g]) grouped[t][g] = [];
    grouped[t][g].push(c);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Gestion des compétences</h1>
            <p className="text-sm text-slate-500 mt-0.5">Référentiel, niveaux et matrice des compétences collaborateurs</p>
          </div>
          {activeTab === "referentiel" && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" /> Nouvelle compétence
            </button>
          )}
        </div>

        {/* Stats */}
        {refRes?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total compétences", value: refRes.stats.total,      icon: <BookOpen className="w-5 h-5" />, color: "bg-slate-100 text-slate-600" },
              { label: "Hard Skills",        value: refRes.stats.hardSkills, icon: <Zap      className="w-5 h-5" />, color: "bg-blue-100 text-blue-700"   },
              { label: "Soft Skills",        value: refRes.stats.softSkills, icon: <Star     className="w-5 h-5" />, color: "bg-violet-100 text-violet-700" },
              { label: "Catégories",         value: refRes.stats.categories.length, icon: <LayoutGrid className="w-5 h-5" />, color: "bg-emerald-100 text-emerald-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}>{s.icon}</div>
                <div>
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            ["referentiel", BookOpen,     "Référentiel"],
            ["matrice",     LayoutGrid,   "Matrice"],
            ["collaborateur", Users,      "Par collaborateur"],
          ] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* ── TAB : RÉFÉRENTIEL ── */}
        {activeTab === "referentiel" && (
          <>
            {/* Filtres */}
            <div className="flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Rechercher une compétence…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                <option value="">Tous les types</option>
                <option value="HARD_SKILL">Hard Skills</option>
                <option value="SOFT_SKILL">Soft Skills</option>
              </select>
              <button onClick={refRefetch} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                {refLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
            </div>

            {/* Liste groupée */}
            {refLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : competences.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
                <BookOpen className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune compétence dans le référentiel</p>
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                  Ajouter la première
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {(["HARD_SKILL", "SOFT_SKILL"] as const).map((type) => {
                  const cats = grouped[type];
                  if (!cats) return null;
                  return (
                    <div key={type}>
                      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-3">
                        {type === "HARD_SKILL"
                          ? <><Zap className="w-4 h-4 text-blue-500" /> Hard Skills</>
                          : <><Star className="w-4 h-4 text-violet-500" /> Soft Skills</>}
                      </h2>
                      <div className="space-y-3">
                        {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, items]) => (
                          <CategoryGroup key={cat} categorie={cat} items={items}
                            onEdit={(c) => setEditTarget(c)}
                            onRefetch={refRefetch}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB : MATRICE ── */}
        {activeTab === "matrice" && (
          <>
            {/* Filtres */}
            <div className="flex gap-3 flex-wrap items-center">
              <input value={matriceDept} onChange={(e) => setMatriceDept(e.target.value)}
                placeholder="Filtrer par département…"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
              <select value={matriceType} onChange={(e) => setMatriceType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none">
                <option value="">Tous les types</option>
                <option value="HARD_SKILL">Hard Skills</option>
                <option value="SOFT_SKILL">Soft Skills</option>
              </select>
              <button onClick={matrRefetch} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                {matrLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
              <div className="ml-auto flex items-center gap-3">
                {NIVEAUX.map((n) => (
                  <span key={n.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={`w-2.5 h-2.5 rounded-full ${n.dot}`} />{n.label}
                  </span>
                ))}
              </div>
            </div>

            {matrLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : !matrRes || matrRes.competences.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-16 text-slate-400">
                <LayoutGrid className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune donnée à afficher</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-slate-600 sticky left-0 bg-slate-50 min-w-[180px]">Collaborateur</th>
                        {matrRes.competences.map((c) => (
                          <th key={c.id} className="px-2 py-3 text-center font-medium text-slate-600 min-w-[80px] max-w-[100px]">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`px-1 py-0.5 rounded text-[9px] font-semibold ${c.type === "HARD_SKILL" ? "bg-blue-100 text-blue-600" : "bg-violet-100 text-violet-600"}`}>
                                {c.type === "HARD_SKILL" ? "H" : "S"}
                              </span>
                              <span className="truncate max-w-[80px] text-center" title={c.nom}>{c.nom}</span>
                              {c.categorie && <span className="text-slate-400 text-[9px]">{c.categorie}</span>}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {matrRes.collaborateurs.map((collab) => (
                        <tr key={collab.profilRH.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 sticky left-0 bg-white hover:bg-slate-50">
                            <p className="font-medium text-slate-800">{collab.profilRH.prenom} {collab.profilRH.nom}</p>
                            <p className="text-slate-400 font-mono">{collab.profilRH.matricule}</p>
                            {collab.profilRH.departement && <p className="text-slate-400">{collab.profilRH.departement}</p>}
                          </td>
                          {matrRes.competences.map((c) => {
                            const n = collab.niveaux[c.id];
                            const nCfg = n ? NIVEAU_MAP[n.niveau] : null;
                            return (
                              <td key={c.id} className="px-2 py-2.5 text-center">
                                {nCfg ? (
                                  <span className={`inline-block w-6 h-6 rounded-full ${nCfg.dot}`}
                                    title={`${nCfg.label}${n?.notes ? ` — ${n.notes}` : ""}`} />
                                ) : (
                                  <span className="inline-block w-6 h-6 rounded-full bg-slate-100" title="Non évalué" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB : PAR COLLABORATEUR ── */}
        {activeTab === "collaborateur" && (
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-64 flex-shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={collabSearch} onChange={(e) => setCollabSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[70vh] overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  {collabs.map((c) => {
                    const m = c.gestionnaire.member;
                    return (
                      <button key={c.id} onClick={() => setSelectedCollab(c)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedCollab?.id === c.id ? "bg-emerald-50 border-l-2 border-emerald-500" : ""}`}>
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {m.prenom[0]}{m.nom[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.prenom} {m.nom}</p>
                          <p className="text-xs text-slate-400 font-mono">{c.matricule}</p>
                        </div>
                      </button>
                    );
                  })}
                  {collabs.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Aucun collaborateur</p>}
                </div>
              </div>
            </div>

            {/* Compétences du collaborateur sélectionné */}
            <div className="flex-1 min-w-0">
              {selectedCollab ? (
                <CollaborateurCompetences
                  collab={selectedCollab}
                  referentiel={refRes?.data ?? []}
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center py-36 text-slate-400">
                  <Users className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Sélectionnez un collaborateur</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal créer/éditer compétence */}
      {(showCreate || editTarget) && (
        <CompetenceModal
          initial={editTarget}
          onClose={() => { setShowCreate(false); setEditTarget(null); }}
          onSaved={() => { setShowCreate(false); setEditTarget(null); refRefetch(); }}
        />
      )}
    </div>
  );
}

// ── Groupe catégorie ───────────────────────────────────────────────────────────

function CategoryGroup({ categorie, items, onEdit, onRefetch }: {
  categorie: string;
  items:     Competence[];
  onEdit:    (c: Competence) => void;
  onRefetch: () => void;
}) {
  const [open, setOpen] = useState(true);

  const handleDelete = async (c: Competence) => {
    if (!confirm(`Supprimer "${c.nom}" ?`)) return;
    const res = await fetch(`/api/admin/rh/competences/${c.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
    toast.success(data.desactive ? data.message : "Compétence supprimée");
    onRefetch();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="text-sm font-semibold text-slate-700">{categorie}</span>
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{items.length}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center gap-4 px-4 py-3 group ${!item.actif ? "opacity-50" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{item.nom}</span>
                  {!item.actif && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactif</span>}
                </div>
                {item.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</p>}
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded flex items-center gap-1">
                <Users className="w-3 h-3" /> {item._count.collaborateurCompetences}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Compétences d'un collaborateur ────────────────────────────────────────────

function CollaborateurCompetences({ collab, referentiel }: { collab: ProfilRH; referentiel: Competence[] }) {
  const m = collab.gestionnaire.member;
  const { data: res, loading, refetch } = useApi<{ data: {
    id: number; competenceId: number; niveau: string; dateAcquisition: string | null; notes: string | null;
    competence: { id: number; nom: string; type: string; categorie: string | null };
  }[] }>(`/api/admin/rh/collaborateurs/${collab.id}/competences`);

  const competencesCollab = res?.data ?? [];
  const assignedIds = new Set(competencesCollab.map((c) => c.competenceId));
  const [showAdd, setShowAdd] = useState(false);
  const [editComp, setEditComp] = useState<{ competenceId: number; niveau: string; notes: string } | null>(null);

  const grouped: Record<string, typeof competencesCollab> = {};
  for (const c of competencesCollab) {
    const g = c.competence.type;
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  }

  const handleRemove = async (competenceId: number) => {
    const res2 = await fetch(`/api/admin/rh/collaborateurs/${collab.id}/competences`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competenceId }),
    });
    if (res2.ok) { toast.success("Compétence retirée"); refetch(); }
    else { const d = await res2.json(); toast.error(d.error ?? "Erreur"); }
  };

  const handleSaveEdit = async () => {
    if (!editComp) return;
    const res2 = await fetch(`/api/admin/rh/collaborateurs/${collab.id}/competences`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competenceId: editComp.competenceId, niveau: editComp.niveau, notes: editComp.notes || null }),
    });
    if (res2.ok) { toast.success("Niveau mis à jour"); setEditComp(null); refetch(); }
    else { const d = await res2.json(); toast.error(d.error ?? "Erreur"); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
            {m.prenom[0]}{m.nom[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{m.prenom} {m.nom}</p>
            <p className="text-xs text-slate-400 font-mono">{collab.matricule}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
      ) : competencesCollab.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <BookOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Aucune compétence enregistrée</p>
        </div>
      ) : (
        <div className="p-5 space-y-5">
          {(["HARD_SKILL", "SOFT_SKILL"] as const).map((type) => {
            const items = grouped[type];
            if (!items?.length) return null;
            return (
              <div key={type}>
                <h3 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  {type === "HARD_SKILL" ? <><Zap className="w-3.5 h-3.5 text-blue-500" /> Hard Skills</> : <><Star className="w-3.5 h-3.5 text-violet-500" /> Soft Skills</>}
                </h3>
                <div className="space-y-2">
                  {items.sort((a, b) => (NIVEAU_ORDER[b.niveau] ?? 0) - (NIVEAU_ORDER[a.niveau] ?? 0)).map((c) => {
                    const nCfg = NIVEAU_MAP[c.niveau];
                    const isEditing = editComp?.competenceId === c.competenceId;
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-slate-200 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{c.competence.nom}</span>
                            {c.competence.categorie && <span className="text-xs text-slate-400">{c.competence.categorie}</span>}
                          </div>
                          {c.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{c.notes}</p>}
                          {c.dateAcquisition && (
                            <p className="text-xs text-slate-400">Acquis le {new Date(c.dateAcquisition).toLocaleDateString("fr-FR")}</p>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <select value={editComp.niveau}
                              onChange={(e) => setEditComp((prev) => prev ? { ...prev, niveau: e.target.value } : null)}
                              className="px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
                              {NIVEAUX.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
                            </select>
                            <input value={editComp.notes}
                              onChange={(e) => setEditComp((prev) => prev ? { ...prev, notes: e.target.value } : null)}
                              placeholder="Notes…" className="px-2 py-1 border border-slate-200 rounded-lg text-xs w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                            <button onClick={handleSaveEdit} className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setEditComp(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${nCfg.bg} ${nCfg.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${nCfg.dot}`} />{nCfg.label}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditComp({ competenceId: c.competenceId, niveau: c.niveau, notes: c.notes ?? "" })}
                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleRemove(c.competenceId)}
                                className="p-1 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal ajouter */}
      {showAdd && (
        <AddCompetenceModal
          profilRHId={collab.id}
          referentiel={referentiel.filter((r) => r.actif && !assignedIds.has(r.id))}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Modal ajouter compétence à un collaborateur ───────────────────────────────

function AddCompetenceModal({ profilRHId, referentiel, onClose, onAdded }: {
  profilRHId:  number;
  referentiel: Competence[];
  onClose:     () => void;
  onAdded:     () => void;
}) {
  const [competenceId,    setCompetenceId]    = useState("");
  const [niveau,          setNiveau]          = useState("DEBUTANT");
  const [dateAcquisition, setDateAcquisition] = useState("");
  const [notes,           setNotes]           = useState("");
  const [saving,          setSaving]          = useState(false);

  // Grouper par type
  const groupedRef: Record<string, Competence[]> = {};
  for (const c of referentiel) {
    if (!groupedRef[c.type]) groupedRef[c.type] = [];
    groupedRef[c.type].push(c);
  }

  const handleSave = async () => {
    if (!competenceId || !niveau) { toast.error("Sélectionnez une compétence et un niveau"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/rh/collaborateurs/${profilRHId}/competences`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competenceId: Number(competenceId), niveau,
          dateAcquisition: dateAcquisition || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur"); return; }
      toast.success("Compétence ajoutée");
      onAdded();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Ajouter une compétence</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Compétence</label>
            <select value={competenceId} onChange={(e) => setCompetenceId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {(["HARD_SKILL", "SOFT_SKILL"] as const).map((type) => {
                const items = groupedRef[type];
                if (!items?.length) return null;
                return (
                  <optgroup key={type} label={type === "HARD_SKILL" ? "⚡ Hard Skills" : "⭐ Soft Skills"}>
                    {items.sort((a, b) => (a.categorie ?? "").localeCompare(b.categorie ?? "") || a.nom.localeCompare(b.nom)).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.categorie ? `[${c.categorie}] ` : ""}{c.nom}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Niveau</label>
            <div className="grid grid-cols-2 gap-2">
              {NIVEAUX.map((n) => (
                <button key={n.key} type="button" onClick={() => setNiveau(n.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    niveau === n.key ? `${n.bg} ${n.color} border-transparent font-semibold` : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${n.dot}`} />{n.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date d&apos;acquisition (optionnel)</label>
            <input type="date" value={dateAcquisition} onChange={(e) => setDateAcquisition(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optionnel)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexte d'acquisition…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button onClick={handleSave} disabled={saving || !competenceId}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal créer/éditer une compétence ─────────────────────────────────────────

function CompetenceModal({ initial, onClose, onSaved }: {
  initial: Competence | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [nom,         setNom]         = useState(initial?.nom         ?? "");
  const [type,        setType]        = useState(initial?.type        ?? "HARD_SKILL");
  const [categorie,   setCategorie]   = useState(initial?.categorie   ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving,      setSaving]      = useState(false);

  const categories = type === "HARD_SKILL" ? CATEGORIES_HARD : CATEGORIES_SOFT;

  const { mutate: create } = useMutation("/api/admin/rh/competences", "POST");
  const { mutate: update } = useMutation(initial ? `/api/admin/rh/competences/${initial.id}` : "", "PATCH");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const payload = { nom: nom.trim(), type, categorie: categorie || null, description: description || null };
      const result = isEdit ? await update(payload) : await create(payload);
      if (result) { toast.success(isEdit ? "Compétence mise à jour" : "Compétence créée"); onSaved(); }
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">{isEdit ? "Modifier la compétence" : "Nouvelle compétence"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[["HARD_SKILL", "⚡ Hard Skill"], ["SOFT_SKILL", "⭐ Soft Skill"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => { setType(k); setCategorie(""); }}
                  className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                    type === k ? (k === "HARD_SKILL" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-violet-100 text-violet-700 border-violet-200") : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
            <select value={categorie} onChange={(e) => setCategorie(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sans catégorie —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom *</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} required
              placeholder="Ex: Excel avancé, Prise de parole…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description (optionnel)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Ce que cette compétence implique…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
