"use client";

import { useState, type ReactNode } from "react";
import { TagModalProvider } from "@/contexts/TagModalContext";
import TagClientsModal from "@/components/admin/TagClientsModal";
import AdminTopbar from "@/components/ui/AdminTopbar";
import AdminSidebar from "@/components/ui/AdminSidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <TagModalProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <AdminTopbar onMenuClick={() => setMobileNavOpen(true)} />
        <div className="max-w-[1800px] mx-auto px-5 md:px-8 py-6 flex gap-6">
          <AdminSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
      <TagClientsModal />
    </TagModalProvider>
  );
}
