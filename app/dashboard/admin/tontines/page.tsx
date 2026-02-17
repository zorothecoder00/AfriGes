"use client";

import React, { useState } from 'react';
import { Plus, Search, Filter, Download, Users, DollarSign, TrendingUp, Clock, Eye, Edit, Trash2, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import { getStatusStyle, getStatusLabel } from '@/lib/status';

interface TontineMembre {
  id: number;
  client: { id: number; nom: string; prenom: string } | null;
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
  dateFin: string | null;
  membres: TontineMembre[];
}

interface TontinesResponse {
  data: Tontine[];
}

type CouleurTontine = 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'indigo';

const couleurs: CouleurTontine[] = ['emerald', 'amber', 'blue', 'purple', 'rose', 'indigo'];

const colorClasses: Record<CouleurTontine, { bg: string; lightBg: string; text: string; gradient: string }> = {
  emerald: { bg: 'bg-emerald-500', lightBg: 'bg-emerald-50', text: 'text-emerald-700', gradient: 'from-emerald-500 to-emerald-600' },
  amber: { bg: 'bg-amber-500', lightBg: 'bg-amber-50', text: 'text-amber-700', gradient: 'from-amber-500 to-amber-600' },
  blue: { bg: 'bg-blue-500', lightBg: 'bg-blue-50', text: 'text-blue-700', gradient: 'from-blue-500 to-blue-600' },
  purple: { bg: 'bg-purple-500', lightBg: 'bg-purple-50', text: 'text-purple-700', gradient: 'from-purple-500 to-purple-600' },
  rose: { bg: 'bg-rose-500', lightBg: 'bg-rose-50', text: 'text-rose-700', gradient: 'from-rose-500 to-rose-600' },
  indigo: { bg: 'bg-indigo-500', lightBg: 'bg-indigo-50', text: 'text-indigo-700', gradient: 'from-indigo-500 to-indigo-600' },
};

export default function TontinesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nom: '', description: '', montantCycle: '', frequence: 'MENSUEL', dateDebut: '', dateFin: ''
  });

  const { data: response, loading, error, refetch } = useApi<TontinesResponse>('/api/admin/tontines');
  const tontines = response?.data ?? [];

  // Mutations
  const { mutate: addTontine, loading: adding, error: addError } = useMutation('/api/admin/tontines', 'POST', { successMessage: 'Tontine créée avec succès' });
  const { mutate: deleteTontine, loading: deleting } = useMutation(`/api/admin/tontines/${deleteId}`, 'DELETE', { successMessage: 'Tontine supprimée avec succès' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await addTontine({
      nom: formData.nom,
      description: formData.description || undefined,
      montantCycle: Number(formData.montantCycle),
      frequence: formData.frequence,
      dateDebut: formData.dateDebut,
      dateFin: formData.dateFin || undefined,
    });
    if (result) {
      setModalOpen(false);
      setFormData({ nom: '', description: '', montantCycle: '', frequence: 'MENSUEL', dateDebut: '', dateFin: '' });
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteTontine({});
    if (result) {
      setDeleteId(null);
      refetch();
    }
  };

  const filtered = tontines.filter((t) =>
    !searchQuery || t.nom.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMembres = tontines.reduce((sum, t) => sum + t.membres.length, 0);
  const tontinesActives = tontines.filter((t) => t.statut === 'ACTIVE').length;
  const montantTotal = tontines.reduce((sum, t) => sum + Number(t.montantCycle), 0);

  const stats = [
    { label: 'Tontines Actives', value: String(tontinesActives), icon: TrendingUp, color: 'bg-emerald-500', lightBg: 'bg-emerald-50' },
    { label: 'Total Membres', value: String(totalMembres), icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50' },
    { label: 'Montant Total', value: formatCurrency(montantTotal), icon: DollarSign, color: 'bg-amber-500', lightBg: 'bg-amber-50' },
    { label: 'Total Tontines', value: String(tontines.length), icon: Clock, color: 'bg-purple-500', lightBg: 'bg-purple-50' },
  ];

  if (loading && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement des tontines...</p>
        </div>
      </div>
    );
  }

  if (error && !response) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur de chargement</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <button onClick={refetch} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium">Reessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/20 font-['DM_Sans',sans-serif] p-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-slate-800 mb-2">Tontines</h1>
              <p className="text-slate-500">Gerez toutes les tontines de votre communaute</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="px-5 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
              <Download size={18} />
              Rapport
            </button>
            <button onClick={() => setModalOpen(true)} className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
              <Plus size={20} />
              Creer une tontine
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

        {/* Search */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher une tontine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
            </div>
            <button className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-200 transition-all flex items-center gap-2 font-medium">
              <Filter size={18} />
              Plus de filtres
            </button>
          </div>
        </div>

        {/* Modal Ajout Tontine */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-lg relative">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
              <h2 className="text-xl font-bold mb-4">Creer une tontine</h2>
              {addError && <p className="text-red-500 mb-2 text-sm">{addError}</p>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nom de la tontine</label>
                  <input type="text" placeholder="Ex: Tontine Solidarite Femmes" required value={formData.nom}
                    onChange={e => setFormData({ ...formData, nom: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description (optionnel)</label>
                  <textarea placeholder="Decrivez brievement cette tontine..." value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 resize-none" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Montant par cycle (FCFA)</label>
                  <input type="number" placeholder="Ex: 50 000" required min="1" value={formData.montantCycle}
                    onChange={e => setFormData({ ...formData, montantCycle: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequence</label>
                  <select value={formData.frequence} onChange={e => setFormData({ ...formData, frequence: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50">
                    <option value="HEBDOMADAIRE">Hebdomadaire</option>
                    <option value="MENSUEL">Mensuel</option>
                    <option value="TRIMESTRIEL">Trimestriel</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date de debut</label>
                    <input type="date" required value={formData.dateDebut}
                      onChange={e => setFormData({ ...formData, dateDebut: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin (optionnel)</label>
                    <input type="date" value={formData.dateFin}
                      onChange={e => setFormData({ ...formData, dateFin: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" />
                  </div>
                </div>
                <button type="submit" disabled={adding} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium">
                  {adding ? "Creation en cours..." : "Creer la tontine"}
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
              <p className="text-slate-500 text-sm mb-6">Voulez-vous vraiment supprimer cette tontine ? Elle ne doit pas avoir de membres.</p>
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

        {/* Tontines Grid */}
        <div className="grid grid-cols-3 gap-6">
          {filtered.map((tontine, idx) => {
            const couleur = couleurs[idx % couleurs.length];
            const colors = colorClasses[couleur];
            return (
              <div key={tontine.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden hover:shadow-lg transition-all group">
                <div className={`bg-gradient-to-r ${colors.gradient} p-6 text-white`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyle(tontine.statut)}`}>
                        {getStatusLabel(tontine.statut)}
                      </span>
                      <h3 className="text-xl font-bold mb-1 mt-2">{tontine.nom}</h3>
                    </div>
                  </div>
                  <p className="text-sm opacity-80">{getStatusLabel(tontine.frequence)}</p>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${colors.lightBg} p-4 rounded-xl`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Users size={16} className={colors.text} />
                        <span className="text-xs text-slate-600 font-medium">Membres</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{tontine.membres.length}</p>
                    </div>
                    <div className={`${colors.lightBg} p-4 rounded-xl`}>
                      <div className="flex items-center gap-2 mb-1">
                        <DollarSign size={16} className={colors.text} />
                        <span className="text-xs text-slate-600 font-medium">Cycle</span>
                      </div>
                      <p className="text-2xl font-bold text-slate-800">{formatCurrency(tontine.montantCycle)}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Debut</span>
                      <span className="text-sm font-semibold text-slate-800">{formatDate(tontine.dateDebut)}</span>
                    </div>
                    {tontine.dateFin && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Fin</span>
                        <span className="text-sm font-semibold text-slate-800">{formatDate(tontine.dateFin)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                  <Link href={`/dashboard/admin/tontines/${tontine.id}`} className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-sm font-medium">
                    <Eye size={16} />
                    Details
                  </Link>
                  <Link href={`/dashboard/admin/tontines/${tontine.id}/edit`} className={`flex-1 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 text-sm font-medium`}>
                    <Edit size={16} />
                    Gerer
                  </Link>
                  <button onClick={() => setDeleteId(tontine.id)} className="px-3 py-2 bg-white border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-all flex items-center justify-center">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200/60 text-center">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Aucune tontine trouvee</h3>
            <p className="text-slate-500">Modifiez vos criteres de recherche ou creez une nouvelle tontine.</p>
          </div>
        )}
      </div>
    </div>
  );
}
