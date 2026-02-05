'use client';

import { useRouter } from 'next/navigation';
import CotisationEdit, {
  CotisationUpdatePayload,
} from '@/components/CotisationEdit';

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
    periode: 'MENSUEL' as const,
    datePaiement: null,
    dateExpiration: '2026-12-31',
    statut: 'EN_ATTENTE' as const,
  };

  const handleClose = () => {
    router.back();
  };

  const handleSave = (updatedData: CotisationUpdatePayload) => {
    console.log('Données à envoyer à l’API :', updatedData);

    router.back();
  };

  return (
    <CotisationEdit
      cotisation={cotisation}
      onClose={handleClose}
      onSave={handleSave}
    />
  );
}
