'use client';

import { useState } from 'react';
import { useApi, useMutation } from '@/hooks/useApi';

type PrioriteNotification = 'URGENT' | 'HAUTE' | 'NORMAL' | 'BASSE';

interface Notification {
  id: number;
  uuid: string;
  titre: string;
  message: string;
  priorite: PrioriteNotification;
  lue: boolean;
  dateLecture: string | null;
  actionUrl: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');

  const { data: response, loading, error, refetch } = useApi<NotificationsResponse>('/api/notifications?limit=50');
  const notifications = response?.data ?? [];

  // Mutations
  const { mutate: markAllRead, loading: markingAll } = useMutation('/api/notifications/readAll', 'PATCH');
  const { mutate: clearAll, loading: clearingAll } = useMutation('/api/notifications', 'DELETE');

  const handleMarkAllRead = async () => {
    const result = await markAllRead({});
    if (result) refetch();
  };

  const handleClearAll = async () => {
    const result = await clearAll({});
    if (result) refetch();
  };

  const handleMarkAsRead = async (uuid: string) => {
    try {
      const res = await fetch(`/api/notifications/${uuid}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) refetch();
    } catch {}
  };

  const handleDelete = async (uuid: string) => {
    try {
      const res = await fetch(`/api/notifications/${uuid}`, {
        method: 'DELETE',
      });
      if (res.ok) refetch();
    } catch {}
  };

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.lue).length,
    urgent: notifications.filter(n => n.priorite === 'URGENT' || n.priorite === 'HAUTE').length,
    today: notifications.filter(n => {
      const today = new Date().toDateString();
      const notifDate = new Date(n.createdAt).toDateString();
      return today === notifDate;
    }).length
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.lue;
    if (filter === 'urgent') return n.priorite === 'URGENT' || n.priorite === 'HAUTE';
    return true;
  });

  const getTimeDiff = (timestamp: string) => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "A l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    return `Il y a ${diffDays} jours`;
  };

  const priorityBadges: Record<PrioriteNotification, { class: string; label: string }> = {
    URGENT: { class: 'bg-red-100 text-red-700 border-red-300', label: 'Urgent' },
    HAUTE: { class: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Important' },
    NORMAL: { class: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Normal' },
    BASSE: { class: 'bg-blue-100 text-blue-600 border-blue-300', label: 'Info' },
  };

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des notifications...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  Notifications
                </h1>
                <p className="text-gray-500 text-sm">
                  Restez informe de toutes les activites
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll || stats.unread === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  {markingAll ? 'En cours...' : 'Tout marquer comme lu'}
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll || notifications.length === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  {clearingAll ? 'En cours...' : 'Tout supprimer'}
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-md">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs opacity-90 mt-1">Total</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-md">
                <div className="text-2xl font-bold">{stats.unread}</div>
                <div className="text-xs opacity-90 mt-1">Non lues</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-md">
                <div className="text-2xl font-bold">{stats.urgent}</div>
                <div className="text-xs opacity-90 mt-1">Urgentes</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-md">
                <div className="text-2xl font-bold">{stats.today}</div>
                <div className="text-xs opacity-90 mt-1">Aujourd&apos;hui</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'unread', label: 'Non lues' },
                { key: 'urgent', label: 'Urgentes' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    filter === key
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune notification
              </h3>
              <p className="text-gray-500 text-sm">
                Vous n&apos;avez pas de notifications pour ce filtre
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification, index) => {
              const badge = priorityBadges[notification.priorite] ?? priorityBadges.NORMAL;
              return (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden ${
                    !notification.lue ? 'border-l-emerald-500' : 'border-l-gray-200'
                  }`}
                  style={{
                    animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                  }}
                >
                  {!notification.lue && (
                    <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full m-4"></div>
                  )}

                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-base font-semibold ${
                                !notification.lue ? 'text-gray-900' : 'text-gray-700'
                              }`}>
                                {notification.titre}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${badge.class}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{getTimeDiff(notification.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {!notification.lue && (
                          <button
                            onClick={() => handleMarkAsRead(notification.uuid)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                            title="Marquer comme lu"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification.uuid)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                          title="Supprimer"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
