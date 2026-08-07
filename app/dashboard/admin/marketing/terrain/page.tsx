"use client";

import { useState } from "react";
import OperationsTerrainMarketing from "@/components/marketing/OperationsTerrainMarketing";
import EvenementsMarketing from "@/components/marketing/EvenementsMarketing";

type Vue = "operations" | "evenements";

export default function TerrainMarketingPage() {
  const [vue, setVue] = useState<Vue>("operations");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("operations")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "operations" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Opérations</button>
        <button onClick={() => setVue("evenements")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "evenements" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Événements</button>
      </div>
      {vue === "operations" ? <OperationsTerrainMarketing /> : <EvenementsMarketing />}
    </div>
  );
}
