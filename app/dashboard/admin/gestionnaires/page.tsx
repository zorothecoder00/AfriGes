"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Users, Key, Eye, Edit, MoreVertical, CheckCircle, Clock, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import { getStatusLabel } from '@/lib/status';

interface Gestionnaire {
  id: number;
  role: string;
  actif: boolean;
  createdAt: string;
  member: {
    id: number;
    nom: string;
    prenom: string;
    email: string;
    telephone: string | null;
  };
}

interface GestionnairesResponse {
  data: Gestionnaire[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const roleCouleurs: Record<string, string> = {
  AGENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SUPERVISEUR: 'bg-purple-100 text-purple-700 border-purple-200',
  CAISSIER: 'bg-blue-100 text-blue-700 border-blue-200',
};

export default function GestionnairesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (roleFilter) params.set('role', roleFilter);

  const { data: response, loading, error, refetch } = useApi<GestionnairesResponse>(`/api/admin/gestionnaires?${params}`);
  const allGestionnaires = response?.data ?? [];
  const meta = response?.meta;

  // Client-side search (API doesn't have search param for gestionnaires)
  const gestionnaires = allGestionnaires.filter((g) =>
    !debouncedSearch ||
    g.member.nom.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    g.member.prenom.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    g.member.email.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const totalActifs = allGestionnaires.filter((g) => g.actif).length;
  const totalInactifs = allGestionnaires.filter((g) => !g.actif).length;

  const stats = [
    { label: 'Total Gestionnaires', value: String(meta?.total ?? 0), icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Actifs', value: String(totalActifs), icon: CheckCircle, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Inactifs', value: String(totalInactifs), icon: Clock, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Roles', value: '3', icon: Shield, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
  ];

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des gestionnaires...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-blue-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestionnaires</h1>
            <p className="text-slate-500">Gerez les administrateurs et leurs permissions</p>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Shield size={18} />
              Gerer les roles
            </button>
            <button className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Ajouter un gestionnaire
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-4">
                  <div className={`${stat.lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                    <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                  </div>
                </div>
                <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              </div>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher un gestionnaire..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
            >
              <option value="">Tous les roles</option>
              <option value="AGENT">Agent</option>
              <option value="SUPERVISEUR">Superviseur</option>
              <option value="CAISSIER">Caissier</option>
            </select>
          </div>
        </div>

        {/* Gestionnaires Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Gestionnaire</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date creation</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gestionnaires.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-lg">
                          {getInitials(g.member.nom, g.member.prenom)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{g.member.prenom} {g.member.nom}</p>
                          <p className="text-xs text-slate-500">Depuis {formatDate(g.createdAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} className="text-slate-400" />
                          {g.member.email}
                        </div>
                        {g.member.telephone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            {g.member.telephone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${roleCouleurs[g.role] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        <Shield size={12} />
                        {getStatusLabel(g.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${g.actif ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {g.actif ? <CheckCircle size={14} className="text-emerald-600" /> : <Clock size={14} className="text-slate-600" />}
                        {g.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{formatDate(g.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/admin/gestionnaires/${g.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <Eye size={16} />
                        </Link>
                        <Link href={`/dashboard/admin/gestionnaires/${g.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={16} />
                        </Link>
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {gestionnaires.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">Aucun gestionnaire trouve</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{meta.page}</span> sur <span className="font-semibold">{meta.totalPages}</span> ({meta.total} gestionnaires)
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Precedent
                </button>
                <span className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
