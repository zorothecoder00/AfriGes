'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import CreditAlimentaireDetails from '@/components/CreditAlimentaireDetails';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CreditAlimentaireResponse {
  data: {
    id: number;
    plafond: string;
    montantUtilise: string;
    montantRestant: string;
    statut: string;
    source: string;
    sourceId: number;
    dateAttribution: string;
    dateExpiration?: string | null;
    client: {
      id: number;
      prenom: string;
      nom: string;
      telephone: string;
    } | null;
    transactions: Array<{
      id: number;
      type: string;
      montant: string;
      description?: string;
      createdAt: string;
    }>;
    ventes: Array<{
      id: number;
      quantite: number;
      prixUnitaire: string;
      createdAt: string;
      produit: {
        id: number;
        nom: string;
        description?: string;
      };
    }>;
  };
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: response, loading, error } = useApi<CreditAlimentaireResponse>(`/api/admin/creditsAlimentaires/${id}`);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{error || 'Credit alimentaire introuvable'}</p>
          <Link href="/dashboard/admin/creditsAlimentaires" className="mt-4 text-emerald-600 hover:text-emerald-700 inline-block">
            Retour aux credits alimentaires
          </Link>
        </div>
      </div>
    );
  }

  const c = response.data;
  const credit = {
    id: c.id,
    plafond: Number(c.plafond),
    montantUtilise: Number(c.montantUtilise),
    montantRestant: Number(c.montantRestant),
    statut: c.statut,
    source: c.source,
    sourceId: c.sourceId,
    dateAttribution: c.dateAttribution,
    dateExpiration: c.dateExpiration,
    client: c.client,
    transactions: c.transactions.map(t => ({
      ...t,
      montant: Number(t.montant),
    })),
    ventes: c.ventes.map(v => ({
      ...v,
      prixUnitaire: Number(v.prixUnitaire),
    })),
  };

  return (
    <CreditAlimentaireDetails
      credit={credit}
      onClose={() => router.push('/dashboard/admin/creditsAlimentaires')}
      onEdit={() => router.push(`/dashboard/admin/creditsAlimentaires/${id}/edit`)}
    />
  );
}
