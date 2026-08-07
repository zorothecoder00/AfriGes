"use client";

import { useState } from "react";
import OperationsTerrainMarketing from "@/components/marketing/OperationsTerrainMarketing";
import ZonesChalandiseMarketing from "@/components/marketing/ZonesChalandiseMarketing";

type Vue = "operations" | "zones";

export default function TerrainMarketingPage() {
  const [vue, setVue] = useState<Vue>("operations");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("operations")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "operations" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Opérations</button>
        <button onClick={() => setVue("zones")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "zones" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Zones de chalandise</button>
      </div>
      {vue === "operations" && <OperationsTerrainMarketing />}
      {vue === "zones" && <ZonesChalandiseMarketing />}
    </div>
  );
}
