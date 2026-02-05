'use client';

import { useRouter } from 'next/navigation';
import CotisationDetails from '@/components/CotisationDetails';

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();

  const cotisation = {
    id: Number(params.id),
    membre: {
      nom: 'Doe',
      prenom: 'John',
      email: 'john@example.com',
    },
    montant: 100,
    periode: 'MENSUEL',
    dateExpiration: '2026-12-31',
    statut: 'EN_ATTENTE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as const;

  return (
    <CotisationDetails
      cotisation={cotisation}
      onClose={() => router.back()}
    />
  );
}
