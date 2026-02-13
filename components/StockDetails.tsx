'use client';

import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  ArrowLeft,
  Edit,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
} from 'lucide-react';

interface Mouvement {
  id: number;
  type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
  quantite: number;
  motif: string | null;
  reference: string;
  dateMouvement: string;
}

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
  createdAt: string;
  updatedAt: string;
  mouvements: Mouvement[];
}

interface ProduitResponse {
  data: Produit;
}

interface StockDetailsProps {
  produitId: string;
}

export default function StockDetails({ produitId }: StockDetailsProps) {
  const { data: response, loading, error, refetch } = useApi<ProduitResponse>(`/api/admin/stock/${produitId}`);
  const produit = response?.data;

  const getStockStatus = (stock: number, alerte: number) => {
    if (stock === 0) return { label: 'Rupture', color: 'bg-red-100 text-red-700' };
    if (stock <= alerte) return { label: 'Stock faible', color: 'bg-amber-100 text-amber-700' };
    return { label: 'En stock', color: 'bg-emerald-100 text-emerald-700' };
  };

  const getMouvementIcon = (type: string) => {
    switch (type) {
      case 'ENTREE': return <ArrowUpCircle className="w-5 h-5 text-emerald-500" />;
      case 'SORTIE': return <ArrowDownCircle className="w-5 h-5 text-red-500" />;
      default: return <RefreshCw className="w-5 h-5 text-blue-500" />;
    }
  };

  const getMouvementColor = (type: string) => {
    switch (type) {
      case 'ENTREE': return 'text-emerald-600';
      case 'SORTIE': return 'text-red-600';
      default: return 'text-blue-600';
    }
  };

  if (loading && !produit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du produit...</p>
        </div>
      </div>
    );
  }

  if (error && !produit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 bg-white rounded-2xl p-8 shadow-sm border max-w-md text-center">
          <h3 className="text-lg font-bold text-slate-800">Erreur</h3>
          <p className="text-slate-500 text-sm">{error}</p>
          <div className="flex gap-3">
            <Link href="/dashboard/admin/stock" className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium">
              Retour au stock
            </Link>
            <button onClick={refetch} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Reessayer</button>
          </div>
        </div>
      </div>
    );
  }

  if (!produit) return null;

  const status = getStockStatus(produit.stock, produit.alerteStock);
  const valeurStock = Number(produit.prixUnitaire) * produit.stock;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/stock" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{produit.nom}</h1>
              <p className="text-sm text-gray-500 mt-1">Reference #{produit.id}</p>
            </div>
          </div>
          <Link
            href={`/dashboard/admin/stock/${produitId}/edit`}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
        </div>

        {/* Cartes statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <Package className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-500">Stock actuel</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{produit.stock}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-gray-500">Seuil d&apos;alerte</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{produit.alerteStock}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-sm text-gray-500">Prix unitaire</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(Number(produit.prixUnitaire))}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-gray-500">Valeur stock</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(valeurStock)}</p>
          </div>
        </div>

        {/* Informations produit */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations du produit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">Nom</p>
                <p className="text-sm font-medium text-gray-900">{produit.nom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Statut</p>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900">{produit.description || 'Aucune description'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Date de creation</p>
                <p className="text-sm text-gray-900">{formatDate(produit.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Derniere modification</p>
                <p className="text-sm text-gray-900">{formatDate(produit.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Historique des mouvements */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Historique des mouvements</h3>
            <p className="text-sm text-gray-500 mt-1">Les 50 derniers mouvements de stock</p>
          </div>
          {produit.mouvements.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Aucun mouvement enregistre</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {produit.mouvements.map((m) => (
                <div key={m.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    {getMouvementIcon(m.type)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {m.type === 'ENTREE' ? 'Entree' : m.type === 'SORTIE' ? 'Sortie' : 'Ajustement'}
                      </p>
                      <p className="text-xs text-gray-500">{m.motif || m.reference}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${getMouvementColor(m.type)}`}>
                      {m.type === 'SORTIE' ? '-' : '+'}{m.quantite}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(m.dateMouvement)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
