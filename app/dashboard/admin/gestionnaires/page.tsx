"use client";

import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Users, Key, Eye, Edit, MoreVertical, CheckCircle, Clock, Mail, Phone, Trash2, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
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

interface MemberOption {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string | null;
}

export default function GestionnairesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ memberId: '', role: 'RESPONSABLE_POINT_DE_VENTE' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
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

  // Fetch members + tous les gestionnaires pour le formulaire d'ajout (seulement quand la modale est ouverte)
  const { data: membersResponse } = useApi<{ data: MemberOption[] }>(modalOpen ? '/api/admin/membres?limit=100' : null);
  const { data: allGestionnairesResponse } = useApi<GestionnairesResponse>(modalOpen ? '/api/admin/gestionnaires?limit=1000' : null);
  const gestionnairesMemberIds = new Set((allGestionnairesResponse?.data ?? []).map(g => g.member.id));
  const allMembers = (membersResponse?.data ?? []).filter(m => m.role === "USER" && !gestionnairesMemberIds.has(m.id));

  // Mutations
  const { mutate: addGestionnaire, loading: adding, error: addError } = useMutation('/api/admin/gestionnaires', 'POST', { successMessage: 'Gestionnaire ajouté avec succès' });
  const { mutate: deleteGestionnaire, loading: deleting } = useMutation(`/api/admin/gestionnaires/${deleteId}`, 'DELETE', { successMessage: 'Gestionnaire supprimé avec succès' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addGestionnaire({ memberId: Number(formData.memberId), role: formData.role });
    if (result) {
      setModalOpen(false);
      setFormData({ memberId: '', role: 'RESPONSABLE_POINT_DE_VENTE' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteGestionnaire({});
    if (result) {
      setDeleteId(null);
      refetch();
    }
  };

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
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Gestionnaires</h1>
              <p className="text-slate-500">Gerez les administrateurs et leurs permissions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Shield size={18} />
              Gerer les roles
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center gap-2 font-medium">
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
              <option value="RESPONSABLE_POINT_DE_VENTE">Resp. point de vente</option>
              <option value="RESPONSABLE_COMMUNAUTE">Resp. communaute</option>
              <option value="REVENDEUR">Revendeur</option>
              <option value="AGENT_LOGISTIQUE_APPROVISIONNEMENT">Agent logistique</option>
              <option value="MAGAZINIER">Magazinier</option>
              <option value="CAISSIER">Caissier</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="COMPTABLE">Comptable</option>
              <option value="AUDITEUR_INTERNE">Auditeur interne</option>
              <option value="RESPONSABLE_VENTE_CREDIT">Resp. vente credit</option>
              <option value="CONTROLEUR_TERRAIN">Controleur terrain</option>
              <option value="AGENT_TERRAIN">Agent terrain</option>
              <option value="RESPONSABLE_ECONOMIQUE">Resp. economique</option>
              <option value="RESPONSABLE_MARKETING">Resp. marketing</option>
              <option value="ACTIONNAIRE">Actionnaire</option>
            </select>
          </div>
        </div>

        {/* Modal Ajout Gestionnaire */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-4">Ajouter un gestionnaire</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Membre</label>
                  <select
                    required
                    value={formData.memberId}
                    onChange={e => setFormData({ ...formData, memberId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
                  >
                    <option value="">Selectionner un membre</option>
                    {allMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.prenom} {m.nom} ({m.email})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50"
                  >
                    <option value="RESPONSABLE_POINT_DE_VENTE">Responsable point de vente</option>
                    <option value="RESPONSABLE_COMMUNAUTE">Responsable communaute</option>
                    <option value="REVENDEUR">Revendeur</option>
                    <option value="AGENT_LOGISTIQUE_APPROVISIONNEMENT">Agent logistique / approvisionnement</option>
                    <option value="MAGAZINIER">Magazinier</option>
                    <option value="CAISSIER">Caissier</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="COMPTABLE">Comptable</option>
                    <option value="AUDITEUR_INTERNE">Auditeur interne</option>
                    <option value="RESPONSABLE_VENTE_CREDIT">Responsable vente credit</option>
                    <option value="CONTROLEUR_TERRAIN">Controleur terrain</option>
                    <option value="AGENT_TERRAIN">Agent terrain</option>
                    <option value="RESPONSABLE_ECONOMIQUE">Responsable economique</option>
                    <option value="RESPONSABLE_MARKETING">Responsable marketing</option>
                    <option value="ACTIONNAIRE">Actionnaire</option>
                  </select>
                </div>
                <button type="submit" disabled={adding} className="w-full py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-medium">
                  {adding ? "Ajout en cours..." : "Ajouter le gestionnaire"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirmation Suppression */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Confirmer la suppression</h2>
              <p className="text-slate-500 text-sm mb-6">Voulez-vous vraiment supprimer ce gestionnaire ? Cette action est irreversible.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

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
                        <button onClick={() => setDeleteId(g.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
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
