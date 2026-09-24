"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, QrCode } from "lucide-react";

interface Modele { code: string; libelle: string }
interface Agent { id: number; nom: string; prenom: string; email: string }
interface Reponse { modeles: Modele[]; modele: Modele; url: string; qr: string; agents: Agent[] }

export default function QrDocumentsPage() {
  const [code, setCode] = useState("BCC");
  const [data, setData] = useState<Reponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    setLoading(true);
    fetch(`/api/admin/agents-terrain/qr-documents?code=${code}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        if (actif) setData(j as Reponse);
      })
      .catch((e) => { if (actif) setError(e instanceof Error ? e.message : "Erreur"); })
      .finally(() => { if (actif) setLoading(false); });
    return () => { actif = false; };
  }, [code]);

  const agents = data?.agents ?? [];

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <Link href="/dashboard/admin/agents-terrain" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux agents
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <select
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
            >
              {data.modeles.map((m) => (
                <option key={m.code} value={m.code}>{m.libelle}</option>
              ))}
            </select>
          )}
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
            <QrCode className="w-5 h-5 text-indigo-600" /> Planche QR — {data?.modele.libelle ?? "Documents commerciaux"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Un QR identique pour tous les agents (aucune donnée dedans) : scanné, il ouvre directement le formulaire
            &laquo;&nbsp;{data?.modele.libelle}&nbsp;&raquo; — mais l&apos;agent doit d&apos;abord se connecter (son
            identifiant est rappelé sur chaque carte). Imprimez, découpez et distribuez.
          </p>
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
                <img src={data?.qr} alt={`QR ${data?.modele.libelle}`} className="w-40 h-40" />
                <p className="mt-2 text-sm font-semibold text-slate-800 text-center">{a.prenom} {a.nom}</p>
                <p className="text-[10px] text-slate-400 text-center">{a.email}</p>
                <p className="no-print text-[10px] text-slate-400 text-center mt-0.5">{data?.modele.libelle} — connexion requise</p>
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
