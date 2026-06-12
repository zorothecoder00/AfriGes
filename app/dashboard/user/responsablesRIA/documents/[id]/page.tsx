"use client";

import { use } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { RefreshCw, Printer, ArrowLeft } from "lucide-react";

interface DocData {
  data: {
    id: number; type: string; titre: string; contenu: string | null; version: number;
    mois: number | null; annee: number | null; createdAt: string;
    generePar?: { nom: string; prenom: string } | null;
  };
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error } = useApi<DocData>(`/api/admin/ria/documents/${id}`);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data?.data) return <div className="p-8 text-red-600">Document introuvable.</div>;

  const doc = data.data;

  return (
    <>
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard/user/responsablesRIA/documents"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{doc.titre}</p>
          <p className="text-xs text-slate-500">Généré le {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
            {doc.generePar ? ` par ${doc.generePar.prenom} ${doc.generePar.nom}` : ""}</p>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg">
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </button>
      </div>

      {doc.contenu ? (
        <div
          className="document-print-area"
          dangerouslySetInnerHTML={{ __html: doc.contenu }}
        />
      ) : (
        <div className="p-8 text-center text-slate-400">
          <p className="font-medium">Contenu non disponible</p>
        </div>
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          .document-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>
    </>
  );
}
