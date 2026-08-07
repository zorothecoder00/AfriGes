"use client";

import { useState } from "react";
import PromotionsMarketing from "@/components/marketing/PromotionsMarketing";
import CouponsMarketing from "@/components/marketing/CouponsMarketing";

type Vue = "promotions" | "coupons";

export default function PromotionsMarketingPage() {
  const [vue, setVue] = useState<Vue>("promotions");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("promotions")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "promotions" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Promotions</button>
        <button onClick={() => setVue("coupons")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "coupons" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Coupons</button>
      </div>
      {vue === "promotions" ? <PromotionsMarketing /> : <CouponsMarketing />}
    </div>
  );
}
