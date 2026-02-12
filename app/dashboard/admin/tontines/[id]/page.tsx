'use client';

import TontineDetails from '@/components/TontineDetails';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <TontineDetails tontineId={id} />;
}
