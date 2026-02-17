'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import CreditAlimentaireEdit, { UpdateCreditAlimentaireData } from '@/components/CreditAlimentaireEdit';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CreditAlimentaireResponse {
  data: {
    id: number;
    plafond: string;
    montantUtilise: string;
    montantRestant: string;
    statut: 'ACTIF' | 'EPUISE' | 'EXPIRE';
    source: 'COTISATION' | 'TONTINE';
    sourceId: number;
    dateExpiration?: string | null;
    client: {
      id: number;
      prenom: string;
      nom: string;
      telephone: string;
    } | null;
  };
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: response, loading, error } = useApi<CreditAlimentaireResponse>(`/api/admin/creditsAlimentaires/${id}`);
  const { mutate } = useMutation(`/api/admin/creditsAlimentaires/${id}`, 'PATCH', { successMessage: 'Crédit alimentaire modifié avec succès' });

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
    plafond: Number(c.plafond),
    montantUtilise: Number(c.montantUtilise),
    montantRestant: Number(c.montantRestant),
    statut: c.statut,
    source: c.source,
    sourceId: c.sourceId,
    dateExpiration: c.dateExpiration,
    client: c.client,
  };

  const handleSave = async (data: UpdateCreditAlimentaireData) => {
    const payload = {
      ...data,
      dateExpiration: data.dateExpiration ? data.dateExpiration.toISOString() : null,
    };
    const result = await mutate(payload);
    if (result) {
      router.push(`/dashboard/admin/creditsAlimentaires/${id}`);
    }
  };

  return (
    <CreditAlimentaireEdit
      credit={credit}
      onClose={() => router.push(`/dashboard/admin/creditsAlimentaires/${id}`)}
      onSave={handleSave}
    />
  );
}
