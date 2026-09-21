"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { lireRetour } from "@/components/RetourLien";

interface Props {
  /** Sur les pages principales en viewAs, quitte le mode lecture. Mettre à false sur les sous-pages. */
  exitViewAsOnBack?: boolean;
}

export default function DashboardBackButton({ exitViewAsOnBack = true }: Props) {
  const router = useRouter();
  const { viewAs, exitViewAs } = useViewAs();

  const handleBack = () => {
    // Arrivée depuis le Centre de commandement (?retour=…) : retour explicite à cette page.
    const retour = lireRetour();
    if (viewAs && exitViewAsOnBack) {
      exitViewAs();
    } else if (retour) {
      router.push(retour);
    } else {
      router.back();
    }
  };

  return (
    <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
      <ArrowLeft className="w-5 h-5 text-slate-600" />
    </button>
  );
}
