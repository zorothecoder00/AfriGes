'use client'

import GestionnaireEdit from '@/components/GestionnaireEdit'

interface PageProps {
  params: {
    id: string;
  };
}

export default function Page({ params }: PageProps) {
  return <GestionnaireEdit gestionnaireId={params.id} /> 
}  