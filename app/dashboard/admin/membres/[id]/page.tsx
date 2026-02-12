'use client'

import MemberDetails from '@/components/MemberDetails'
import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <MemberDetails memberId={id} />
}
