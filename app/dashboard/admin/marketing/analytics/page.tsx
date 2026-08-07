"use client";

import { useState } from "react";
import AnalyticsMarketing from "@/components/marketing/AnalyticsMarketing";
import TestsABMarketing from "@/components/marketing/TestsABMarketing";

type Vue = "analytics" | "tests-ab";

export default function AnalyticsMarketingPage() {
  const [vue, setVue] = useState<Vue>("analytics");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("analytics")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "analytics" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Analytics</button>
        <button onClick={() => setVue("tests-ab")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "tests-ab" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Tests A/B</button>
      </div>
      {vue === "analytics" ? <AnalyticsMarketing /> : <TestsABMarketing />}
    </div>
  );
}
