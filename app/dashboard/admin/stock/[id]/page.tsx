'use client';

import StockDetails from '@/components/StockDetails';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <StockDetails produitId={id} />;
}
