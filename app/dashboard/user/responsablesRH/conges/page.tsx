"use client";

import { useState, useCallback } from "react";
import {
  Search, RefreshCw, Filter, CheckCircle,
  Clock, XCircle, CalendarDays, X, Save,
  ArrowLeft, Plus, ChevronRight, ChevronLeft, Ban, Printer, BarChart2,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfilRH {
  id: number; matricule: string;
  gestionnaire: { member: { id: number; nom: string; prenom: string; photo: string | null } };
}

interface Demande {
  id:               number;
  type:             string;
  statut:           string;
  dateDebut:        string;
  dateFin:          string;
  nbJours:          number;
  motif:            string | null;
  commentaireRefus: string | null;
  createdAt:        string;
  profilRH:         ProfilRH;
}

interface DemandesResponse {
  data:  Demande[];
  meta:  { page: number; limit: number; total: number; totalPages: number };
  stats: Record<string, number>;
}

interface CollabsResponse { data: ProfilRH[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  EN_ATTENTE:     { label: "En attente",      badge: "bg-yellow-100 text-yellow-700", icon: <Clock      className="w-3.5 h-3.5" /> },
  VALIDE_MANAGER: { label: "Validé manager",  badge: "bg-blue-100 text-blue-700",    icon: <CheckCircle className="w-3.5 h-3.5" /> },
  VALIDE_RH:      { label: "Validé RH",       badge: "bg-indigo-100 text-indigo-700", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  APPROUVE:       { label: "Approuvé",         badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJETE:         { label: "Rejeté",           badge: "bg-red-100 text-red-700",      icon: <XCircle    className="w-3.5 h-3.5" /> },
  ANNULE:         { label: "Annulé",           badge: "bg-slate-100 text-slate-500",  icon: <Ban        className="w-3.5 h-3.5" /> },
};

const TYPE_CONGE: Record<string, string> = {
  ANNUEL: "Annuel", MALADIE: "Maladie", EXCEPTIONNEL: "Exceptionnel",
  PERMISSION: "Permission", FORMATION: "Formation",
  MATERNITE: "Maternité", PATERNITE: "Paternité", SANS_SOLDE: "Sans solde",
};

const TYPE_COLOR: Record<string, string> = {
  ANNUEL: "bg-emerald-100 text-emerald-700", MALADIE: "bg-red-100 text-red-600",
  EXCEPTIONNEL: "bg-amber-100 text-amber-700", PERMISSION: "bg-blue-100 text-blue-700",
  FORMATION: "bg-indigo-100 text-indigo-700", MATERNITE: "bg-pink-100 text-pink-700",
  PATERNITE: "bg-cyan-100 text-cyan-700", SANS_SOLDE: "bg-slate-100 text-slate-600",
};
const TYPE_DOT: Record<string, string> = {
  ANNUEL: "bg-emerald-500", MALADIE: "bg-red-500", EXCEPTIONNEL: "bg-amber-500",
  PERMISSION: "bg-blue-500", FORMATION: "bg-indigo-500", MATERNITE: "bg-pink-500",
  PATERNITE: "bg-cyan-500", SANS_SOLDE: "bg-slate-400",
};

const CAL_MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_LABELS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function isoDate(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

interface CalendrierResponse {
  data:    Demande[];
  byDay:   Record<string, { profilRHId: number; nom: string; prenom: string; type: string }[]>;
  periode: { annee: number; mois: number | null };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CongesRHPage() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<"demandes" | "calendrier" | "planning">("demandes");
  const [statut, setStatut] = useState("");
  const [search, setSearch] = useState("");
  const [page,   setPage]   = useState(1);
  const [showCreate,  setShowCreate]  = useState(false);
  const [rejectModal, setRejectModal] = useState<Demande | null>(null);

  // Calendrier
  const [calYear,  setCalYear]  = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const calParams = new URLSearchParams({ annee: String(calYear), mois: String(calMonth + 1) });
  const { data: calRes, loading: calLoading, refetch: calRefetch } = useApi<CalendrierResponse>(
    activeTab === "calendrier" ? `/api/responsableRH/conges/calendrier?${calParams}` : null
  );
  const prevCalMonth = () => { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); } else setCalMonth((m) => m - 1); };
  const nextCalMonth = () => { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); } else setCalMonth((m) => m + 1); };

  // Planning annuel
  const [planningAnnee, setPlanningAnnee] = useState(today.getFullYear());
  const planningParams = new URLSearchParams({ annee: String(planningAnnee) });
  const { data: planningRes, loading: planningLoading, refetch: planningRefetch } = useApi<CalendrierResponse>(
    activeTab === "planning" ? `/api/responsableRH/conges/calendrier?${planningParams}` : null
  );

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  if (search) params.set("search", search);
  params.set("page", String(page));

  const { data: res, loading, refetch } = useApi<DemandesResponse>(
    `/api/responsableRH/conges?${params}`
  );

  const demandes = res?.data  ?? [];
  const meta     = res?.meta;
  const stats    = res?.stats ?? {};

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleStatut = useCallback((v: string) => { setStatut(v); setPage(1); }, []);

  const enAttente = stats["EN_ATTENTE"] ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/responsablesRH" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Tableau de bord RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Congés & Absences</h1>
            <p className="text-sm text-slate-500 mt-0.5">Demandes de l&apos;équipe</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Nouvelle demande
            </button>
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            ["demandes",   "Demandes"],
            ["calendrier", "Calendrier"],
            ["planning",   "Planning annuel"],
          ] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === "demandes" && (<>
        {/* ── Alerte en attente ── */}
        {enAttente > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
            <strong>{enAttente}</strong> demande{enAttente > 1 ? "s" : ""} en attente de votre validation
            <button onClick={() => handleStatut("EN_ATTENTE")} className="ml-auto text-xs font-medium text-yellow-700 hover:underline flex items-center gap-1">
              Voir <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => handleStatut(statut === key ? "" : key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                statut === key
                  ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`p-1 rounded-md ${cfg.badge}`}>{cfg.icon}</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{stats[key] ?? 0}</p>
              <p className="text-xs text-slate-500 leading-snug">{cfg.label}</p>
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
              placeholder="Rechercher un collaborateur…"
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
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : demandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <CalendarDays className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune demande trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {demandes.map((d) => (
                <DemandeRow
                  key={d.id}
                  demande={d}
                  onReject={() => setRejectModal(d)}
                  onRefetch={refetch}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{meta.total} demandes</p>
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
        </>)}

        {/* ── TAB : CALENDRIER ── */}
        {activeTab === "calendrier" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <button onClick={prevCalMonth} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-base font-semibold text-slate-700">{CAL_MOIS_LABELS[calMonth]} {calYear}</span>
                <button onClick={nextCalMonth} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={calRefetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  {calLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
              <div className="hidden sm:flex flex-wrap gap-2">
                {Object.entries(TYPE_CONGE).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${TYPE_DOT[k]}`} />{v}
                  </span>
                ))}
              </div>
            </div>

            {calLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {JOURS_LABELS.map((j) => (
                    <div key={j} className="text-center text-[10px] font-semibold text-slate-400 py-1">{j}</div>
                  ))}
                </div>
                {(() => {
                  const byDay = calRes?.byDay ?? {};
                  const days  = daysInMonth(calYear, calMonth);
                  const firstDow = new Date(calYear, calMonth, 1).getDay();
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e-${i}`} />);
                  for (let d = 1; d <= days; d++) {
                    const dateStr = isoDate(calYear, calMonth, d);
                    const absents = byDay[dateStr] ?? [];
                    const dow     = new Date(calYear, calMonth, d).getDay();
                    const isWE    = dow === 0 || dow === 6;
                    const isToday = dateStr === new Date().toISOString().slice(0, 10);
                    cells.push(
                      <div key={d} className={`min-h-[80px] rounded-lg border p-1.5 ${
                        isToday ? "border-emerald-400 bg-emerald-50/50" :
                        isWE    ? "border-slate-100 bg-slate-50/50" :
                        "border-slate-100 bg-white"
                      }`}>
                        <p className={`text-xs font-semibold mb-1 ${isToday ? "text-emerald-600" : isWE ? "text-slate-300" : "text-slate-500"}`}>{d}</p>
                        <div className="space-y-0.5">
                          {absents.slice(0, 3).map((a, i) => (
                            <div key={i} className={`text-[9px] px-1 py-0.5 rounded truncate flex items-center gap-1 ${TYPE_COLOR[a.type] ?? "bg-gray-100 text-gray-600"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[a.type]}`} />
                              {a.prenom} {a.nom[0]}.
                            </div>
                          ))}
                          {absents.length > 3 && (
                            <p className="text-[9px] text-slate-400 pl-1">+{absents.length - 3} autres</p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── TAB : PLANNING ANNUEL ── */}
        {activeTab === "planning" && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <button onClick={() => setPlanningAnnee((y) => y - 1)} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-base font-semibold text-slate-700">Année {planningAnnee}</span>
                <button onClick={() => setPlanningAnnee((y) => y + 1)} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={planningRefetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  {planningLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
              <div className="hidden sm:flex flex-wrap gap-2">
                {Object.entries(TYPE_CONGE).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${TYPE_DOT[k]}`} />{v}
                  </span>
                ))}
              </div>
            </div>

            {planningLoading ? (
              <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
            ) : !planningRes?.data.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
                <p className="text-sm">Aucune absence approuvée sur {planningAnnee}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {CAL_MOIS_LABELS.map((label, m) => {
                  const monStart = new Date(planningAnnee, m, 1);
                  const monEnd   = new Date(planningAnnee, m + 1, 0, 23, 59, 59);
                  const items = (planningRes?.data ?? []).filter((d) =>
                    new Date(d.dateDebut) <= monEnd && new Date(d.dateFin) >= monStart
                  );
                  return (
                    <div key={label} className="border border-slate-100 rounded-lg p-3">
                      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
                      {items.length === 0 ? (
                        <p className="text-xs text-slate-300">Aucune absence</p>
                      ) : (
                        <div className="space-y-1.5">
                          {items.map((d) => (
                            <div key={d.id} className={`text-xs px-2 py-1 rounded flex items-center justify-between gap-2 ${TYPE_COLOR[d.type] ?? "bg-gray-100 text-gray-600"}`}>
                              <span className="flex items-center gap-1.5 truncate">
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOT[d.type]}`} />
                                {d.profilRH.gestionnaire.member.prenom} {d.profilRH.gestionnaire.member.nom}
                              </span>
                              <span className="flex-shrink-0 opacity-70">{formatDate(d.dateDebut)}–{formatDate(d.dateFin)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showCreate && (
        <CreateDemandeModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }}
        />
      )}
      {rejectModal && (
        <RejectModal
          demande={rejectModal}
          onClose={() => setRejectModal(null)}
          onRejected={() => { setRejectModal(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Ligne demande ───────────────────────────────────────────────────────────────

function DemandeRow({ demande, onReject, onRefetch }: {
  demande: Demande; onReject: () => void; onRefetch: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/responsableRH/conges/${demande.id}`, "PATCH");
  const cfg    = STATUT_CONFIG[demande.statut] ?? STATUT_CONFIG.EN_ATTENTE;
  const member = demande.profilRH.gestionnaire.member;

  const handleValider = async () => {
    const result = await mutate({ action: "VALIDER_MANAGER" });
    if (result) { toast.success("Demande validée"); onRefetch(); }
  };

  return (
    <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50">
      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
        {member.prenom[0]}{member.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800">{member.prenom} {member.nom}</span>
              <span className="text-xs text-slate-400 font-mono">{demande.profilRH.matricule}</span>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-slate-500">
              <span className="font-medium text-slate-700">{TYPE_CONGE[demande.type] ?? demande.type}</span>
              <span>{formatDate(demande.dateDebut)} → {formatDate(demande.dateFin)}</span>
              <span className="font-medium text-slate-700">{demande.nbJours} jour{demande.nbJours > 1 ? "s" : ""}</span>
              {demande.motif && <span className="text-slate-400 italic truncate max-w-48">{demande.motif}</span>}
            </div>
          </div>

          {/* Actions */}
          {demande.statut === "EN_ATTENTE" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleValider}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                Valider
              </button>
              <button
                onClick={onReject}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                Rejeter
              </button>
            </div>
          )}
          {demande.statut === "VALIDE_MANAGER" && (
            <span className="flex-shrink-0 text-xs text-blue-600 font-medium px-2 py-1 bg-blue-50 rounded-lg">
              En attente RH
            </span>
          )}
          <a
            href={`/api/responsableRH/conges/${demande.id}/pdf`}
            target="_blank" rel="noreferrer"
            title="Imprimer la demande"
            className="flex-shrink-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <Printer className="w-3.5 h-3.5" />
          </a>
        </div>
        {demande.commentaireRefus && (
          <p className="mt-1.5 text-xs text-red-600 italic">{demande.commentaireRefus}</p>
        )}
      </div>
    </div>
  );
}

// ── Modal création ──────────────────────────────────────────────────────────────

function CreateDemandeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { mutate, loading } = useMutation("/api/responsableRH/conges", "POST");
  const { data: collabRes } = useApi<CollabsResponse>("/api/responsableRH/collaborateurs?limit=200&statut=ACTIF");
  const collabs = collabRes?.data ?? [];

  const [form, setForm] = useState({
    profilRHId: "", type: "ANNUEL", dateDebut: "", dateFin: "", nbJours: "", motif: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.dateDebut || !form.dateFin || !form.nbJours) {
      toast.error("Collaborateur, dates et nombre de jours sont obligatoires");
      return;
    }
    const result = await mutate({
      profilRHId: Number(form.profilRHId),
      type:       form.type,
      dateDebut:  form.dateDebut,
      dateFin:    form.dateFin,
      nbJours:    Number(form.nbJours),
      motif:      form.motif || null,
    });
    if (result) { toast.success("Demande créée"); onCreated(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de congé</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Collaborateur *">
            <select value={form.profilRHId} onChange={(e) => set("profilRHId", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">— Sélectionner —</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom} ({c.matricule})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type de congé *">
            <select value={form.type} onChange={(e) => set("type", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
              {Object.entries(TYPE_CONGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date début *">
              <input type="date" value={form.dateDebut} onChange={(e) => set("dateDebut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="Date fin *">
              <input type="date" value={form.dateFin} onChange={(e) => set("dateFin", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
          </div>
          <Field label="Nombre de jours *">
            <input type="number" min="0.5" step="0.5" value={form.nbJours} onChange={(e) => set("nbJours", e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </Field>
          <Field label="Motif">
            <input value={form.motif} onChange={(e) => set("motif", e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </Field>
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

// ── Modal rejet ─────────────────────────────────────────────────────────────────

function RejectModal({ demande, onClose, onRejected }: {
  demande: Demande; onClose: () => void; onRejected: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/responsableRH/conges/${demande.id}`, "PATCH");
  const [commentaire, setCommentaire] = useState("");
  const member = demande.profilRH.gestionnaire.member;

  const handleReject = async () => {
    const result = await mutate({ action: "REJETER", commentaire: commentaire || null });
    if (result) { toast.success("Demande rejetée"); onRejected(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Rejeter la demande</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Demande de <strong>{member.prenom} {member.nom}</strong> — {TYPE_CONGE[demande.type] ?? demande.type} ({demande.nbJours}j)
          </p>
          <Field label="Motif du rejet">
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              placeholder="Expliquer la raison du rejet (optionnel)…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Annuler
          </button>
          <button onClick={handleReject} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers UI ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
