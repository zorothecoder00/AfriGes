"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";

/**
 * Lien "retour" des pages Approvisionnement (fournisseurs/RFQ/MRP/PO/tableau de bord),
 * partagées entre l'agent logistique (/dashboard/user/logistiquesApprovisionnements)
 * et l'admin (/dashboard/admin/approvisionnements) — la destination dépend du rôle
 * pour ne pas renvoyer un admin sur le dashboard opérationnel de l'agent.
 */
export default function RetourApprovisionnement({
  label = "Approvisionnement",
  className = "inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2",
}: { label?: string; className?: string }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const href = role === "ADMIN" || role === "SUPER_ADMIN"
    ? "/dashboard/admin/approvisionnements"
    : "/dashboard/user/logistiquesApprovisionnements";

  return (
    <Link href={href} className={className}>
      <ArrowLeft size={15} /> {label}
    </Link>
  );
}
