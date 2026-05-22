'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDateTime } from '@/lib/format';
import ClienteleTabBar from '@/components/ClienteleTabBar';
import {
  Bell, RefreshCw, CheckCheck, AlertCircle, Info,
  ShoppingBag, Users, Calendar, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Priorite = 'URGENT' | 'HAUTE' | 'NORMAL' | 'BASSE';

interface Notification {
  id: number;
  uuid: string;
  titre: string;
  message: string;
  priorite: Priorite;
  lue: boolean;
  actionUrl: string | null;
  createdAt: string;
}

interface NotifResponse {
  data: Notification[];
  meta: { total: number; page: number; limit: number; totalPages: number; nbNonLues: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITE_STYLE: Record<Priorite, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HAUTE:  'bg-orange-100 text-orange-700 border-orange-200',
  NORMAL: 'bg-gray-100 text-gray-600 border-gray-200',
  BASSE:  'bg-blue-100 text-blue-700 border-blue-200',
};

const PRIORITE_DOT: Record<Priorite, string> = {
  URGENT: 'bg-red-500',
  HAUTE:  'bg-orange-500',
  NORMAL: 'bg-gray-400',
  BASSE:  'bg-blue-400',
};

function actionIcon(url: string | null) {
  if (!url) return <Bell className="w-4 h-4" />;
  if (url.includes('clients'))        return <Users className="w-4 h-4" />;
  if (url.includes('collectes'))      return <Calendar className="w-4 h-4" />;
  if (url.includes('remboursements')) return <TrendingUp className="w-4 h-4" />;
  if (url.includes('creances') || url.includes('alertes')) return <AlertCircle className="w-4 h-4" />;
  if (url.includes('vente'))          return <ShoppingBag className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

function timeDiff(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const m  = Math.floor(ms / 60000);
  const h  = Math.floor(ms / 3600000);
  const d  = Math.floor(ms / 86400000);
  if (m < 1)  return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  if (h < 24) return `Il y a ${h}h`;
  if (d === 1) return 'Hier';
  return `Il y a ${d} jours`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsClientelePage() {
  const [page,    setPage]    = useState(1);
  const [filtre,  setFiltre]  = useState<'toutes' | 'non_lues' | 'urgentes'>('toutes');

  const lueParam     = filtre === 'non_lues' ? '&lue=false' : '';
  const { data: res, loading, refetch } =
    useApi<NotifResponse>(`/api/admin/notifications?scope=clientele&page=${page}&limit=20${lueParam}`);

  const { mutate: markAllRead, loading: marking } =
    useMutation('/api/admin/notifications', 'PATCH', { successMessage: 'Notifications marquées comme lues' });

  const notifs = res?.data ?? [];
  const displayed = filtre === 'urgentes'
    ? notifs.filter((n) => n.priorite === 'URGENT' || n.priorite === 'HAUTE')
    : notifs;

  const handleMarkAll = async () => {
    await markAllRead({ scope: 'clientele' });
    refetch();
  };

  const handleMarkOne = async (id: number) => {
    await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    });
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />

      <div className="p-6 space-y-6 max-w-4xl mx-auto">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-600" />
              Centre de notifications
              {(res?.meta.nbNonLues ?? 0) > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                  {res!.meta.nbNonLues}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Alertes et événements du module clientèle
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleMarkAll} disabled={marking || (res?.meta.nbNonLues ?? 0) === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40">
              <CheckCheck className="w-4 h-4" /> Tout marquer lu
            </button>
            <button onClick={refetch}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-2">
          {([
            { key: 'toutes',    label: 'Toutes' },
            { key: 'non_lues',  label: 'Non lues' },
            { key: 'urgentes',  label: 'Urgentes' },
          ] as const).map(({ key, label }) => (
            <button key={key}
              onClick={() => { setFiltre(key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filtre === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Liste */}
        <div className="space-y-2">
          {loading && !res ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell className="w-10 h-10 mb-3" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            displayed.map((n) => (
              <div key={n.id}
                className={`bg-white rounded-xl border transition-colors ${
                  !n.lue ? 'border-blue-200 shadow-sm' : 'border-gray-100'
                }`}>
                <div className="p-4 flex items-start gap-3">
                  {/* icône */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    !n.lue ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {actionIcon(n.actionUrl)}
                  </div>

                  {/* contenu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${!n.lue ? 'text-gray-900' : 'text-gray-700'}`}>
                            {n.titre}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PRIORITE_STYLE[n.priorite]}`}>
                            {n.priorite}
                          </span>
                          {!n.lue && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITE_DOT[n.priorite]}`} />
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeDiff(n.createdAt)} · {formatDateTime(n.createdAt)}</p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {n.actionUrl && (
                          <Link href={n.actionUrl}
                            className="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                            Voir
                          </Link>
                        )}
                        {!n.lue && (
                          <button onClick={() => handleMarkOne(n.id)}
                            className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">
                            Lu
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {res && res.meta.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>{res.meta.total} notification(s) · Page {res.meta.page} / {res.meta.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Précédent
              </button>
              <button disabled={page === res.meta.totalPages} onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
                Suivant
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
