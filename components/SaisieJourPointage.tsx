"use client";

import { useMemo, useState } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Clock, Plane, Sun, CalendarDays,
  Smartphone, PenLine, UserCheck, UserX,
} from "lucide-react";
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
  statut:       string;
  source:       string;
  heureArrivee: string | null;
  valideParId:  number | null;
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<string, { label: string; badge: string; icon: React.ReactNode }> = {
  PRESENT:      { label: "Présent",     badge: "bg-emerald-100 text-emerald-700", icon: <CheckCircle  className="w-3 h-3" /> },
  ABSENT:       { label: "Absent",      badge: "bg-red-100 text-red-600",         icon: <XCircle      className="w-3 h-3" /> },
  RETARD:       { label: "Retard",      badge: "bg-amber-100 text-amber-700",     icon: <Clock        className="w-3 h-3" /> },
  DEMI_JOURNEE: { label: "½ journée",   badge: "bg-orange-100 text-orange-700",   icon: <Clock        className="w-3 h-3" /> },
  CONGE:        { label: "Congé",       badge: "bg-indigo-100 text-indigo-700",   icon: <CalendarDays className="w-3 h-3" /> },
  MISSION:      { label: "Mission",     badge: "bg-purple-100 text-purple-700",   icon: <Plane        className="w-3 h-3" /> },
  FERIE:        { label: "Férié",       badge: "bg-slate-100 text-slate-500",     icon: <Sun          className="w-3 h-3" /> },
};

// Actions rapides (POST immédiat) + reste dans le menu « Autre… »
const RAPIDES = ["PRESENT", "ABSENT", "CONGE"];
const AUTRES  = ["RETARD", "DEMI_JOURNEE", "MISSION", "FERIE"];

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// ── Composant ──────────────────────────────────────────────────────────────────

/**
 * Vue « Saisie du jour » : pour une date donnée, liste les collaborateurs qui
 * n'ont PAS encore de pointage (self-service ou manuel) et permet de le saisir
 * en un clic, sans jamais écraser un pointage déjà enregistré par le collaborateur.
 *
 * Réutilisée par l'admin (`/api/admin/rh/pointages`) et le responsable RH
 * (`/api/responsableRH/pointages`).
 */
export default function SaisieJourPointage({ pointagesBase, collabsUrl }: {
  pointagesBase: string;
  collabsUrl:    string;
}) {
  const [date, setDate]           = useState<string>(todayIso);
  const [savingId, setSavingId]   = useState<number | null>(null);

  const { data: collabRes, loading: lc } = useApi<{ data: ProfilRH[] }>(collabsUrl);
  const { data: ptRes, loading: lp, refetch } =
    useApi<{ data: Pointage[] }>(`${pointagesBase}?date=${date}&limit=200`);
  const { mutate } = useMutation(pointagesBase, "POST");

  const collabs   = collabRes?.data ?? [];
  const ptByProfil = useMemo(
    () => Object.fromEntries((ptRes?.data ?? []).map((p) => [p.profilRHId, p] as const)),
    [ptRes],
  );

  const nonPointes = collabs.filter((c) => !ptByProfil[c.id]);
  const pointes    = collabs.filter((c) =>  ptByProfil[c.id]);

  const loading = lc || lp;
  const isToday = date === todayIso();

  const saisir = async (c: ProfilRH, statut: string) => {
    setSavingId(c.id);
    try {
      const r = await mutate({ profilRHId: c.id, date, statut });
      if (r) {
        toast.success(`${STATUT_CFG[statut]?.label ?? statut} — ${c.gestionnaire.member.prenom} ${c.gestionnaire.member.nom}`);
        refetch();
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barre date + résumé */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        {!isToday && (
          <button onClick={() => setDate(todayIso())} className="text-xs font-medium text-emerald-600 hover:underline">
            Aujourd&apos;hui
          </button>
        )}
        <button onClick={refetch} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700"><UserCheck className="w-4 h-4" /> {pointes.length} pointé(s)</span>
          <span className="flex items-center gap-1.5 text-amber-700"><UserX className="w-4 h-4" /> {nonPointes.length} à saisir</span>
        </div>
      </div>

      {loading && collabs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <>
          {/* ── À saisir (pas encore pointés) ── */}
          <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200">
              <UserX className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                À saisir — {nonPointes.length} collaborateur(s) sans pointage
              </span>
            </div>
            {nonPointes.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400 text-center">
                Tous les collaborateurs ont un pointage pour cette date. 🎉
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {nonPointes.map((c) => (
                  <NonPointeRow key={c.id} collab={c} saving={savingId === c.id} onSaisir={(s) => saisir(c, s)} />
                ))}
              </div>
            )}
          </div>

          {/* ── Déjà pointés ── */}
          {pointes.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700">Déjà pointés — {pointes.length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {pointes.map((c) => {
                  const pt  = ptByProfil[c.id];
                  const cfg = STATUT_CFG[pt.statut] ?? STATUT_CFG.PRESENT;
                  const m   = c.gestionnaire.member;
                  const auto = pt.source === "SELF_SERVICE";
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">
                        {m.prenom[0]}{m.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.prenom} {m.nom}</p>
                        <p className="text-xs text-slate-400 font-mono">{c.matricule}</p>
                      </div>
                      {pt.heureArrivee && <span className="text-xs text-slate-500 font-mono">{fmtTime(pt.heureArrivee)}</span>}
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${auto ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>
                        {auto ? <Smartphone className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
                        {auto ? "Auto" : "Manuel"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Ligne « à saisir » avec actions rapides ─────────────────────────────────────

function NonPointeRow({ collab, saving, onSaisir }: {
  collab: ProfilRH; saving: boolean; onSaisir: (statut: string) => void;
}) {
  const m = collab.gestionnaire.member;
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
      <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {m.prenom[0]}{m.nom[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{m.prenom} {m.nom}</p>
        <p className="text-xs text-slate-400 font-mono">{collab.matricule}</p>
      </div>

      {saving ? (
        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
      ) : (
        <div className="flex items-center gap-1.5">
          {RAPIDES.map((s) => {
            const cfg = STATUT_CFG[s];
            return (
              <button key={s} onClick={() => onSaisir(s)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:opacity-80 ${cfg.badge} border-transparent`}>
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
          <select
            value=""
            onChange={(e) => { if (e.target.value) onSaisir(e.target.value); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Autre…</option>
            {AUTRES.map((s) => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
