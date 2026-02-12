'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import CotisationDetails from '@/components/CotisationDetails';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CotisationResponse {
  data: {
    id: number;
    montant: string;
    periode: 'MENSUEL' | 'ANNUEL';
    datePaiement: string | null;
    dateExpiration: string;
    statut: 'EN_ATTENTE' | 'PAYEE' | 'EXPIREE';
    createdAt: string;
    updatedAt: string;
    member: {
      id: number;
      nom: string;
      prenom: string;
      email: string;
      telephone?: string;
      photo?: string;
    };
  };
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: response, loading, error } = useApi<CotisationResponse>(`/api/admin/cotisations/${id}`);

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
          <p className="text-gray-600">{error || 'Cotisation introuvable'}</p>
          <button onClick={() => router.back()} className="mt-4 text-emerald-600 hover:text-emerald-700">
            Retour
          </button>
        </div>
      </div>
    );
  }

  const c = response.data;
  const cotisation = {
    id: c.id,
    membre: {
      nom: c.member.nom,
      prenom: c.member.prenom,
      email: c.member.email,
      telephone: c.member.telephone,
      photo: c.member.photo,
    },
    montant: Number(c.montant),
    periode: c.periode,
    datePaiement: c.datePaiement,
    dateExpiration: c.dateExpiration,
    statut: c.statut,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };

  return (
    <CotisationDetails
      cotisation={cotisation}
      onClose={() => router.back()}
    />
  );
}
