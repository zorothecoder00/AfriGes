"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";

/**
 * Bouton retour intelligent pour les dashboards gestionnaires.
 * - En mode viewAs (admin en lecture) : renvoie vers /dashboard/admin/gestionnaires
 * - En mode normal : browser back (évite le redirect inutile vers /dashboard/user)
 */
export default function DashboardBackButton() {
  const { viewAs } = useViewAs();
  const router = useRouter();

  if (viewAs) {
    return (
      <Link href="/dashboard/admin/gestionnaires" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
        <ArrowLeft className="w-5 h-5 text-slate-600" />
      </Link>
    );
  }

  return (
    <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
      <ArrowLeft className="w-5 h-5 text-slate-600" />
    </button>
  );
}
