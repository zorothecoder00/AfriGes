"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw, ChevronLeft, ChevronRight, ArrowLeft,
  CheckCircle, XCircle, Clock, Plane, Sun, AlertTriangle,
  Search, Plus, X, Save, ShieldCheck,
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
  id:            number;
  profilRHId:    number;
  date:          string;
  heureArrivee:  string | null;
  heureDepart:   string | null;
  statut:        string;
  notes:         string | null;
  justificatif:  string | null;
  tempsTotal:    number | null;
  retardMinutes: number | null;
  heuresSup:     number | null;
  valideParId:   number | null;
}

interface PointagesResponse {
  data:  Pointage[];
  meta:  { total: number };
  stats: Record<string, number>;
}

interface CollabsResponse { data: ProfilRH[] }

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; badge: string; icon: React.ReactNode; bgCell: string }> = {
  PRESENT:     { label: "Présent",     badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="w-3 h-3" />, bgCell: "bg-emerald-50 border-emerald-200"   },
  ABSENT:      { label: "Absent",      badge: "bg-red-100 text-red-700",         icon: <XCircle     className="w-3 h-3" />, bgCell: "bg-red-50 border-red-200"           },
  RETARD:      { label: "Retard",      badge: "bg-amber-100 text-amber-700",     icon: <Clock       className="w-3 h-3" />, bgCell: "bg-amber-50 border-amber-200"       },
  DEMI_JOURNEE:{ label: "½ journée",   badge: "bg-orange-100 text-orange-700",   icon: <Sun         className="w-3 h-3" />, bgCell: "bg-orange-50 border-orange-200"     },
  CONGE:       { label: "Congé",       badge: "bg-blue-100 text-blue-700",       icon: <Sun         className="w-3 h-3" />, bgCell: "bg-blue-50 border-blue-200"         },
  MISSION:     { label: "Mission",     badge: "bg-purple-100 text-purple-700",   icon: <Plane       className="w-3 h-3" />, bgCell: "bg-purple-50 border-purple-200"     },
  FERIE:       { label: "Férié",       badge: "bg-slate-100 text-slate-500",     icon: <Sun         className="w-3 h-3" />, bgCell: "bg-slate-50 border-slate-200"       },
};

const STATUTS = Object.keys(STATUT_CONFIG);

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PointagesRHPage() {
  const today = new Date();
  const [mois,       setMois]       = useState(today.getMonth() + 1);
  const [annee,      setAnnee]      = useState(today.getFullYear());
  const [profilId,   setProfilId]   = useState("");
  const [search,     setSearch]     = useState("");
  const [showSaisie, setShowSaisie] = useState(false);
  const [selectedPt, setSelectedPt] = useState<Pointage | null>(null);

  const params = new URLSearchParams();
  params.set("mois",  String(mois));
  params.set("annee", String(annee));
  params.set("limit", "100");
  if (profilId) params.set("profilRHId", profilId);
  if (search)   params.set("search", search);

  const { data: res, loading, refetch } = useApi<PointagesResponse>(
    `/api/responsableRH/pointages?${params}`
  );
  const { data: collabRes } = useApi<CollabsResponse>("/api/responsableRH/collaborateurs?limit=200&statut=ACTIF");

  const pointages = res?.data   ?? [];
  const stats     = res?.stats  ?? {};
  const collabs   = collabRes?.data ?? [];

  const handleSearch = useCallback((v: string) => setSearch(v), []);

  const prevMonth = () => {
    if (mois === 1) { setMois(12); setAnnee((y) => y - 1); }
    else setMois((m) => m - 1);
  };
  const nextMonth = () => {
    if (mois === 12) { setMois(1); setAnnee((y) => y + 1); }
    else setMois((m) => m + 1);
  };

  const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  // Index pointages par date pour la vue calendrier
  const byDate: Record<string, Pointage> = {};
  for (const p of pointages) {
    byDate[p.date.slice(0, 10)] = p;
  }

  // Jours du mois
  const daysInMonth = new Date(annee, mois, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(annee, mois - 1, i + 1);
    return {
      iso:     d.toISOString().slice(0, 10),
      num:     i + 1,
      dayName: d.toLocaleDateString("fr-FR", { weekday: "short" }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    };
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* ── En-tête ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/responsablesRH" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Tableau de bord RH
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Présences & Pointages</h1>
            <p className="text-sm text-slate-500 mt-0.5">Suivi de l&apos;équipe</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refetch} className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSaisie(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" /> Saisir un pointage
            </button>
          </div>
        </div>

        {/* ── Stats du mois ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["PRESENT", "ABSENT", "RETARD", "CONGE"].map((k) => {
            const cfg = STATUT_CONFIG[k];
            return (
              <div key={k} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`p-1.5 rounded-lg ${cfg.badge}`}>{cfg.icon}</span>
                  <span className="text-xs text-slate-500">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-900">{stats[k] ?? 0}</p>
              </div>
            );
          })}
        </div>

        {/* ── Navigation mois + filtres ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded">
              <ChevronLeft className="w-4 h-4 text-slate-500" />
            </button>
            <span className="text-sm font-medium text-slate-800 min-w-[100px] text-center">
              {MOIS_LABELS[mois - 1]} {annee}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded">
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="flex-1 min-w-40">
            <select
              value={profilId}
              onChange={(e) => setProfilId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Toute l&apos;équipe</option>
              {collabs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gestionnaire.member.prenom} {c.gestionnaire.member.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Rechercher…"
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* ── Vue calendrier (1 collaborateur) ou liste (toute l'équipe) ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
          </div>
        ) : profilId ? (
          // Vue calendrier mensuel pour un collaborateur
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <CalendarGrid className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-700">
                Calendrier — {collabs.find((c) => String(c.id) === profilId)?.gestionnaire.member.prenom}{" "}
                {collabs.find((c) => String(c.id) === profilId)?.gestionnaire.member.nom}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-100">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="bg-white px-2 py-1.5 text-center text-xs font-medium text-slate-400">
                  {d}
                </div>
              ))}
              {/* Jours vides avant le premier */}
              {Array.from({ length: (new Date(annee, mois - 1, 1).getDay() + 6) % 7 }).map((_, i) => (
                <div key={`e${i}`} className="bg-white min-h-[60px]" />
              ))}
              {days.map((day) => {
                const pt = byDate[day.iso];
                const cfg = pt ? (STATUT_CONFIG[pt.statut] ?? STATUT_CONFIG.PRESENT) : null;
                return (
                  <div
                    key={day.iso}
                    onClick={() => pt && setSelectedPt(pt)}
                    className={`min-h-[60px] p-2 cursor-pointer transition-all border-t ${
                      day.isWeekend ? "bg-slate-50" : "bg-white"
                    } ${cfg ? `${cfg.bgCell} border` : "border-transparent"} hover:border-emerald-300`}
                  >
                    <p className={`text-xs font-medium mb-1 ${day.isWeekend ? "text-slate-400" : "text-slate-700"}`}>
                      {day.num}
                    </p>
                    {cfg && (
                      <div className="space-y-0.5">
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${cfg.badge} px-1.5 py-0.5 rounded`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {pt?.retardMinutes && pt.retardMinutes > 0 && (
                          <p className="text-[10px] text-amber-600">{pt.retardMinutes} min retard</p>
                        )}
                        {pt?.valideParId && (
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Vue liste par collaborateur
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                {pointages.length} pointage{pointages.length !== 1 ? "s" : ""} ce mois
              </p>
            </div>
            {pointages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <AlertTriangle className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Aucun pointage enregistré</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {pointages.slice(0, 50).map((pt) => {
                  const cfg = STATUT_CONFIG[pt.statut] ?? STATUT_CONFIG.PRESENT;
                  return (
                    <div key={pt.id}
                      onClick={() => setSelectedPt(pt)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="w-16 text-center">
                        <p className="text-xs font-mono font-medium text-slate-600">
                          {new Date(pt.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {pt.heureArrivee && (
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(pt.heureArrivee).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          {pt.heureDepart && ` → ${new Date(pt.heureDepart).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                        </span>
                      )}
                      {pt.retardMinutes && pt.retardMinutes > 0 && (
                        <span className="text-xs text-amber-600">{pt.retardMinutes} min retard</span>
                      )}
                      {pt.valideParId && <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 ml-auto" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showSaisie && (
        <SaisieModal
          collabs={collabs}
          onClose={() => setShowSaisie(false)}
          onSaved={() => { setShowSaisie(false); refetch(); }}
        />
      )}
      {selectedPt && (
        <PointageDetailModal
          pointage={selectedPt}
          onClose={() => setSelectedPt(null)}
          onUpdated={() => { setSelectedPt(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Icône calendrier (inline) ──────────────────────────────────────────────────
function CalendarGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// ── Modal saisie ───────────────────────────────────────────────────────────────

function SaisieModal({ collabs, onClose, onSaved }: {
  collabs: ProfilRH[]; onClose: () => void; onSaved: () => void;
}) {
  const { mutate, loading } = useMutation("/api/responsableRH/pointages", "POST");
  const [form, setForm] = useState({
    profilRHId:   "",
    date:         new Date().toISOString().slice(0, 10),
    statut:       "PRESENT",
    heureArrivee: "",
    heureDepart:  "",
    notes:        "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.profilRHId || !form.date || !form.statut) {
      toast.error("Collaborateur, date et statut sont obligatoires");
      return;
    }
    const toDatetime = (dateStr: string, timeStr: string) => {
      if (!timeStr) return undefined;
      return `${dateStr}T${timeStr}:00`;
    };
    const result = await mutate({
      profilRHId:   Number(form.profilRHId),
      date:         form.date,
      statut:       form.statut,
      heureArrivee: toDatetime(form.date, form.heureArrivee),
      heureDepart:  toDatetime(form.date, form.heureDepart),
      notes:        form.notes || null,
    });
    if (result) { toast.success("Pointage enregistré"); onSaved(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Saisir un pointage</h2>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date *">
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </Field>
            <Field label="Statut *">
              <select value={form.statut} onChange={(e) => set("statut", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {STATUTS.map((s) => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
              </select>
            </Field>
          </div>
          {["PRESENT", "RETARD", "DEMI_JOURNEE"].includes(form.statut) && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Heure arrivée">
                <input type="time" value={form.heureArrivee} onChange={(e) => set("heureArrivee", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
              <Field label="Heure départ">
                <input type="time" value={form.heureDepart} onChange={(e) => set("heureDepart", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
            </div>
          )}
          <Field label="Notes">
            <input value={form.notes} onChange={(e) => set("notes", e.target.value)}
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
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail / validation ──────────────────────────────────────────────────

function PointageDetailModal({ pointage, onClose, onUpdated }: {
  pointage: Pointage; onClose: () => void; onUpdated: () => void;
}) {
  const { mutate, loading } = useMutation(`/api/responsableRH/pointages/${pointage.id}`, "PATCH");
  const cfg = STATUT_CONFIG[pointage.statut] ?? STATUT_CONFIG.PRESENT;

  const handleValider = async () => {
    const result = await mutate({ action: "VALIDER" });
    if (result) { toast.success("Pointage validé"); onUpdated(); }
  };

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="font-semibold text-slate-900">
              {new Date(pointage.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge} mt-1 w-fit`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-3">
          <Row label="Arrivée"  value={fmt(pointage.heureArrivee)} />
          <Row label="Départ"   value={fmt(pointage.heureDepart)} />
          {pointage.tempsTotal    != null && <Row label="Temps total"    value={`${Math.floor(pointage.tempsTotal / 60)}h${String(pointage.tempsTotal % 60).padStart(2, "0")}`} />}
          {pointage.retardMinutes != null && pointage.retardMinutes > 0 && <Row label="Retard" value={`${pointage.retardMinutes} min`} color="text-amber-600" />}
          {pointage.heuresSup     != null && pointage.heuresSup     > 0 && <Row label="Heures sup" value={`${pointage.heuresSup} min`} color="text-emerald-600" />}
          {pointage.notes && <Row label="Notes" value={pointage.notes} />}
          {pointage.valideParId
            ? <p className="flex items-center gap-1.5 text-sm text-emerald-600"><ShieldCheck className="w-4 h-4" /> Validé</p>
            : <p className="text-sm text-slate-400 italic">Non validé</p>
          }
        </div>
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">
            Fermer
          </button>
          {!pointage.valideParId && (
            <button onClick={handleValider} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Valider
            </button>
          )}
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

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${color ?? "text-slate-800"}`}>{value}</span>
    </div>
  );
}
