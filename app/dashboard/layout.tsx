import type { ReactNode } from 'react'
import AfriSimeLogo from '@/components/AfriSimeLogo'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-50 md:left-4 md:translate-x-0 lg:top-4 lg:left-6">
        <div className="inline-flex rounded-2xl border border-emerald-100 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
          <AfriSimeLogo className="h-7 w-auto md:h-8" priority />
        </div>
      </div>
      {children}
    </>
  )
}