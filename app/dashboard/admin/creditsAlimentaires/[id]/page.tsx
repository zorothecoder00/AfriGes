'use client';

import CreditAlimentaireDetails from '@/components/CreditAlimentaireDetails';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  return (
    <CreditAlimentaireDetails
      onClose={() => router.back()}
    />
  );
}
