"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Printer, RefreshCw, QrCode, ShieldAlert } from "lucide-react";

export default function MonQrPage() {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [regen, setRegen] = useState(false);

  // Chargement initial : uniquement des setState asynchrones (dans les callbacks).
  useEffect(() => {
    let actif = true;
    fetch("/api/agentTerrain/scan-qr")
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        if (actif) { setQr(j.data.qr); setUrl(j.data.url); }
      })
      .catch((e) => { if (actif) toast.error(e instanceof Error ? e.message : "Erreur"); })
      .finally(() => { if (actif) setLoading(false); });
    return () => { actif = false; };
  }, []);

  const regenerer = () => {
    setRegen(true);
    fetch("/api/agentTerrain/scan-qr", { method: "POST" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setQr(j.data.qr); setUrl(j.data.url);
        toast.success("Nouveau QR généré — l'ancien ne fonctionne plus");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setRegen(false));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">
        <Link href="/dashboard/user/agentsTerrain" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <QrCode className="w-6 h-6 text-indigo-600" /> Mon QR de tournée
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scannez ce code pour voir vos <strong>objectifs du jour</strong> et vos <strong>clients à visiter</strong>, sans vous connecter.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR de tournée" className="w-56 h-56" />
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="mt-3 text-xs text-indigo-600 break-all text-center hover:underline">{url}</a>
            </>
          ) : (
            <p className="text-sm text-slate-400 py-16">QR indisponible.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => window.print()} disabled={!qr}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button onClick={() => { if (confirm("Régénérer le QR ? L'ancien QR imprimé ne fonctionnera plus.")) regenerer(); }}
            disabled={regen}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
            {regen ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Régénérer
          </button>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Ce QR est <strong>personnel</strong> : quiconque le scanne voit vos clients et montants. Ne le partagez pas. En cas de perte, cliquez sur « Régénérer ».</span>
        </div>
      </div>
    </div>
  );
}
