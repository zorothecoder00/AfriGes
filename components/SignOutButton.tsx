'use client'
   
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { useT } from '@/contexts/AppSettingsContext';

interface SignOutButtonProps {
  redirectTo?: string
  className?: string
}   

export default function SignOutButton({
  redirectTo = '/auth/login?logout=success',
  className = '',
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false)
  const t  = useT();

  const handleSignOut = async () => {
    setLoading(true)

    await signOut({
      callbackUrl: redirectTo,
    })
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 ${className}`}
    >
      {loading ? t('dash_logging_out') : t('dash_logout')}
    </button>
  )
}
