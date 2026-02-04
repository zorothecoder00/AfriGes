'use client';

import { useRouter } from 'next/navigation';
import CreditAlimentaireEdit, { UpdateCreditAlimentaireData } from '@/components/CreditAlimentaireEdit';

export default function Page() {
  const router = useRouter();

  // Fonction pour sauvegarder les modifications (exemple vide)
  const handleSave = async (data: UpdateCreditAlimentaireData) => {
    // Ici tu pourrais appeler ton API pour mettre à jour le crédit
    console.log('Données à sauvegarder:', data);
    // Par exemple : await fetch(`/api/credits-alimentaires/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  };

  return (
    <CreditAlimentaireEdit
      onClose={() => router.back()}   // obligatoire
      onSave={handleSave}            // obligatoire
    />
  );
}
