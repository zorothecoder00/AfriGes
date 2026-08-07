"use client";

import { useState } from "react";
import RecompensesFidelite from "@/components/marketing/RecompensesFidelite";
import ChallengesMarketing from "@/components/marketing/ChallengesMarketing";
import BadgesMarketing from "@/components/marketing/BadgesMarketing";

type Vue = "recompenses" | "challenges" | "badges";

export default function FidelisationMarketingPage() {
  const [vue, setVue] = useState<Vue>("recompenses");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("recompenses")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "recompenses" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Récompenses</button>
        <button onClick={() => setVue("challenges")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "challenges" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Challenges</button>
        <button onClick={() => setVue("badges")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "badges" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Badges</button>
      </div>
      {vue === "recompenses" && <RecompensesFidelite />}
      {vue === "challenges" && <ChallengesMarketing />}
      {vue === "badges" && <BadgesMarketing />}
    </div>
  );
}
