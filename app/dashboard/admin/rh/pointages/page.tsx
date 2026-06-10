"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, CalendarDays,
  Plane, Sun, AlertTriangle, Search, ArrowLeft,
  BarChart2, Settings, Check, X, Edit2, ShieldCheck,
  Timer, TrendingUp, Users,
} from "lucide-react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfilRH {
  id: number; matricule: string;
  gestionnaire: { member: { id: number; nom: string; prenom: string } };
}

interface Pointage {
  id:             number;
  profilRHId:     number;
  date:           string;
  heureArrivee:   string | null;
  heureDepart:    string | null;
  statut:         string;
  notes:          string | null;
  justificatif:   string | null;
  tempsTotal:     number | null;
  retardMinutes:  number | null;
  heuresSup:      number | null;
  valideParId:    number | null;
  valideA:        string | null;
}

interface PointagesResponse {
  data:  Pointage[];
  meta:  { total: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: ProfilRH[];
}

interface RapportLine {
  profilRH:            { id: number; matricule: string; fonction: string | null; departement: string | null; nom: string; prenom: string };
  joursPresents:       number;
  joursRetard:         number;
  joursAbsents:        number;
  joursConge:          number;
  joursMission:        number;
  joursFeries:         number;
  demiJournees:        number;
  totalRetardMinutes:  number;
  totalHeuresSup:      number;
  totalTravailMinutes: number;
  tauxPresence:        number | null;
}

interface RapportResponse {
  data:    RapportLine[];
  totaux:  { joursOuvresMois: number; totalCollaborateurs: number; moyenneTauxPresence: number; totalRetardMinutes: number; totalHeuresSup: number };
  periode: { mois: number; annee: number };
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; bg: string; short: string; icon: React.ReactNode }> = {
  PRESENT:      { label: "Présent",      badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-500", short: "P",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ABSENT:       { label: "Absent",       badge: "bg-red-100 text-red-600",         bg: "bg-red-500",     short: "A",  icon: <XCircle      className="w-3.5 h-3.5" /> },
  RETARD:       { label: "Retard",       badge: "bg-amber-100 text-amber-700",     bg: "bg-amber-500",   short: "R",  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  DEMI_JOURNEE: { label: "Demi-journée", badge: "bg-blue-100 text-blue-700",       bg: "bg-blue-500",    short: "D",  icon: <Clock        className="w-3.5 h-3.5" /> },
  CONGE:        { label: "Congé",        badge: "bg-indigo-100 text-indigo-700",   bg: "bg-indigo-500",  short: "C",  icon: <CalendarDays className="w-3.5 h-3.5" /> },
  MISSION:      { label: "Mission",      badge: "bg-purple-100 text-purple-700",   bg: "bg-purple-500",  short: "M",  icon: <Plane        className="w-3.5 h-3.5" /> },
  FERIE:        { label: "Férié",        badge: "bg-slate-100 text-slate-500",     bg: "bg-slate-400",   short: "F",  icon: <Sun          className="w-3.5 h-3.5" /> },
};

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_LABELS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function isoDate(y: number, m: number, d: number) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function fmtMin(min: number) { const h = Math.floor(min / 60); const m = min % 60; return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2,"0") : ""}` : `${m}min`; }
function fmtTime(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PointagesPage() {
  const today  = new Date();
  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth());
  const [search, setSearch] = useState("");
  const [selectedCollab, setSelectedCollab] = useState<ProfilRH | null>(null);
  const [activeTab, setActiveTab] = useState<"calendrier" | "rapport">("calendrier");

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  const collabParams = new URLSearchParams();
  if (search) collabParams.set("search", search);
  collabParams.set("limit", "100");

  const { data: collabRes, loading: loadingCollabs } = useApi<CollabsResponse>(`/api/admin/rh/collaborateurs?${collabParams}`);
  const collabs = collabRes?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Pointage & Présence</h1>
            <p className="text-sm text-slate-500 mt-0.5">Suivi des temps de travail et présences</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/admin/rh/horaires"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600">
              <Settings className="w-4 h-4" /> Horaires
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([["calendrier", CalendarDays, "Calendrier individuel"], ["rapport", BarChart2, "Rapport mensuel"]] as const).map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {activeTab === "calendrier" ? (
          <div className="flex gap-6">
            {/* Sidebar collaborateurs */}
            <div className="w-64 flex-shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[75vh] overflow-y-auto">
                {loadingCollabs ? (
                  <div className="flex justify-center py-8 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
                ) : (
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
                )}
              </div>
            </div>

            {/* Calendrier */}
            <div className="flex-1 min-w-0">
              {selectedCollab ? (
                <PointageCalendar collab={selectedCollab} year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-36 text-slate-400">
                  <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Sélectionnez un collaborateur pour voir son pointage</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <RapportMensuel year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
        )}

      </div>
    </div>
  );
}

// ── Rapport mensuel ────────────────────────────────────────────────────────────

function RapportMensuel({ year, month, onPrev, onNext }: { year: number; month: number; onPrev: () => void; onNext: () => void }) {
  const [search, setSearch] = useState("");
  const params = new URLSearchParams({ mois: String(month + 1), annee: String(year) });
  if (search) params.set("departement", search);

  const { data: res, loading, refetch } = useApi<RapportResponse>(`/api/admin/rh/pointages/rapport?${params}`);
  const rapport = res?.data ?? [];
  const totaux  = res?.totaux;

  return (
    <div className="space-y-4">
      {/* Contrôles */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onPrev} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-base font-semibold text-slate-700">{MOIS_LABELS[month]} {year}</span>
          <button onClick={onNext} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={refetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer par département…"
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52" />
        </div>
      </div>

      {/* Totaux */}
      {totaux && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Jours ouvrés", value: totaux.joursOuvresMois, icon: <CalendarDays className="w-5 h-5" />, color: "text-slate-600 bg-slate-100" },
            { label: "Collaborateurs", value: totaux.totalCollaborateurs, icon: <Users className="w-5 h-5" />, color: "text-blue-600 bg-blue-100" },
            { label: "Taux présence moyen", value: `${totaux.moyenneTauxPresence}%`, icon: <TrendingUp className="w-5 h-5" />, color: "text-emerald-600 bg-emerald-100" },
            { label: "Total retards", value: totaux.totalRetardMinutes > 0 ? fmtMin(totaux.totalRetardMinutes) : "0", icon: <Timer className="w-5 h-5" />, color: "text-amber-600 bg-amber-100" },
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

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
        ) : rapport.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune donnée pour cette période</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Collaborateur</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs">Prés.</th>
                  <th className="text-center px-3 py-3 font-semibold text-amber-600 text-xs">Retard</th>
                  <th className="text-center px-3 py-3 font-semibold text-red-600 text-xs">Abs.</th>
                  <th className="text-center px-3 py-3 font-semibold text-indigo-600 text-xs">Congé</th>
                  <th className="text-center px-3 py-3 font-semibold text-purple-600 text-xs">Mission</th>
                  <th className="text-center px-3 py-3 font-semibold text-blue-600 text-xs">½J</th>
                  <th className="text-center px-3 py-3 font-semibold text-amber-600 text-xs">∑ Retards</th>
                  <th className="text-center px-3 py-3 font-semibold text-emerald-600 text-xs">H. Sup</th>
                  <th className="text-center px-3 py-3 font-semibold text-slate-600 text-xs">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rapport.map((r) => (
                  <tr key={r.profilRH.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.profilRH.prenom} {r.profilRH.nom}</p>
                      <p className="text-xs text-slate-400 font-mono">{r.profilRH.matricule}</p>
                      {r.profilRH.departement && <p className="text-xs text-slate-400">{r.profilRH.departement}</p>}
                    </td>
                    <td className="text-center px-3 py-3 font-semibold text-emerald-700">{r.joursPresents}</td>
                    <td className="text-center px-3 py-3 font-semibold text-amber-700">{r.joursRetard || "-"}</td>
                    <td className="text-center px-3 py-3 font-semibold text-red-600">{r.joursAbsents || "-"}</td>
                    <td className="text-center px-3 py-3 text-indigo-600">{r.joursConge || "-"}</td>
                    <td className="text-center px-3 py-3 text-purple-600">{r.joursMission || "-"}</td>
                    <td className="text-center px-3 py-3 text-blue-600">{r.demiJournees || "-"}</td>
                    <td className="text-center px-3 py-3 text-amber-700 text-xs">{r.totalRetardMinutes > 0 ? fmtMin(r.totalRetardMinutes) : "-"}</td>
                    <td className="text-center px-3 py-3 text-emerald-600 text-xs">{r.totalHeuresSup > 0 ? fmtMin(r.totalHeuresSup) : "-"}</td>
                    <td className="text-center px-3 py-3">
                      {r.tauxPresence !== null ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.tauxPresence >= 90 ? "bg-emerald-100 text-emerald-700" :
                          r.tauxPresence >= 70 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-600"
                        }`}>{r.tauxPresence}%</span>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendrier pointage ────────────────────────────────────────────────────────

function PointageCalendar({ collab, year, month, onPrev, onNext }: {
  collab: ProfilRH; year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  const { mutate: createPointage } = useMutation("/api/admin/rh/pointages", "POST");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const params = new URLSearchParams();
  params.set("profilRHId", String(collab.id));
  params.set("mois",  String(month + 1));
  params.set("annee", String(year));
  params.set("limit", "31");

  const { data: res, loading, refetch } = useApi<PointagesResponse>(`/api/admin/rh/pointages?${params}`);
  const pointages = res?.data ?? [];
  const stats     = res?.stats ?? {};

  const byDate = Object.fromEntries(pointages.map((p) => [p.date.slice(0, 10), p]));
  const days   = daysInMonth(year, month);

  const handleSetStatut = async (day: number, statut: string) => {
    const date = isoDate(year, month, day);
    const result = await createPointage({ profilRHId: collab.id, date, statut });
    if (result) { toast.success("Pointage enregistré"); refetch(); }
  };

  const member = collab.gestionnaire.member;
  const selectedPointage = selectedDay ? (byDate[selectedDay] ?? null) : null;

  return (
    <div className="flex gap-4">
      {/* Grille principale */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
              {member.prenom[0]}{member.nom[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{member.prenom} {member.nom}</p>
              <p className="text-xs text-slate-400 font-mono">{collab.matricule}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPrev} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-slate-700 min-w-28 text-center">{MOIS_LABELS[month]} {year}</span>
            <button onClick={onNext} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={refetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-2 px-5 py-2 border-b border-slate-100 flex-wrap">
          {Object.entries(STATUT_CONFIG).map(([k, cfg]) =>
            stats[k] ? (
              <span key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                {cfg.icon} {stats[k]}×{cfg.short}
              </span>
            ) : null
          )}
          {Object.keys(stats).length === 0 && !loading && <span className="text-xs text-slate-400">Aucun pointage ce mois</span>}
        </div>

        {/* Grille */}
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {JOURS_LABELS.map((j) => (
              <div key={j} className="text-center text-[10px] font-semibold text-slate-400 py-1">{j}</div>
            ))}
          </div>
          {(() => {
            const firstDow = new Date(year, month, 1).getDay();
            const cells: React.ReactNode[] = [];
            for (let i = 0; i < firstDow; i++) cells.push(<div key={`e-${i}`} />);
            for (let d = 1; d <= days; d++) {
              const dateStr = isoDate(year, month, d);
              const pt      = byDate[dateStr];
              const dow     = new Date(year, month, d).getDay();
              const isWE    = dow === 0 || dow === 6;
              const cfg     = pt ? (STATUT_CONFIG[pt.statut] ?? null) : null;
              cells.push(
                <DayCell key={d} day={d} dateStr={dateStr} isWE={isWE} pointage={pt ?? null} cfg={cfg}
                  isSelected={selectedDay === dateStr}
                  onSelect={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                  onSetStatut={(s) => handleSetStatut(d, s)} />
              );
            }
            return cells;
          })()}
        </div>

        {/* Légende */}
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
          {Object.entries(STATUT_CONFIG).map(([k, cfg]) => (
            <span key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${cfg.badge}`}>
              {cfg.short} — {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {/* Panneau de détail */}
      {selectedDay && (
        <PointageDetailPanel
          key={selectedDay}
          dateStr={selectedDay}
          pointage={selectedPointage}
          collab={collab}
          onClose={() => setSelectedDay(null)}
          onRefresh={refetch}
        />
      )}
    </div>
  );
}

// ── Cellule jour ───────────────────────────────────────────────────────────────

function DayCell({ day, dateStr, isWE, pointage, cfg, isSelected, onSelect, onSetStatut }: {
  day:         number;
  dateStr:     string;
  isWE:        boolean;
  pointage:    Pointage | null;
  cfg:         typeof STATUT_CONFIG[string] | null;
  isSelected:  boolean;
  onSelect:    () => void;
  onSetStatut: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const arrivee = fmtTime(pointage?.heureArrivee ?? null);
  const hasRetard = pointage && (pointage.retardMinutes ?? 0) > 0;
  const hasHsup   = pointage && (pointage.heuresSup     ?? 0) > 0;
  const isValidated = pointage?.valideParId != null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (pointage) onSelect(); else setOpen((v) => !v); }}
        onContextMenu={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        title={pointage ? `Clic: détail | Clic droit: changer statut` : `Clic: définir statut`}
        className={`w-full rounded-lg flex flex-col items-center justify-center transition-all border text-xs relative overflow-hidden py-1 min-h-[52px] ${
          isSelected
            ? "ring-2 ring-emerald-500 ring-offset-1"
            : ""
        } ${
          cfg
            ? `${cfg.badge} border-transparent font-semibold`
            : isWE
            ? "bg-slate-50 text-slate-300 border-slate-100"
            : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
        }`}
      >
        <span className="font-bold">{day}</span>
        {cfg && <span className="text-[8px] mt-0.5 opacity-80">{cfg.short}</span>}
        {arrivee && <span className="text-[8px] opacity-75">{arrivee}</span>}
        {isValidated && <ShieldCheck className="w-2.5 h-2.5 absolute top-1 right-1 text-emerald-500" />}
        {hasRetard && <span className="absolute bottom-0.5 left-1 w-1.5 h-1.5 rounded-full bg-amber-400" title="Retard" />}
        {hasHsup   && <span className="absolute bottom-0.5 right-1 w-1.5 h-1.5 rounded-full bg-blue-400"  title="H. sup" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-38 py-1" style={{ minWidth: 144 }}>
          <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{dateStr}</p>
          {Object.entries(STATUT_CONFIG).map(([k, c]) => (
            <button key={k} onClick={() => { onSetStatut(k); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 ${pointage?.statut === k ? "font-semibold" : ""}`}>
              <span className={`p-0.5 rounded ${c.badge}`}>{c.icon}</span>
              {c.label}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1 px-3 pb-1">
            <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panneau de détail d'un pointage ───────────────────────────────────────────

function PointageDetailPanel({ dateStr, pointage, collab, onClose, onRefresh }: {
  dateStr:   string;
  pointage:  Pointage | null;
  collab:    ProfilRH;
  onClose:   () => void;
  onRefresh: () => void;
}) {
  const { mutate: createPointage  } = useMutation("/api/admin/rh/pointages", "POST");
  const { mutate: updatePointage  } = useMutation(pointage ? `/api/admin/rh/pointages/${pointage.id}` : "", "PATCH");
  const { mutate: validerPointage } = useMutation(pointage ? `/api/admin/rh/pointages/${pointage.id}/valider` : "", "POST");

  const [statut,       setStatut]       = useState(pointage?.statut       ?? "PRESENT");
  const [heureArrivee, setHeureArrivee] = useState(fmtTime(pointage?.heureArrivee ?? null) ?? "");
  const [heureDepart,  setHeureDepart]  = useState(fmtTime(pointage?.heureDepart  ?? null) ?? "");
  const [notes,        setNotes]        = useState(pointage?.notes        ?? "");
  const [justificatif, setJustificatif] = useState(pointage?.justificatif ?? "");
  const [saving,  setSaving]  = useState(false);
  const [validing, setValiding] = useState(false);

  const buildDatetime = (dateStr: string, time: string) => {
    if (!time) return null;
    return `${dateStr}T${time}:00`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let ok: unknown;
      if (!pointage) {
        ok = await createPointage({
          profilRHId: collab.id,
          date: dateStr,
          statut,
          heureArrivee: buildDatetime(dateStr, heureArrivee),
          heureDepart:  buildDatetime(dateStr, heureDepart),
          notes:  notes  || null,
          justificatif: justificatif || null,
        });
      } else {
        ok = await updatePointage({
          statut,
          heureArrivee: buildDatetime(dateStr, heureArrivee),
          heureDepart:  buildDatetime(dateStr, heureDepart),
          notes:  notes  || null,
          justificatif: justificatif || null,
        });
      }
      if (ok) { toast.success("Pointage enregistré"); onRefresh(); }
    } finally {
      setSaving(false);
    }
  };

  const handleValider = async (valider: boolean) => {
    if (!pointage) return;
    setValiding(true);
    try {
      const ok = await validerPointage({ valider });
      if (ok) { toast.success(valider ? "Pointage validé" : "Validation annulée"); onRefresh(); }
    } finally {
      setValiding(false);
    }
  };

  const isValidated = pointage?.valideParId != null;

  return (
    <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          {isValidated && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <ShieldCheck className="w-3 h-3" /> Validé
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Statut */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Statut</label>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(STATUT_CONFIG).map(([k, c]) => (
              <button key={k} onClick={() => setStatut(k)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border transition-all ${
                  statut === k ? `${c.badge} border-transparent font-semibold` : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horaires */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Arrivée</label>
            <input type="time" value={heureArrivee} onChange={(e) => setHeureArrivee(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Départ</label>
            <input type="time" value={heureDepart} onChange={(e) => setHeureDepart(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        {/* Valeurs calculées */}
        {pointage && (pointage.tempsTotal || pointage.retardMinutes || pointage.heuresSup) && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
            {pointage.tempsTotal != null && pointage.tempsTotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Temps travaillé</span>
                <span className="font-semibold text-slate-700">{fmtMin(pointage.tempsTotal)}</span>
              </div>
            )}
            {(pointage.retardMinutes ?? 0) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-amber-600">Retard</span>
                <span className="font-semibold text-amber-700">{fmtMin(pointage.retardMinutes!)}</span>
              </div>
            )}
            {(pointage.heuresSup ?? 0) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-blue-600">Heures sup</span>
                <span className="font-semibold text-blue-700">{fmtMin(pointage.heuresSup!)}</span>
              </div>
            )}
          </div>
        )}

        {/* Justificatif */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Justificatif</label>
          <input type="text" value={justificatif} onChange={(e) => setJustificatif(e.target.value)}
            placeholder="Médical, transport…"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} placeholder="Remarque…"
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-200 space-y-2">
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />}
          {pointage ? "Mettre à jour" : "Créer le pointage"}
        </button>

        {pointage && (
          isValidated ? (
            <button onClick={() => handleValider(false)} disabled={validing}
              className="w-full flex items-center justify-center gap-2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              {validing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
              Annuler la validation
            </button>
          ) : (
            <button onClick={() => handleValider(true)} disabled={validing}
              className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded-lg border border-emerald-200 transition-colors disabled:opacity-50">
              {validing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Valider ce pointage
            </button>
          )
        )}
      </div>
    </div>
  );
}
