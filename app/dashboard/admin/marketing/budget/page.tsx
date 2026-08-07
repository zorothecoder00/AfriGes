"use client";

import { useState } from "react";
import BudgetsMarketing from "@/components/marketing/BudgetsMarketing";
import DepensesMarketing from "@/components/marketing/DepensesMarketing";

type Vue = "budgets" | "depenses";

export default function BudgetMarketingPage() {
  const [vue, setVue] = useState<Vue>("budgets");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("budgets")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "budgets" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Budgets</button>
        <button onClick={() => setVue("depenses")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "depenses" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Dépenses</button>
      </div>
      {vue === "budgets" ? <BudgetsMarketing /> : <DepensesMarketing />}
    </div>
  );
}
