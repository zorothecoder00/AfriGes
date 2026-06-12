"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, ArrowLeft, Printer, FileSpreadsheet } from "lucide-react";
import { RapportContent, exportExcelRapport, type DonneesRapport } from "@/components/ria/RapportMensuel";

interface RapportData {
  data: {
    id: number; mois: number; annee: number; donnees: DonneesRapport; createdAt: string;
    portefeuille: { reference: string; nom: string | null };
  };
}

export default function RapportInvestisseurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error } = useApi<RapportData>(`/api/investisseurRIA/rapports/${id}`);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data?.data) return <div className="p-8 text-red-600">Rapport introuvable.</div>;

  const r = data.data;
  const d = r.donnees as DonneesRapport;

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard/user/investisseurs/rapports"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex-1">
          <p className="font-semibold text-slate-800">{d.periode?.label} — {d.portefeuille?.reference}</p>
        </div>
        <button onClick={() => exportExcelRapport(d)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors">
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-colors">
          <Printer className="w-4 h-4" /> PDF
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto print:p-8 print:max-w-none">
        <RapportContent d={d} genereA={d.genereA ?? r.createdAt} />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .rapport-content, .rapport-content * { visibility: visible; }
          .rapport-content { position: fixed; top: 0; left: 0; width: 100%; padding: 2rem; }
          @page { margin: 1.5cm; size: A4; }
        }
      `}</style>
    </>
  );
}
