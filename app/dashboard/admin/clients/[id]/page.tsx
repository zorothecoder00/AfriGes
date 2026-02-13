import ClientDetails from '@/components/ClientDetails';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  return <ClientDetails clientId={id} />;
}
