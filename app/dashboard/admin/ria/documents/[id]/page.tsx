"use client";

import { use } from "react";
import Link from "next/link";
import { useApi, useMutation } from "@/hooks/useApi";
import { RefreshCw, Printer, ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

interface DocData {
  data: {
    id: number; type: string; titre: string; contenu: string | null; version: number;
    mois: number | null; annee: number | null; createdAt: string; archive: boolean;
    investisseur?: { gestionnaire?: { member?: { nom: string; prenom: string } | null } | null } | null;
    portefeuille?: { reference: string; nom: string | null } | null;
    generePar?: { nom: string; prenom: string } | null;
  };
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, refetch } = useApi<DocData>(`/api/admin/ria/documents/${id}`);
  const { mutate, loading: archiving } = useMutation<{ success: boolean }, { archive: boolean }>(
    `/api/admin/ria/documents/${id}`, "PATCH"
  );

  async function toggleArchive() {
    if (!data?.data) return;
    const res = await mutate({ archive: !data.data.archive });
    if (res?.success) {
      toast.success(data.data.archive ? "Document restauré" : "Document archivé");
      refetch();
    }
  }

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /> Chargement…
    </div>
  );
  if (error || !data?.data) return <div className="p-8 text-red-600">Document introuvable.</div>;

  const doc = data.data;

  return (
    <>
      {/* Barre d'actions */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3">
        <Link href="/dashboard/admin/ria/documents"
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{doc.titre}</p>
          <p className="text-xs text-slate-500">Généré le {new Date(doc.createdAt).toLocaleDateString("fr-FR")}
            {doc.generePar ? ` par ${doc.generePar.prenom} ${doc.generePar.nom}` : ""}</p>
        </div>
        <button onClick={toggleArchive} disabled={archiving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 disabled:opacity-50">
          {doc.archive
            ? <><ArchiveRestore className="w-4 h-4" /> Restaurer</>
            : <><Archive className="w-4 h-4" /> Archiver</>
          }
        </button>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-800 text-white rounded-lg">
          <Printer className="w-4 h-4" /> Imprimer / PDF
        </button>
      </div>

      {/* Contenu du document */}
      {doc.contenu ? (
        <div
          className="document-print-area"
          dangerouslySetInnerHTML={{ __html: doc.contenu }}
        />
      ) : (
        <div className="p-8 text-center text-slate-400">
          <p className="font-medium">Contenu non disponible</p>
          <p className="text-sm mt-1">Ce document n&apos;a pas encore de contenu généré.</p>
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
