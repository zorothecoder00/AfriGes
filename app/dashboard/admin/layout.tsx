import type { ReactNode } from "react";
import { TagModalProvider } from "@/contexts/TagModalContext";
import TagClientsModal from "@/components/admin/TagClientsModal";
import AccountMenuButton from "@/components/AccountMenuButton";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <TagModalProvider>
      {children}
      <AccountMenuButton settingsHref="/dashboard/admin/parametres" />
      <TagClientsModal />
    </TagModalProvider>
  );
}
