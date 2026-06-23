import ArchivageClasseurs from "@/components/ArchivageClasseurs";

export default function Page() {
  return <ArchivageClasseurs apiBase="/api/caissier/archivage" backHref="/dashboard/user/caissiers" />;
}
