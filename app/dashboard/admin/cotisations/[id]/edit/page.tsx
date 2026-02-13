'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useMutation } from '@/hooks/useApi';
import CotisationEdit, {
  CotisationUpdatePayload,
} from '@/components/CotisationEdit';

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
    client: {
      id: number;
      nom: string;
      prenom: string;
      telephone: string;
    } | null;
  };
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: response, loading, error } = useApi<CotisationResponse>(`/api/admin/cotisations/${id}`);
  const { mutate } = useMutation(`/api/admin/cotisations/${id}`, 'PATCH');

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
          <Link href="/dashboard/admin/cotisations" className="mt-4 text-emerald-600 hover:text-emerald-700 inline-block">
            Retour aux cotisations
          </Link>
        </div>
      </div>
    );
  }

  const c = response.data;
  const cotisation = {
    id: c.id,
    client: c.client ? {
      nom: c.client.nom,
      prenom: c.client.prenom,
      telephone: c.client.telephone,
    } : null,
    montant: Number(c.montant),
    periode: c.periode,
    datePaiement: c.datePaiement,
    dateExpiration: c.dateExpiration,
    statut: c.statut,
  };

  const handleClose = () => {
    router.push(`/dashboard/admin/cotisations/${id}`);
  };

  const handleSave = async (updatedData: CotisationUpdatePayload) => {
    const result = await mutate(updatedData);
    if (result) {
      router.push(`/dashboard/admin/cotisations/${id}`);
    }
  };

  return (
    <CotisationEdit
      cotisation={cotisation}
      onClose={handleClose}
      onSave={handleSave}
    />
  );
}
