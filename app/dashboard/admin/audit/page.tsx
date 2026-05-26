"use client";

import React, { useState, useCallback } from 'react';
import { Shield, Search, RefreshCw, Download, Filter, User, Calendar } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useT } from '@/contexts/AppSettingsContext';
import { formatDateTime } from '@/lib/format';
import { exportToCsv } from '@/lib/exportCsv';
import ClienteleTabBar from '@/components/ClienteleTabBar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:          number;
  action:      string;
  actionLabel: string;
  entite:      string;
  entiteId:    number | null;
  createdAt:   string;
  user:        { id: number; nom: string; email: string } | null;
}

interface AuditResponse {
  data:  AuditEntry[];
  meta:  { total: number; page: number; limit: number; totalPages: number };
  stats: {
    parEntite: { entite: string; _count: { id: number } }[];
    parAction: { action: string; _count: { id: number } }[];
  };
  entitesDisponibles: string[];
}

// ─── Couleurs par entité ──────────────────────────────────────────────────────

const ENTITE_STYLE: Record<string, string> = {
  Client:               'bg-blue-100 text-blue-700',
  SouscriptionPack:     'bg-violet-100 text-violet-700',
  CollecteJournaliere:  'bg-teal-100 text-teal-700',
  VersementPack:        'bg-emerald-100 text-emerald-700',
  VenteDirecte:         'bg-orange-100 text-orange-700',
  EcheancePack:         'bg-amber-100 text-amber-700',
};

const ACTION_STYLE: Record<string, string> = {
  CREATION:   'text-emerald-600',
  MODIFICATION: 'text-blue-600',
  SUPPRESSION:  'text-red-600',
  VALIDATION:   'text-violet-600',
  ANNULATION:   'text-amber-600',
};

function actionColor(action: string) {
  for (const [k, v] of Object.entries(ACTION_STYLE)) {
    if (action.includes(k)) return v;
  }
  return 'text-gray-600';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const t = useT();
  const [page,        setPage]        = useState(1);
  const [entite,      setEntite]      = useState('');
  const [action,      setAction]      = useState('');
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  const [actionInput, setActionInput] = useState('');

  const query = new URLSearchParams({
    page:  String(page),
    limit: '30',
    ...(entite    && { entite }),
    ...(action    && { action }),
    ...(dateDebut && { dateDebut }),
    ...(dateFin   && { dateFin }),
  }).toString();

  const { data: res, loading, refetch } = useApi<AuditResponse>(`/api/admin/audit?${query}`);

  const applyAction = useCallback(() => { setAction(actionInput); setPage(1); }, [actionInput]);

  const handleExport = () => {
    if (!res?.data.length) return;
    exportToCsv(
      res.data,
      [
        { label: 'Date',        key: 'createdAt', format: (v) => formatDateTime(String(v)) },
        { label: 'Action',      key: 'actionLabel' },
        { label: 'Entité',      key: 'entite' },
        { label: 'ID entité',   key: 'entiteId', format: (v) => String(v ?? '') },
        { label: 'Utilisateur', key: 'user', format: (v) => (v as AuditEntry['user'])?.nom ?? 'Système' },
      ],
      `audit-clientele-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const logs = res?.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('audit_title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('audit_subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} disabled={!logs.length}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm disabled:opacity-40">
              <Download className="w-4 h-4" /> {t('audit_export_csv')}
            </button>
            <button onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        {res?.stats && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {res.stats.parEntite.slice(0, 6).map((e) => (
              <div key={e.entite} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ENTITE_STYLE[e.entite] ?? 'bg-gray-100 text-gray-600'}`}>
                  {e.entite}
                </span>
                <span className="text-lg font-bold text-gray-800 ml-auto">{e._count.id}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> {t('audit_filter_entite')}
            </label>
            <select value={entite} onChange={(e) => { setEntite(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('audit_all_entities')}</option>
              {res?.entitesDisponibles.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t('audit_filter_action')}
            </label>
            <div className="flex gap-1">
              <input value={actionInput} onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyAction()}
                placeholder="Ex: CREATION"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={applyAction}
                className="px-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {t('audit_filter_from')}
            </label>
            <input type="date" value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('audit_filter_to')}</label>
            <input type="date" value={dateFin} onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {(entite || action || dateDebut || dateFin) && (
            <button onClick={() => { setEntite(''); setAction(''); setActionInput(''); setDateDebut(''); setDateFin(''); setPage(1); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 self-end">
              {t('audit_reset')}
            </button>
          )}

          <span className="text-sm text-gray-400 self-end ml-auto">
            {res?.meta.total ?? 0} entrée(s)
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('audit_loading')}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Shield className="w-10 h-10 mb-2" />
              <p className="text-sm">{t('audit_none')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">{t('audit_col_date')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('audit_col_action')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('audit_col_entite')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('audit_col_user')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${actionColor(log.action)}`}>
                          {log.actionLabel}
                        </span>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{log.action}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ENTITE_STYLE[log.entite] ?? 'bg-gray-100 text-gray-600'}`}>
                          {log.entite}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                        {log.entiteId ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-700">{log.user.nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{t('audit_system')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {res && res.meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Page {res.meta.page} / {res.meta.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                {t('btn_prev')}
              </button>
              <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                {t('btn_next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
