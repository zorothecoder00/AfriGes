import type { ReactNode } from 'react'
import AfriSimeLogo from '@/components/AfriSimeLogo'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-[120] border-b border-emerald-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-2 md:justify-start md:px-6">
          <AfriSimeLogo className="h-9 w-auto md:h-10" priority />
        </div>
      </div>
      {children}
    </>
  )
}