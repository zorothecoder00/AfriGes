import ArchivageClasseurs from "@/components/ArchivageClasseurs";

export default function Page() {
  return <ArchivageClasseurs apiBase="/api/admin/archivage" backHref="/dashboard/admin/credits" />;
}
