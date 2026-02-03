import GestionnaireEdit from '@/components/GestionnaireEdit';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>; // Turbopack peut transformer params en Promise
}

export default function Page({ params }: PageProps) {
  const resolvedParams = use(params); // unwrap la Promise
  const id = resolvedParams.id;

  return <GestionnaireEdit gestionnaireId={id} />;
}
