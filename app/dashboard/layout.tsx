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

      {/* Aurora décorative — halos flous animés aux couleurs du logo, discrets,
          présents en fond sur tous les dashboards (admin + gestionnaires). */}
      <div className="no-print pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-40 -left-24 w-[34rem] h-[34rem] bg-brand-300/20 dark:bg-brand-700/10 rounded-full blur-3xl animate-[auroraFloat_20s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-28 w-[30rem] h-[30rem] bg-brand-400/15 dark:bg-brand-600/10 rounded-full blur-3xl animate-[auroraFloat_26s_ease-in-out_infinite_reverse]" />
        <div className="absolute bottom-0 left-1/4 w-[26rem] h-[26rem] bg-brand-200/20 dark:bg-brand-800/10 rounded-full blur-3xl animate-[auroraFloat_23s_ease-in-out_infinite]" />
      </div>

      {/* Bandeau d'identité AfriSime — fond crème + filet vert, présent sur tous les dashboards */}
      <div className="no-print border-b-2 border-brand-500 bg-cream/90 backdrop-blur-sm relative z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 md:justify-start md:px-6">
          <AfriSimeLogo className="h-9 w-auto md:h-10" priority />
        </div>
      </div>
      {children}
    </ViewAsProvider>
  )
}  

