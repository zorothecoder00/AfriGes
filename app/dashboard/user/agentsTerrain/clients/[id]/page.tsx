import ClientDetails from '@/components/ClientDetails';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return (
    <ClientDetails
      clientId={id}
      apiBase="/api/agentTerrain/clients"
      basePath="/dashboard/user/agentsTerrain/credits"
      canModify={false}
    />
  );
}
