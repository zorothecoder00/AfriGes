"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Filter, RefreshCw, Clock, User,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AuditUser {
  id:     number;
  nom:    string;
  prenom: string;
  email:  string;
  role:   string;
}

interface AuditEntry {
  id:        number;
  userId:    number;
  action:    string;
  entite:    string;
  entiteId?: number;
  details?:  Record<string, unknown>;
  createdAt: string;
  user?:     AuditUser;
}

interface AuditResponse {
  data:  AuditEntry[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

// ── Constantes ──────────────────────────────────────────────────────────────────

const RH_ENTITES = [
  "ProfilRH", "DocumentCollaborateur", "DocumentRHGenere",
  "DemandeConge", "EvaluationRH", "Formation",
  "HistoriquePoste", "PosteOuvert", "Candidature",
  "ProcedureDisciplinaire", "Mission", "FichePaie",
  "Pointage", "Absence",
];

const ACTION_COLORS: Record<string, string> = {
  CREATE:  "bg-emerald-100 text-emerald-800",
  UPDATE:  "bg-blue-100 text-blue-800",
  ARCHIVE: "bg-amber-100 text-amber-800",
  DELETE:  "bg-red-100 text-red-800",
  APPROVE: "bg-teal-100 text-teal-800",
  REJECT:  "bg-red-100 text-red-800",
};

function actionColor(action: string) {
  for (const key of Object.keys(ACTION_COLORS)) {
    if (action.toUpperCase().includes(key)) return ACTION_COLORS[key];
  }
  return "bg-slate-100 text-slate-700";
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function RHAuditGestionnaireePage() {
  const [entite,    setEntite]    = useState("");
  const [action,    setAction]    = useState("");
  const [search,    setSearch]    = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin,   setDateFin]   = useState("");
  const [page,      setPage]      = useState(1);
  const [expanded,  setExpanded]  = useState<number | null>(null);

  const params = new URLSearchParams();
  if (entite)    params.set("entite",    entite);
  if (action)    params.set("action",    action);
  if (search)    params.set("search",    search);
  if (dateDebut) params.set("dateDebut", dateDebut);
  if (dateFin)   params.set("dateFin",   dateFin);
  params.set("page",  String(page));
  params.set("limit", "30");

  const { data: res, loading, refetch } = useApi<AuditResponse>(
    `/api/responsableRH/audit?${params.toString()}`
  );

  const logs  = res?.data  ?? [];
  const total = res?.total ?? 0;
  const pages = res?.pages ?? 1;

  const resetFilters = () => {
    setEntite(""); setAction(""); setSearch("");
    setDateDebut(""); setDateFin(""); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* En-tête */}
        <div>
          <Link
            href="/dashboard/user/responsablesRH"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={15} /> Tableau de bord RH
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Audit & Traçabilité RH</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Historique des actions RH sur votre périmètre
              </p>
            </div>
            <button
              onClick={refetch}
              className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <select
              value={entite}
              onChange={(e) => { setEntite(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">Toutes les entités</option>
              {RH_ENTITES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            <select
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">Toutes les actions</option>
              {["CREATE", "UPDATE", "ARCHIVE", "DELETE", "APPROVE", "REJECT"].map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
            >
              <Filter size={14} /> Réinitialiser
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">au</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <span className="text-xs text-slate-400 self-center">{total} entrée(s)</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {loading && !res ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Chargement…
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Aucune entrée d&apos;audit</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date / Heure</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Utilisateur</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Entité</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium text-slate-800">{new Date(log.createdAt).toLocaleDateString("fr-FR")}</p>
                          <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleTimeString("fr-FR")}</p>
                        </td>
                        <td className="px-4 py-3">
                          {log.user ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                                {log.user.prenom?.[0]}{log.user.nom?.[0]}
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">{log.user.prenom} {log.user.nom}</p>
                                <p className="text-xs text-slate-400">{log.user.role}</p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 flex items-center gap-1"><User size={12} /> #{log.userId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">{log.entite}</td>
                        <td className="px-4 py-3 text-slate-500">{log.entiteId ?? "—"}</td>
                        <td className="px-4 py-3">
                          {log.details ? (
                            <button
                              onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              Voir détails
                              {expanded === log.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>

                      {expanded === log.id && log.details && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <DetailsPanel details={log.details} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Page {page} / {pages} — {total} résultat(s)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="p-2 rounded-xl border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DetailsPanel ──────────────────────────────────────────────────────────────

function DetailsPanel({ details }: { details: Record<string, unknown> }) {
  const avant = details.avant as Record<string, unknown> | undefined;
  const apres  = details.apres  as Record<string, unknown> | undefined;

  if (avant || apres) {
    const keys = [...new Set([
      ...Object.keys(avant ?? {}),
      ...Object.keys(apres  ?? {}),
    ])];

    const changed = keys.filter(
      (k) => JSON.stringify((avant ?? {})[k]) !== JSON.stringify((apres ?? {})[k])
    );

    return (
      <div className="space-y-3">
        {changed.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modifications</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Champ</th>
                    <th className="text-left px-3 py-2 font-semibold text-red-600">Ancienne valeur</th>
                    <th className="text-left px-3 py-2 font-semibold text-emerald-600">Nouvelle valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changed.map((k) => (
                    <tr key={k} className="bg-white">
                      <td className="px-3 py-2 font-medium text-slate-700">{k}</td>
                      <td className="px-3 py-2 text-red-600 line-through">{formatVal((avant ?? {})[k])}</td>
                      <td className="px-3 py-2 text-emerald-700 font-medium">{formatVal((apres ?? {})[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Aucune modification détectée</p>
        )}
        {changed.length < keys.length && (
          <details className="text-xs">
            <summary className="text-slate-400 cursor-pointer hover:text-slate-600">
              {keys.length - changed.length} champ(s) inchangé(s)
            </summary>
            <div className="mt-1 pl-3 space-y-0.5">
              {keys.filter((k) => !changed.includes(k)).map((k) => (
                <p key={k} className="text-slate-400">
                  <span className="font-medium text-slate-500">{k}</span> : {formatVal((avant ?? {})[k])}
                </p>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <pre className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap">
      {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
    </pre>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean")        return v ? "Oui" : "Non";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString("fr-FR");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
