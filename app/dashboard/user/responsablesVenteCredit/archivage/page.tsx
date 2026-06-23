import ArchivageClasseurs from "@/components/ArchivageClasseurs";

export default function Page() {
  return <ArchivageClasseurs apiBase="/api/rvc/archivage" backHref="/dashboard/user/responsablesVenteCredit/credits" />;
}
