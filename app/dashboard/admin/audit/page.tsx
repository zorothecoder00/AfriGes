"use client";

import React, { useState, useCallback } from 'react';
import { Shield, Search, RefreshCw, Download, Filter, User, Calendar } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useT } from '@/contexts/AppSettingsContext';
import { formatDateTime } from '@/lib/format';
import { exportToXlsx } from '@/lib/exportXlsx';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import Button from '@/components/ui/Button';
import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

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
// Catégories métier non sémantiques : chaque entité reçoit le variant Badge
// le plus proche de sa couleur d'origine (le système ne propose pas autant
// de teintes que l'ancien habillage ad-hoc, certaines entités partagent donc
// désormais le même variant).


const ENTITE_BADGE_VARIANT: Record<string, BadgeVariant> = {
  Client:               'indigo',
  SouscriptionPack:     'purple',
  CollecteJournaliere:  'teal',
  VersementPack:        'success',
  VenteDirecte:         'warning',
  EcheancePack:         'warning',
};

const ACTION_BADGE_VARIANT: Record<string, BadgeVariant> = {
  CREATION:     'success',
  MODIFICATION: 'info',
  SUPPRESSION:  'error',
  VALIDATION:   'purple',
  ANNULATION:   'warning',
};

function actionVariant(action: string): BadgeVariant {
  for (const [k, v] of Object.entries(ACTION_BADGE_VARIANT)) {
    if (action.includes(k)) return v;
  }
  return 'neutral';
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
    exportToXlsx(
      res.data,
      [
        { label: 'Date',        key: 'createdAt', type: 'datetime', format: (v) => (v ? new Date(String(v)) : null) },
        { label: 'Action',      key: 'actionLabel' },
        { label: 'Entité',      key: 'entite' },
        { label: 'ID entité',   key: 'entiteId', format: (v) => String(v ?? '') },
        { label: 'Utilisateur', key: 'user', format: (v) => (v as AuditEntry['user'])?.nom ?? 'Système' },
      ],
      `audit-clientele-${new Date().toISOString().slice(0, 10)}.xlsx`,
      { sheetName: 'Audit' }
    );
  };

  const logs = res?.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <ClienteleTabBar>

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('audit_title')}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('audit_subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!logs.length} icon={<Download className="w-4 h-4" />} onClick={handleExport}>
              {t('audit_export_csv')}
            </Button>
            <Button variant="secondary" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />} onClick={refetch} />
          </div>
        </div>

        {/* Stats rapides */}
        {res?.stats && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {res.stats.parEntite.slice(0, 6).map((e) => (
              <div key={e.entite} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                <Badge variant={ENTITE_BADGE_VARIANT[e.entite] ?? 'neutral'}>
                  {e.entite}
                </Badge>
                <span className="text-lg font-bold text-slate-800 ml-auto">{e._count.id}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> {t('audit_filter_entite')}
            </label>
            <select value={entite} onChange={(e) => { setEntite(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('audit_all_entities')}</option>
              {res?.entitesDisponibles.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Shield className="w-3 h-3" /> {t('audit_filter_action')}
            </label>
            <div className="flex gap-1">
              <input value={actionInput} onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyAction()}
                placeholder="Ex: CREATION"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Button variant="primary" size="sm" icon={<Search className="w-4 h-4" />} onClick={applyAction} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {t('audit_filter_from')}
            </label>
            <input type="date" value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('audit_filter_to')}</label>
            <input type="date" value={dateFin} onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {(entite || action || dateDebut || dateFin) && (
            <Button
              variant="secondary"
              size="sm"
              className="self-end"
              onClick={() => { setEntite(''); setAction(''); setActionInput(''); setDateDebut(''); setDateFin(''); setPage(1); }}
            >
              {t('audit_reset')}
            </Button>
          )}

          <span className="text-sm text-slate-400 self-end ml-auto">
            {res?.meta.total ?? 0} entrée(s)
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('audit_loading')}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Shield className="w-10 h-10 mb-2" />
              <p className="text-sm">{t('audit_none')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600">{t('audit_col_date')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('audit_col_action')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('audit_col_entite')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">{t('audit_col_user')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionVariant(log.action)}>
                          {log.actionLabel}
                        </Badge>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{log.action}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ENTITE_BADGE_VARIANT[log.entite] ?? 'neutral'}>
                          {log.entite}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                        {log.entiteId ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {log.user ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-slate-700">{log.user.nom}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{t('audit_system')}</span>
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
        {res && (
          <Pagination
            page={page}
            totalPages={res.meta.totalPages}
            total={res.meta.total}
            onPageChange={(p) => setPage(p)}
          />
        )}
      </div>
      </ClienteleTabBar>
    </div>
  );
}
