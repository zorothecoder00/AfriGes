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
  "DemandeConge", "SoldeConge", "EvaluationRH", "Formation",
  "ParticipationFormation", "HistoriquePoste", "PosteOuvert",
  "Candidature", "ProcedureDisciplinaire", "Mission",
  "FichePaie", "Pointage", "Absence", "Avantage", "Horaire",
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

export default function RHAuditPage() {
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
    `/api/admin/rh/audit?${params.toString()}`
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
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* En-tête */}
        <div>
          <Link
            href="/dashboard/admin/rh"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft size={15} /> Tableau de bord RH
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Audit & Traçabilité RH</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Historique complet de toutes les actions sur les données RH
              </p>
            </div>
            <button
              onClick={refetch}
              className={`self-start sm:self-auto p-2.5 rounded-xl border border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-all ${loading ? "animate-spin" : ""}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {/* Recherche */}
            <div className="relative xl:col-span-2">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Entité */}
            <select
              value={entite}
              onChange={(e) => { setEntite(e.target.value); setPage(1); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              <option value="">Toutes les entités</option>
              {RH_ENTITES.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>

            {/* Action */}
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

            {/* Reset */}
            <button
              onClick={resetFilters}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600"
            >
              <Filter size={14} /> Réinitialiser
            </button>
          </div>

          {/* Dates */}
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-xs text-slate-500">Du</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
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
              <RefreshCw size={20} className="animate-spin mr-2" />
              Chargement...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Clock size={32} className="mb-2 opacity-40" />
              <p>Aucune entrée d&apos;audit</p>
            </div>
          ) : (
            <>
              {/* ================= MOBILE ================= */}
              <div className="lg:hidden divide-y divide-slate-200">

                {logs.map((log) => (
                  <div key={log.id} className="p-4">

                    <div className="flex items-start justify-between">

                      <div>

                        <div className="font-semibold text-slate-800">
                          {log.user
                            ? `${log.user.prenom} ${log.user.nom}`
                            : `Utilisateur #${log.userId}`}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {new Date(log.createdAt).toLocaleDateString("fr-FR")}
                          {" • "}
                          {new Date(log.createdAt).toLocaleTimeString("fr-FR")}
                        </div>

                      </div>

                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${actionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>

                    </div>

                    <div className="mt-4 space-y-2 text-sm">

                      <div className="flex justify-between">
                        <span className="text-slate-500">Entité</span>
                        <span className="font-medium">{log.entite}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-500">ID</span>
                        <span>{log.entiteId ?? "—"}</span>
                      </div>

                      {log.user && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Rôle</span>
                          <span>{log.user.role}</span>
                        </div>
                      )}

                    </div>

                    {log.details && (

                      <div className="mt-4">

                        <button
                          onClick={() =>
                            setExpanded(expanded === log.id ? null : log.id)
                          }
                          className="w-full rounded-lg border border-slate-200 py-2 flex items-center justify-center gap-2 text-sm hover:bg-slate-50"
                        >
                          Voir les détails

                          {expanded === log.id ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}

                        </button>

                      </div>

                    )}

                    {expanded === log.id && log.details && (

                      <div className="mt-4">
                        <DetailsPanel details={log.details} />
                      </div>

                    )}

                  </div>
                ))}

              </div>

              {/* ================= DESKTOP ================= */}

              <div className="hidden lg:block overflow-x-auto">

                <table className="min-w-[1100px] w-full text-sm">

                  <thead>

                    <tr className="border-b bg-slate-50">

                      <th className="px-4 py-3 text-left">Date</th>

                      <th className="px-4 py-3 text-left">Utilisateur</th>

                      <th className="px-4 py-3 text-left">Action</th>

                      <th className="px-4 py-3 text-left">Entité</th>

                      <th className="px-4 py-3 text-left">ID</th>

                      <th className="px-4 py-3 text-left">Détails</th>

                    </tr>

                  </thead>

                  <tbody>

                    {logs.map((log) => (

                      <React.Fragment key={log.id}>

                        <tr className="border-b hover:bg-slate-50">

                          <td className="px-4 py-3 whitespace-nowrap">

                            <div className="font-medium">
                              {new Date(log.createdAt).toLocaleDateString("fr-FR")}
                            </div>

                            <div className="text-xs text-slate-400">
                              {new Date(log.createdAt).toLocaleTimeString("fr-FR")}
                            </div>

                          </td>

                          <td className="px-4 py-3">

                            {log.user ? (
                              <>
                                <div className="font-medium">
                                  {log.user.prenom} {log.user.nom}
                                </div>

                                <div className="text-xs text-slate-500">
                                  {log.user.role}
                                </div>
                              </>
                            ) : (
                              `#${log.userId}`
                            )}

                          </td>

                          <td className="px-4 py-3">

                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${actionColor(
                                log.action
                              )}`}
                            >
                              {log.action}
                            </span>

                          </td>

                          <td className="px-4 py-3">{log.entite}</td>

                          <td className="px-4 py-3">{log.entiteId ?? "—"}</td>

                          <td className="px-4 py-3">

                            {log.details ? (

                              <button
                                onClick={() =>
                                  setExpanded(expanded === log.id ? null : log.id)
                                }
                                className="text-indigo-600 flex items-center gap-1"
                              >
                                Voir

                                {expanded === log.id
                                  ? <ChevronUp size={14}/>
                                  : <ChevronDown size={14}/>}
                              </button>

                            ) : "—"}

                          </td>

                        </tr>

                        {expanded === log.id && log.details && (

                          <tr className="bg-slate-50">

                            <td colSpan={6} className="p-5">

                              <DetailsPanel details={log.details} />

                            </td>

                          </tr>

                        )}

                      </React.Fragment>

                    ))}

                  </tbody>

                </table>

              </div>

            </>
          )}

        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 text-center sm:text-left">
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

  // Si avant/après disponibles → afficher diff
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
            <>
            {/* MOBILE */}
            <div className="lg:hidden space-y-3">
              {changed.map((k) => (
                <div
                  key={k}
                  className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="font-semibold text-slate-700 mb-3">
                    {k}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-red-500 uppercase">
                        Ancienne valeur
                      </div>
                      <div className="text-sm text-red-600 break-all">
                        {formatVal((avant ?? {})[k])}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-emerald-500 uppercase">
                        Nouvelle valeur
                      </div>
                      <div className="text-sm text-emerald-700 break-all">
                        {formatVal((apres ?? {})[k])}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-3 py-2">
                      Champ
                    </th>

                    <th className="text-left px-3 py-2 text-red-600">
                      Ancienne valeur
                    </th>
                    <th className="text-left px-3 py-2 text-emerald-600">
                      Nouvelle valeur
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {changed.map((k) => (
                    <tr key={k}>
                      <td className="px-3 py-2 font-medium">
                        {k}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {formatVal((avant ?? {})[k])}
                      </td>
                      <td className="px-3 py-2 text-emerald-700">
                        {formatVal((apres ?? {})[k])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Aucune modification détectée</p>
        )}

        {/* Champs inchangés */}
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

  // Sinon afficher le JSON brut (ex: message string)
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
