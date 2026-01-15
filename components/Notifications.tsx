'use client';

import { useState } from 'react';

type NotificationPriority = 'urgent' | 'high' | 'normal';
type NotificationColor = 'emerald' | 'blue' | 'orange' | 'purple' | 'red' | 'yellow';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  user: string;
  timestamp: string;
  read: boolean;
  priority: NotificationPriority;
  icon: string;
  color: NotificationColor;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      type: 'COTISATION',
      title: 'Cotisation mensuelle reçue',
      message: 'Paiement de €25.00 pour la période mensuelle',
      user: 'Kofi Mensah',
      timestamp: '2026-01-15T10:30:00',
      read: false,
      priority: 'normal',
      icon: '💰',
      color: 'emerald'
    },
    {
      id: 2,
      type: 'TONTINE',
      title: 'Nouveau cycle de tontine',
      message: 'La tontine "Solidarité" démarre un nouveau cycle de €500',
      user: 'Système',
      timestamp: '2026-01-15T09:15:00',
      read: false,
      priority: 'high',
      icon: '🔄',
      color: 'blue'
    },
    {
      id: 3,
      type: 'CREDIT',
      title: 'Demande de crédit approuvée',
      message: 'Votre crédit de €1,200 a été approuvé. Consultez les détails.',
      user: 'Ama Owusu',
      timestamp: '2026-01-14T16:45:00',
      read: true,
      priority: 'high',
      icon: '✅',
      color: 'emerald'
    },
    {
      id: 4,
      type: 'CREDIT_ALIMENTAIRE',
      title: 'Crédit alimentaire utilisé',
      message: 'Achat de riz et huile pour €45.50. Solde restant: €154.50',
      user: 'Kwame Addo',
      timestamp: '2026-01-14T14:20:00',
      read: true,
      priority: 'normal',
      icon: '🛒',
      color: 'orange'
    },
    {
      id: 5,
      type: 'WALLET',
      title: 'Dépôt effectué',
      message: 'Dépôt de €100.00 dans votre wallet général',
      user: 'Vous',
      timestamp: '2026-01-13T11:00:00',
      read: true,
      priority: 'normal',
      icon: '💳',
      color: 'purple'
    },
    {
      id: 6,
      type: 'ALERTE',
      title: 'Stock faible: Riz blanc',
      message: 'Le stock de riz blanc est en dessous du seuil d\'alerte (15 unités)',
      user: 'Système',
      timestamp: '2026-01-13T08:30:00',
      read: true,
      priority: 'urgent',
      icon: '⚠️',
      color: 'red'
    },
    {
      id: 7,
      type: 'MEMBRE',
      title: 'Nouveau membre inscrit',
      message: 'Bienvenue à Abena Osei dans la communauté AfriSime',
      user: 'Admin',
      timestamp: '2026-01-12T15:10:00',
      read: true,
      priority: 'normal',
      icon: '👥',
      color: 'blue'
    },
    {
      id: 8,
      type: 'REMBOURSEMENT',
      title: 'Rappel de remboursement',
      message: 'Échéance de remboursement de crédit dans 3 jours - €150.00',
      user: 'Système',
      timestamp: '2026-01-12T10:00:00',
      read: true,
      priority: 'high',
      icon: '⏰',
      color: 'yellow'
    }
  ]);

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    urgent: notifications.filter(n => n.priority === 'urgent').length,
    today: notifications.filter(n => {
      const today = new Date().toDateString();
      const notifDate = new Date(n.timestamp).toDateString();
      return today === notifDate;
    }).length
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    if (filter === 'urgent') return n.priority === 'urgent' || n.priority === 'high';
    return n.type.toLowerCase() === filter.toLowerCase();
  });

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getTimeDiff = (timestamp: string) => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return "Hier";
    return `Il y a ${diffDays} jours`;
  };

  const colorClasses: Record<NotificationColor, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700'
  };

  const priorityBadges: Record<NotificationPriority, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-300',
    high: 'bg-orange-100 text-orange-700 border-orange-300',
    normal: 'bg-gray-100 text-gray-600 border-gray-300'
  };

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
                  Restez informé de toutes les activités AfriSime
                </p>
              </div>
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              >
                Tout marquer comme lu
              </button>
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
                { key: 'all', label: 'Toutes', icon: '📋' },
                { key: 'unread', label: 'Non lues', icon: '📬' },
                { key: 'urgent', label: 'Urgentes', icon: '🔴' },
                { key: 'cotisation', label: 'Cotisations', icon: '💰' },
                { key: 'tontine', label: 'Tontines', icon: '🔄' },
                { key: 'credit', label: 'Crédits', icon: '💳' },
                { key: 'wallet', label: 'Wallet', icon: '👛' }
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                    filter === key
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span>{icon}</span>
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
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune notification
              </h3>
              <p className="text-gray-500 text-sm">
                Vous n&apos;avez pas de notifications pour ce filtre
              </p>
            </div>    
          ) : (
            filteredNotifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`bg-white rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden ${
                  !notification.read ? 'border-l-emerald-500' : 'border-l-gray-200'
                }`}
                style={{
                  animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                }}
              >
                {!notification.read && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-emerald-500 rounded-full m-4"></div>
                )}

                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                      colorClasses[notification.color] || 'bg-gray-100 border-gray-200'
                    }`}>
                      {notification.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-base font-semibold ${
                              !notification.read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              priorityBadges[notification.priority]
                            }`}>
                              {notification.priority === 'urgent' ? 'Urgent' : 
                               notification.priority === 'high' ? 'Important' : 'Normal'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              👤 {notification.user}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              🕐 {getTimeDiff(notification.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {!notification.read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors duration-200"
                          title="Marquer comme lu"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
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
            ))
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