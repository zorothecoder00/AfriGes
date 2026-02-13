'use client';

import StockEdit from '@/components/StockEdit';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <StockEdit produitId={id} />;
}
