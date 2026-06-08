"use client";

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle, Search, RefreshCw, Bell, Phone, MapPin,
  UserCheck, CheckCircle, X, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { toast } from 'sonner';
import { useT } from '@/contexts/AppSettingsContext';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import { useTagModal } from '@/contexts/TagModalContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Creance {
  id: number;
  montantRestant: number;
  montantTotal:   number;
  montantVerse:   number;
  statut:         string;
  nbEcheancesRetard: number;
  joursRetard:    number;
  echeancePlusAncienne: { datePrevue: string; montant: string } | null;
  pack: { id: number; nom: string; type: string };
  client: {
    id: number; nom: string; prenom: string;
    telephone: string; codeClient: string | null; segment: string;
    tags?: { tag: { id: number; nom: string; couleur: string } }[];
    agentTerrain: { id: number; nom: string; prenom: string } | null;
    pointDeVente: { id: number; nom: string; code: string } | null;
  };
}

interface AlertesResponse {
  data:  Creance[];
  meta:  { total: number; page: number; limit: number; totalPages: number; jours: number };
  stats: { total: number; montant: number };
}

// ─── Seuils de retard ─────────────────────────────────────────────────────────

const SEUILS = [
  { label: '> 7 jours',  value: 7 },
  { label: '> 15 jours', value: 15 },
  { label: '> 30 jours', value: 30 },
  { label: '> 60 jours', value: 60 },
  { label: '> 90 jours', value: 90 },
];

const URGENCE_COLOR = (j: number) =>
  j > 90 ? 'bg-red-100 text-red-800 border border-red-200'
  : j > 30 ? 'bg-orange-100 text-orange-700 border border-orange-200'
  : 'bg-amber-100 text-amber-700 border border-amber-200';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertesImpayesPage() {
  const t = useT();
  const tagModal = useTagModal();
  const [jours,        setJours]        = useState(30);
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [selected,     setSelected]     = useState<Set<number>>(new Set());
  const [notifMessage, setNotifMessage] = useState('');
  const [showNotifBox, setShowNotifBox] = useState(false);

  const query = new URLSearchParams({
    jours:  String(jours),
    page:   String(page),
    limit:  '20',
    ...(search && { search }),
  }).toString();

  const { data: res, loading, refetch } = useApi<AlertesResponse>(
    `/api/admin/alertes-impayes?${query}`
  );

  const { mutate: notifier, loading: notifying } = useMutation<
    { success: boolean; nbNotifications: number },
    { souscriptionIds: number[]; message?: string }
  >('/api/admin/alertes-impayes/notifier', 'POST');

  const handleSearch = useCallback(() => { setSearch(searchInput); setPage(1); }, [searchInput]);

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => {
    const allIds = res?.data.map((c) => c.id) ?? [];
    setSelected(new Set(allIds));
  };

  const handleNotifier = async (ids: number[]) => {
    if (ids.length === 0) return;
    const result = await notifier({ souscriptionIds: ids, message: notifMessage || undefined });
    if (result) {
      toast.success(`${result.nbNotifications} notification(s) envoyée(s)`);
      setSelected(new Set());
      setShowNotifBox(false);
      setNotifMessage('');
    } else {
      toast.error('Erreur lors de la notification');
    }
  };

  const creances = res?.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('alertes_title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('alertes_subtitle')}
            </p>
          </div>
          <button onClick={refetch}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </button>
        </div>

        {/* Stats urgence */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-red-100 p-3 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium">{t('alertes_stat_creances')} (&gt; {jours}j)</p>
              <p className="text-3xl font-bold text-red-700">{res?.stats.total ?? 0}</p>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-xl">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-orange-600 font-medium">{t('alertes_stat_montant')}</p>
              <p className="text-2xl font-bold text-orange-700">{formatCurrency(res?.stats.montant ?? 0)}</p>
            </div>
          </div>
        </div>

        {/* Seuils + filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          {/* Seuils de jours */}
          <div className="flex flex-wrap gap-2">
            {SEUILS.map((s) => (
              <button
                key={s.value}
                onClick={() => { setJours(s.value); setPage(1); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  jours === s.value
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="flex gap-2">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('alertes_search_ph')}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <button onClick={handleSearch}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barre d'actions groupées */}
        {selected.size > 0 && (
          <div className="bg-white border border-orange-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-orange-700">
              {selected.size} {t('alertes_selected')}
            </span>
            {showNotifBox ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder={t('alertes_notif_ph')}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={() => handleNotifier([...selected])}
                  disabled={notifying}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4" />
                  {notifying ? t('btn_sending') : t('btn_send')}
                </button>
                <button onClick={() => setShowNotifBox(false)} className="p-2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setShowNotifBox(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">
                  <Bell className="w-4 h-4" /> {t('alertes_notif_agents')}
                </button>
                <button onClick={() => setSelected(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700">
                  {t('alertes_deselect_all')}
                </button>
              </>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> {t('collecte_loading')}
            </div>
          ) : creances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CheckCircle className="w-10 h-10 mb-2 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-600">{t('alertes_none')}</p>
              <p className="text-xs mt-1">{t('alertes_none_sub')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input type="checkbox"
                        onChange={(e) => e.target.checked ? selectAll() : setSelected(new Set())}
                        checked={selected.size === creances.length && creances.length > 0}
                        className="w-4 h-4 text-red-600 rounded cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('label_client')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('alertes_col_pack')}</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">{t('alertes_col_montant_du')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('alertes_col_retard')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('alertes_col_agent_affecte')}</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">{t('alertes_col_echeance_anc')}</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">{t('label_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {creances.map((c) => (
                    <tr key={c.id} className={`hover:bg-red-50/30 transition-colors ${selected.has(c.id) ? 'bg-orange-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox"
                          checked={selected.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="w-4 h-4 text-red-600 rounded cursor-pointer"
                        />
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {c.client.prenom} {c.client.nom}
                          {c.client.codeClient && (
                            <span className="ml-1.5 text-xs text-gray-400">· {c.client.codeClient}</span>
                          )}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Phone className="w-3 h-3" />{c.client.telephone}
                        </div>
                        {c.client.pointDeVente && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <MapPin className="w-3 h-3" />{c.client.pointDeVente.nom}
                          </div>
                        )}
                        {(c.client.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(c.client.tags ?? []).slice(0, 3).map(({ tag }) => (
                              <button key={tag.id}
                                onClick={() => tagModal?.openTag(tag)}
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: tag.couleur }}
                                title={`Voir tous les clients "${tag.nom}"`}
                              >{tag.nom}</button>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Pack */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{c.pack.nom}</p>
                        <span className="text-xs text-gray-400">{c.pack.type}</span>
                      </td>

                      {/* Montant */}
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-red-600">{formatCurrency(c.montantRestant)}</p>
                        <p className="text-xs text-gray-400">/ {formatCurrency(c.montantTotal)}</p>
                      </td>

                      {/* Retard */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-bold ${URGENCE_COLOR(c.joursRetard)}`}>
                          {c.joursRetard}j
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{c.nbEcheancesRetard} éch.</p>
                      </td>

                      {/* Agent */}
                      <td className="px-4 py-3">
                        {c.client.agentTerrain ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="text-gray-700">
                              {c.client.agentTerrain.prenom} {c.client.agentTerrain.nom}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">{t('alertes_non_affecte')}</span>
                        )}
                      </td>

                      {/* Échéance */}
                      <td className="px-4 py-3">
                        {c.echeancePlusAncienne ? (
                          <div className="text-xs">
                            <p className="text-red-500 font-medium">
                              {formatDate(c.echeancePlusAncienne.datePrevue)}
                            </p>
                            <p className="text-gray-400">{formatCurrency(Number(c.echeancePlusAncienne.montant))}</p>
                          </div>
                        ) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleNotifier([c.id])}
                            disabled={notifying}
                            title="Notifier l'agent"
                            className="p-1.5 text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded"
                          >
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <Link href={`/dashboard/admin/clients/${c.client.id}`}
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
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
            <span>Page {res.meta.page} / {res.meta.totalPages} — {res.meta.total} {t('rapports_col_creances').toLowerCase()}</span>
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
