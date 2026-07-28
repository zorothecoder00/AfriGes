"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DashboardBackButton from "@/components/DashboardBackButton";
import MessagerieApp from "@/components/messagerie/MessagerieApp";

function GestionnaireMessagesInner() {
  const searchParams = useSearchParams();
  const c = searchParams.get("c");
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <DashboardBackButton />
          <h1 className="text-2xl font-bold text-slate-800">Messages</h1>
        </div>
        <MessagerieApp initialConversationId={c ? Number(c) : undefined} />
      </div>
    </div>
  );
}

export default function GestionnaireMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Chargement…</div>}>
      <GestionnaireMessagesInner />
    </Suspense>
  );
}
