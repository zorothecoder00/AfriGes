"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Download, Plus, Mail, Eye, Edit, Trash2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';
import { exportToCsv } from '@/lib/exportCsv';
import { useT } from '@/contexts/AppSettingsContext';

interface Member {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  photo: string | null;
  createdAt: string;
}

interface MembresResponse {
  data: Member[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function MembresPage() {
  const t = useT();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', password: '', telephone: '', adresse: '', role: 'USER' });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const limit = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (roleFilter) params.set('role', roleFilter);

  const { data: response, loading, error, refetch } = useApi<MembresResponse>(`/api/admin/membres?${params}`);
  const membres = response?.data ?? [];
  const meta = response?.meta;

  const handleExport = () => exportToCsv(
    membres,
    [
      { label: "ID",       key: "id" },
      { label: t('label_prenom'),   key: "prenom" },
      { label: t('label_nom'),      key: "nom" },
      { label: t('label_email'),    key: "email" },
      { label: t('label_role'),     key: "role" },
      { label: t('membres_col_inscription'), key: "createdAt", format: (v) => formatDate(String(v)) },
    ],
    "membres.csv"
  );

  const { mutate: addMember, loading: adding, error: addError } = useMutation('/api/admin/membres', 'POST', { successMessage: 'Membre ajouté avec succès', errorMessage: 'Erreur lors de l\'ajout du membre' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addMember(formData);
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', prenom: '', email: '', password: '', telephone: '', adresse: '', role: 'USER' });
      refetch();
    }
  };

  const deleteIdRef = useRef<number | null>(null);
  const { mutate: deleteMember, loading: deletingMember } = useMutation(() => `/api/admin/membres/${deleteIdRef.current}`, 'DELETE', { successMessage: 'Membre supprimé avec succès' });

  const handleDelete = async () => {
    if (!deleteId) return;
    deleteIdRef.current = deleteId;
    const result = await deleteMember({});
    if (result) {
      setDeleteId(null);
      refetch();
    }
  };

  const getInitials = (nom: string, prenom: string) => `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase();

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">{t('membres_loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">{t('text_error_loading')}</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">{t('btn_retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">{t('membres_title')}</h1>
              <p className="text-slate-500">{t('membres_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium"
          >
            <Plus size={20} />
            {t('membres_add_btn')}
          </button>
        </div>

        {/* Modal pour ajouter membre */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold"
              >X</button>
              <h2 className="text-xl font-bold mb-1">{t('membres_add_title')}</h2>
              <p className="text-sm text-slate-500 mb-4">{t('text_required_fields')}</p>
              {addError && <p className="text-red-500 text-sm mb-3">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" placeholder={`${t('label_nom')} *`} required
                    value={formData.nom}
                    onChange={e => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="text" placeholder={`${t('label_prenom')} *`} required
                    value={formData.prenom}
                    onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <input
                  type="email" placeholder={`${t('label_email')} *`} required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="password" placeholder={`${t('label_password')} *`} required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text" placeholder={t('label_telephone')}
                    value={formData.telephone}
                    onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="text" placeholder={t('label_adresse')}
                    value={formData.adresse}
                    onChange={e => setFormData({ ...formData, adresse: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Sélection du rôle */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={15} className="text-slate-500" />
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t('membres_role_compte')}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio" name="role" value="USER"
                        checked={formData.role === 'USER'}
                        onChange={() => setFormData({ ...formData, role: 'USER' })}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{t('role_user')}</p>
                        <p className="text-xs text-slate-400">{t('membres_role_user_desc')}</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio" name="role" value="ADMIN"
                        checked={formData.role === 'ADMIN'}
                        onChange={() => setFormData({ ...formData, role: 'ADMIN' })}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{t('role_admin')}</p>
                        <p className="text-xs text-slate-400">{t('membres_role_admin_desc')}</p>
                      </div>
                    </label>
                    {isSuperAdmin && (
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="radio" name="role" value="SUPER_ADMIN"
                          checked={formData.role === 'SUPER_ADMIN'}
                          onChange={() => setFormData({ ...formData, role: 'SUPER_ADMIN' })}
                          className="mt-0.5 accent-violet-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-violet-700">{t('role_superadmin')}</p>
                          <p className="text-xs text-slate-400">{t('membres_role_sadmin_desc')}</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adding}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium"
                >
                  {adding ? t('membres_adding') : t('membres_add_submit')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Confirmation Suppression */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130]">
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-lg text-center">
              <h2 className="text-lg font-bold text-slate-800 mb-2">{t('text_confirm_delete')}</h2>
              <p className="text-slate-500 text-sm mb-6">{t('membres_confirm_del')} {t('text_irreversible')}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
                  {t('btn_cancel')}
                </button>
                <button onClick={handleDelete} disabled={deletingMember} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium">
                  {deletingMember ? t('membres_deleting') : t('btn_delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-5">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">{t('membres_total')}</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.total ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">{t('membres_current_page')}</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{meta?.page ?? '—'} / {meta?.totalPages ?? '—'}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">{t('membres_display')}</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{membres.length} {t('membres_title').toLowerCase()}</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
            <span className="text-slate-600 text-sm font-medium">{t('label_search')}</span>
            <p className="text-3xl font-bold text-slate-800 mt-1">{debouncedSearch || t('membres_none')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder={t('membres_search_ph')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
            >
              <option value="">{t('membres_all_roles')}</option>
              <option value="USER">{t('role_user')}</option>
              <option value="ADMIN">{t('role_admin')}</option>
              <option value="SUPER_ADMIN">{t('role_superadmin')}</option>
            </select>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
              {t('btn_filters')}
            </button>
            <button onClick={handleExport} className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Download size={18} />
              {t('btn_export')}
            </button>
          </div>
        </div>

        {/* Members Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_member')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_contact')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_role')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('membres_col_inscription')}</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {membres.map((membre) => (
                  <tr key={membre.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold shadow-md">
                          {getInitials(membre.nom, membre.prenom)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{membre.prenom} {membre.nom}</p>
                          <p className="text-sm text-slate-500">{membre.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        {membre.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(membre.role)}`}>
                        {getStatusLabel(membre.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{formatDate(membre.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/admin/membres/${membre.id}`} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <Eye size={16} />
                        </Link>
                        <Link href={`/dashboard/admin/membres/${membre.id}/edit`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={16} />
                        </Link>
                        <button onClick={() => setDeleteId(membre.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {membres.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">{t('membres_none_found')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {t('page')} <span className="font-semibold">{meta.page}</span> / <span className="font-semibold">{meta.totalPages}</span> ({meta.total} {t('membres_title').toLowerCase()})
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_prev')}
                </button>
                <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium">{page}</span>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                  {t('btn_next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
