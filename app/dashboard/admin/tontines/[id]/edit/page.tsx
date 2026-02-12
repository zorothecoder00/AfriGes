'use client';

import TontineEdit from '@/components/TontineEdit';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <TontineEdit tontineId={id} />;
}
