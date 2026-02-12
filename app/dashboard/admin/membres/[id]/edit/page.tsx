'use client'

import EditMember from '@/components/MemberEdit'
import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function Page({ params }: PageProps) {
  const { id } = use(params);
  return <EditMember memberId={id} />
}
