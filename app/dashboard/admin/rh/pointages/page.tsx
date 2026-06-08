"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, CalendarDays,
  Plane, Sun, AlertTriangle, Save, Search, ArrowLeft,
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
  id:           number;
  profilRHId:   number;
  date:         string;
  heureArrivee: string | null;
  heureDepart:  string | null;
  statut:       string;
  notes:        string | null;
}

interface PointagesResponse {
  data:  Pointage[];
  meta:  { total: number };
  stats: Record<string, number>;
}

interface CollabsResponse {
  data: ProfilRH[];
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; short: string; icon: React.ReactNode }> = {
  PRESENT:     { label: "Présent",     badge: "bg-emerald-100 text-emerald-700", short: "P",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  ABSENT:      { label: "Absent",      badge: "bg-red-100 text-red-600",         short: "A",  icon: <XCircle     className="w-3.5 h-3.5" /> },
  RETARD:      { label: "Retard",      badge: "bg-amber-100 text-amber-700",     short: "R",  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  DEMI_JOURNEE:{ label: "Demi-journée",badge: "bg-blue-100 text-blue-700",       short: "D",  icon: <Clock       className="w-3.5 h-3.5" /> },
  CONGE:       { label: "Congé",       badge: "bg-indigo-100 text-indigo-700",   short: "C",  icon: <CalendarDays className="w-3.5 h-3.5" /> },
  MISSION:     { label: "Mission",     badge: "bg-purple-100 text-purple-700",   short: "M",  icon: <Plane       className="w-3.5 h-3.5" /> },
  FERIE:       { label: "Férié",       badge: "bg-slate-100 text-slate-500",     short: "F",  icon: <Sun         className="w-3.5 h-3.5" /> },
};

const MOIS_LABELS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const JOURS_LABELS = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PointagesPage() {
  const today  = new Date();
  const [year,   setYear]   = useState(today.getFullYear());
  const [month,  setMonth]  = useState(today.getMonth()); // 0-based
  const [search, setSearch] = useState("");
  const [selectedCollab, setSelectedCollab] = useState<ProfilRH | null>(null);

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
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/admin/rh" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Dashboard RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Pointage & Présence</h1>
            <p className="text-sm text-slate-500 mt-0.5">Suivi des présences par collaborateur</p>
          </div>
        </div>

        <div className="flex gap-6">
          {/* ── Sidebar collaborateurs ── */}
          <div className="w-72 flex-shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={(e) => handleSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[70vh] overflow-y-auto">
              {loadingCollabs ? (
                <div className="flex justify-center py-8 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {collabs.map((c) => {
                    const m = c.gestionnaire.member;
                    return (
                      <button key={c.id} onClick={() => setSelectedCollab(c)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${selectedCollab?.id === c.id ? "bg-emerald-50" : ""}`}>
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

          {/* ── Grille calendrier ── */}
          <div className="flex-1 min-w-0">
            {selectedCollab ? (
              <PointageCalendar collab={selectedCollab} year={year} month={month} onPrev={prevMonth} onNext={nextMonth} />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-32 text-slate-400">
                <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez un collaborateur pour voir son pointage</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Calendrier pointage ────────────────────────────────────────────────────────

function PointageCalendar({ collab, year, month, onPrev, onNext }: {
  collab: ProfilRH; year: number; month: number; onPrev: () => void; onNext: () => void;
}) {
  const { mutate } = useMutation("/api/admin/rh/pointages", "POST");

  const params = new URLSearchParams();
  params.set("profilRHId", String(collab.id));
  params.set("mois",  String(month + 1));
  params.set("annee", String(year));
  params.set("limit", "31");

  const { data: res, loading, refetch } = useApi<PointagesResponse>(`/api/admin/rh/pointages?${params}`);
  const pointages = res?.data ?? [];
  const stats     = res?.stats ?? {};

  // Map date → pointage
  const byDate = Object.fromEntries(pointages.map((p) => [p.date.slice(0, 10), p]));
  const days   = daysInMonth(year, month);

  const setStatut = async (day: number, statut: string) => {
    const date = isoDate(year, month, day);
    const result = await mutate({ profilRHId: collab.id, date, statut });
    if (result) { toast.success("Pointage enregistré"); refetch(); }
  };

  const member = collab.gestionnaire.member;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
        <div className="flex items-center gap-3">
          <button onClick={onPrev} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-semibold text-slate-700">{MOIS_LABELS[month]} {year}</span>
          <button onClick={onNext} className="p-1.5 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={refetch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stats du mois */}
      <div className="flex gap-2 px-5 py-2 border-b border-slate-100 flex-wrap">
        {Object.entries(STATUT_CONFIG).map(([k, cfg]) => (
          stats[k] ? (
            <span key={k} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
              {cfg.icon} {stats[k]} {cfg.label}
            </span>
          ) : null
        ))}
        {Object.keys(stats).length === 0 && !loading && (
          <span className="text-xs text-slate-400">Aucun pointage ce mois</span>
        )}
      </div>

      {/* Grille */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {JOURS_LABELS.map((j) => (
            <div key={j} className="text-center text-[10px] font-semibold text-slate-400 py-1">{j}</div>
          ))}
        </div>
        {/* Cases vides avant le 1er */}
        {(() => {
          const firstDow = new Date(year, month, 1).getDay();
          const cells: React.ReactNode[] = [];
          for (let i = 0; i < firstDow; i++) cells.push(<div key={`empty-${i}`} />);
          for (let d = 1; d <= days; d++) {
            const dateStr = isoDate(year, month, d);
            const pt      = byDate[dateStr];
            const dow     = new Date(year, month, d).getDay();
            const isWE    = dow === 0 || dow === 6;
            const cfg     = pt ? (STATUT_CONFIG[pt.statut] ?? null) : null;
            cells.push(
              <DayCell key={d} day={d} isWE={isWE} pointage={pt ?? null} cfg={cfg} onSetStatut={(s) => setStatut(d, s)} />
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
  );
}

// ── Cellule jour ───────────────────────────────────────────────────────────────

function DayCell({ day, isWE, pointage, cfg, onSetStatut }: {
  day:         number;
  isWE:        boolean;
  pointage:    Pointage | null;
  cfg:         typeof STATUT_CONFIG[string] | null;
  onSetStatut: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all border ${
          cfg
            ? `${cfg.badge} border-transparent font-semibold`
            : isWE
            ? "bg-slate-50 text-slate-300 border-slate-100"
            : "bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
        }`}
      >
        <span>{day}</span>
        {cfg && <span className="text-[9px] mt-0.5">{cfg.short}</span>}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-36 py-1">
          {Object.entries(STATUT_CONFIG).map(([k, c]) => (
            <button key={k} onClick={() => { onSetStatut(k); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 ${pointage?.statut === k ? "font-semibold" : ""}`}>
              <span className={`p-0.5 rounded ${c.badge}`}>{c.icon}</span>
              {c.label}
            </button>
          ))}
          <div className="border-t border-slate-100 mt-1 pt-1">
            <button onClick={() => setOpen(false)} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50">
              <Save className="w-3 h-3" /> Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
