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
      apiBase="/api/rvc/clients"
      basePath="/dashboard/user/responsablesVenteCredit/credits"
      canModify={false}
    />
  );
}
