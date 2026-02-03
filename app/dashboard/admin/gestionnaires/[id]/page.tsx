'use client'

import GestionnaireDetails from '@/components/GestionnaireDetails';

interface PageProps {
  params: {
    id: string;
  };
}

export default function Page({ params }: PageProps) {
  return <GestionnaireDetails gestionnaireId={params.id} />;
}
