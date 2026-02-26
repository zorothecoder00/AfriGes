"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

/**
 * Lien "Messages" avec badge de messages non lus pour les dashboards gestionnaires.
 * Poll toutes les 60 secondes pour mettre à jour le compteur.
 */
export default function MessagesLink() {
  const [nonLus, setNonLus] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/gestionnaire/messages/count");
        if (res.ok) {
          const data = await res.json();
          setNonLus(data.nonLus ?? 0);
        }
      } catch {
        // silencieux
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Link
      href="/dashboard/gestionnaire/messages"
      className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
    >
      <MessageSquare className="w-4 h-4" />
      Messages
      {nonLus > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {nonLus > 99 ? "99+" : nonLus}
        </span>
      )}
    </Link>
  );
}
