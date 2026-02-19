'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import {
  ArrowLeft,
  Save,
  Package,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Produit {
  id: number;
  nom: string;
  description: string | null;
  prixUnitaire: string;
  stock: number;
  alerteStock: number;
}

interface ProduitResponse {
  data: Produit;
}

interface StockEditProps {
  produitId: string;
}

interface FormData {
  nom: string;
  description: string;
  prixUnitaire: string;
  alerteStock: string;
  ajustementStock: string;
  motifAjustement: string;
}

export default function StockEdit({ produitId }: StockEditProps) {
  const router = useRouter();
  const { data: response, loading } = useApi<ProduitResponse>(`/api/admin/stock/${produitId}`);
  const { mutate, loading: saving, error: saveError } = useMutation(`/api/admin/stock/${produitId}`, 'PUT', { successMessage: 'Produit modifié avec succès' });

  const [formData, setFormData] = useState<FormData>({
    nom: '',
    description: '',
    prixUnitaire: '',
    alerteStock: '',
    ajustementStock: '0',
    motifAjustement: '',
  });

  useEffect(() => {
    if (!response?.data) return;
    const timeout = setTimeout(() => {
      const p = response.data;
      setFormData({
        nom: p.nom,
        description: p.description || '',
        prixUnitaire: p.prixUnitaire,
        alerteStock: String(p.alerteStock),
        ajustementStock: '0',
        motifAjustement: '',
      });
    }, 0);
    return () => clearTimeout(timeout);
  }, [response]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await mutate({
      nom: formData.nom,
      description: formData.description || null,
      prixUnitaire: parseFloat(formData.prixUnitaire),
      alerteStock: parseInt(formData.alerteStock),
      ajustementStock: parseInt(formData.ajustementStock) || 0,
      motifAjustement: formData.motifAjustement || undefined,
    });
    if (result) {
      router.push(`/dashboard/admin/stock/${produitId}`);
    }
  };

  const produit = response?.data;
  const ajustement = parseInt(formData.ajustementStock) || 0;
  const nouveauStock = produit ? produit.stock + ajustement : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* En-tete */}
        <div className="mb-6 flex items-center gap-4">
          <Link href="/dashboard/admin/stock" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le produit</h1>
            <p className="text-sm text-gray-500 mt-1">Mettez a jour les informations et le stock</p>
          </div>
        </div>

        {saveError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur</p>
              <p className="text-sm text-red-600 mt-1">{saveError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations produit */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Informations du produit
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-2">Nom du produit *</label>
                <input type="text" id="nom" name="nom" value={formData.nom} onChange={handleChange} required className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none" />
              </div>
              <div>
                <label htmlFor="prixUnitaire" className="block text-sm font-medium text-gray-700 mb-2">Prix unitaire (XOF) *</label>
                <input type="number" id="prixUnitaire" name="prixUnitaire" value={formData.prixUnitaire} onChange={handleChange} required min="0" step="0.01" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label htmlFor="alerteStock" className="block text-sm font-medium text-gray-700 mb-2">Seuil d&apos;alerte *</label>
                <input type="number" id="alerteStock" name="alerteStock" value={formData.alerteStock} onChange={handleChange} required min="0" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Ajustement de stock */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Ajustement de stock</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock actuel</label>
                <p className="text-2xl font-bold text-gray-900">{produit?.stock ?? '—'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stock apres ajustement</label>
                <p className={`text-2xl font-bold ${nouveauStock < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {nouveauStock}
                </p>
              </div>
              <div>
                <label htmlFor="ajustementStock" className="block text-sm font-medium text-gray-700 mb-2">
                  Ajustement (positif = entree, negatif = sortie)
                </label>
                <input type="number" id="ajustementStock" name="ajustementStock" value={formData.ajustementStock} onChange={handleChange} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
              <div>
                <label htmlFor="motifAjustement" className="block text-sm font-medium text-gray-700 mb-2">Motif</label>
                <input type="text" id="motifAjustement" name="motifAjustement" value={formData.motifAjustement} onChange={handleChange} placeholder="Ex: Inventaire, livraison..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
            <Link
              href={`/dashboard/admin/stock/${produitId}`}
              className={`px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${saving ? 'pointer-events-none opacity-50' : ''}`}
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={saving || nouveauStock < 0}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
