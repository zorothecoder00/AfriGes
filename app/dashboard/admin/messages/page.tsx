"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import MessagerieApp from "@/components/messagerie/MessagerieApp";

function AdminMessagesInner() {
  const searchParams = useSearchParams();
  const c = searchParams.get("c");
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/20 p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Messages</h1>
        </div>
        <MessagerieApp initialConversationId={c ? Number(c) : undefined} />
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Chargement…</div>}>
      <AdminMessagesInner />
    </Suspense>
  );
}
