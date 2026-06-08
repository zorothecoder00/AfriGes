import type { ReactNode } from "react";
import { TagModalProvider } from "@/contexts/TagModalContext";
import TagClientsModal from "@/components/admin/TagClientsModal";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <TagModalProvider>
      {children}
      <TagClientsModal />
    </TagModalProvider>
  );
}
