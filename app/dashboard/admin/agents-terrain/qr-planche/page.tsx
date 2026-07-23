"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, QrCode } from "lucide-react";

interface AgentQR { id: number; nom: string; prenom: string; url: string; qr: string }

export default function QrPlanchePage() {
  const [agents, setAgents] = useState<AgentQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    fetch("/api/admin/agents-terrain/scan-qr")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        if (actif) setAgents(j.data as AgentQR[]);
      })
      .catch((e) => { if (actif) setError(e instanceof Error ? e.message : "Erreur"); })
      .finally(() => { if (actif) setLoading(false); });
    return () => { actif = false; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard/admin/agents-terrain" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux agents
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">{agents.length} agent(s)</span>
          <button onClick={() => window.print()} disabled={agents.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimer la planche
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        <div className="no-print mb-4">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-indigo-600" /> Planche des QR de tournée
          </h1>
          <p className="text-sm text-slate-500 mt-1">Un QR par agent. Imprimez, découpez et distribuez. Chaque QR ouvre les objectifs du jour + clients de l&apos;agent, sans login.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Génération des QR…</div>
        ) : error ? (
          <p className="text-center py-20 text-red-500">{error}</p>
        ) : agents.length === 0 ? (
          <p className="text-center py-20 text-slate-400">Aucun agent terrain actif.</p>
        ) : (
          <div className="qr-grid grid grid-cols-2 sm:grid-cols-3 gap-4">
            {agents.map((a) => (
              <div key={a.id} className="qr-card border border-slate-200 rounded-xl p-3 flex flex-col items-center bg-white break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.qr} alt={`QR ${a.prenom} ${a.nom}`} className="w-40 h-40" />
                <p className="no-print mt-2 text-sm font-semibold text-slate-800 text-center">{a.prenom} {a.nom}</p>
                <p className="no-print text-[10px] text-slate-400">Objectifs & tournée du jour</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .qr-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 12px !important; }
          .qr-card { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
