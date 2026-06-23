import ArchivageClasseurs from "@/components/ArchivageClasseurs";

export default function Page() {
  return <ArchivageClasseurs apiBase="/api/agentTerrain/archivage" backHref="/dashboard/user/agentsTerrain/credits" />;
}
