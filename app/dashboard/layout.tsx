import type { ReactNode } from 'react'
import AfriSimeLogo from '@/components/AfriSimeLogo'
import SessionGuard from '@/components/SessionGuard'
import ViewAsBanner from '@/components/ViewAsBanner'
import { ViewAsProvider } from '@/contexts/ViewAsContext'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ViewAsProvider>
      <SessionGuard />
      {/* Bandeau "Mode lecture" pour les admins en viewAs */}
      <ViewAsBanner />
      {/* Bandeau d'identité AfriSime — fond crème + filet vert, présent sur tous les dashboards */}
      <div className="border-b-2 border-brand-500 bg-cream">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 md:justify-start md:px-6">
          <AfriSimeLogo className="h-9 w-auto md:h-10" priority />
        </div>
      </div>
      {children}
    </ViewAsProvider>
  )
}  

