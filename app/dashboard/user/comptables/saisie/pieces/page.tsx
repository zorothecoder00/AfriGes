"use client";

// Rubrique "Saisie comptable" → sous-page "Pièces justificatives" (clé d'accès "pieces").
// Extrait du bloc activeTab === "pieces" du monolithe : l'archive de toutes les
// pièces jointes (consultation + suppression), API /api/comptable/pieces
// (+ /api/comptable/pieces/[id] pour la suppression).
//
// Note : dans le monolithe, l'upload (uploadthing generateUploadButton) vivait
// dans une modale globale ("piecesModal") ouverte depuis l'icône « PJ » du
// Journal des opérations — pas depuis cet onglet archive lui-même, qui n'avait
// aucun déclencheur d'upload. Cette modale a donc été conservée avec le Journal
// (/journaux) où se trouve son seul point d'entrée d'origine, pour fidélité au
// comportement existant plutôt que d'inventer un nouveau bouton ici.

import { useState, useEffect, useMemo } from "react";
import {
  Paperclip, Search, X, ChevronLeft, ChevronRight, ExternalLink, Trash2,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatDateShort } from "@/lib/format";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

interface PieceEntry {
  id:             number;
  nom:            string;
  url:            string;
  uploadthingKey: string;
  type:           string;
  taille:         number;
  sourceType:     string;
  sourceId:       number;
  description:    string | null;
  archiverJusquau: string;
  createdAt:      string;
  uploadeUser:    { nom: string; prenom: string };
}
interface PiecesAllResponse { success: boolean; data: PieceEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } }

function formatTaille(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  if (octets >= 1024)        return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  VERSEMENT_PACK:      "Versement pack",
  OPERATION_CAISSE:    "Opération caisse",
  MOUVEMENT_STOCK:     "Mouvement stock",
  CLOTURE_COMPTABLE:   "Clôture comptable",
  VENTE_DIRECTE:       "Vente directe",
};

export default function PiecesJustificativesPage() {
  const [piecesPage, setPiecesPage]             = useState(1);
  const [piecesSearch, setPiecesSearch]         = useState("");
  const [piecesSearchDebounced, setPiecesSearchDebounced] = useState("");
  const [piecesSourceType, setPiecesSourceType] = useState("");
  const [piecesDateDebut, setPiecesDateDebut]   = useState("");
  const [piecesDateFin, setPiecesDateFin]       = useState("");
  const [piecesSuppLoading, setPiecesSuppLoading] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setPiecesSearchDebounced(piecesSearch); setPiecesPage(1); }, 400);
    return () => clearTimeout(t);
  }, [piecesSearch]);

  const piecesAllUrl = useMemo(() => {
    const p = new URLSearchParams({ all: "1", page: String(piecesPage), limit: "20" });
    if (piecesSearchDebounced) p.set("search",     piecesSearchDebounced);
    if (piecesSourceType)      p.set("sourceType", piecesSourceType);
    if (piecesDateDebut)       p.set("dateDebut",  piecesDateDebut);
    if (piecesDateFin)         p.set("dateFin",    piecesDateFin);
    return `/api/comptable/pieces?${p.toString()}`;
  }, [piecesPage, piecesSearchDebounced, piecesSourceType, piecesDateDebut, piecesDateFin]);

  const { data: piecesAllData, loading: piecesAllLoading, refetch: refetchPiecesAll } =
    useApi<PiecesAllResponse>(piecesAllUrl);

  async function supprimerPiece(pieceId: number) {
    setPiecesSuppLoading(pieceId);
    try {
      await fetch(`/api/comptable/pieces/${pieceId}`, { method: "DELETE" });
      refetchPiecesAll();
    } finally {
      setPiecesSuppLoading(null);
    }
  }

  return (
    <main className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">Saisie comptable — Pièces justificatives</h1>
        {AIDE_COMPTABLE.pieces && <AideComptable contenu={AIDE_COMPTABLE.pieces} />}
      </div>

      <div className="space-y-5">
        {/* En-tête + filtres */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Paperclip size={20} className="text-violet-600" />Archive des Pièces Justificatives
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Tous les documents attachés aux écritures — archivage 10 ans</p>
            </div>
            {piecesAllData && (
              <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                {piecesAllData.meta.total} document{piecesAllData.meta.total > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input type="text" placeholder="Rechercher un fichier…" value={piecesSearch}
                onChange={(e) => setPiecesSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50" />
            </div>

            <select value={piecesSourceType} onChange={(e) => { setPiecesSourceType(e.target.value); setPiecesPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500">
              <option value="">Toutes sources</option>
              {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <input type="date" value={piecesDateDebut} onChange={(e) => { setPiecesDateDebut(e.target.value); setPiecesPage(1); }}
              className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <div className="flex gap-2">
              <input type="date" value={piecesDateFin} onChange={(e) => { setPiecesDateFin(e.target.value); setPiecesPage(1); }}
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              {(piecesSearch || piecesSourceType || piecesDateDebut || piecesDateFin) && (
                <button onClick={() => { setPiecesSearch(""); setPiecesSearchDebounced(""); setPiecesSourceType(""); setPiecesDateDebut(""); setPiecesDateFin(""); setPiecesPage(1); }}
                  className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {piecesAllLoading ? (
            <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date dépôt</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fichier</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Taille</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Déposé par</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Archive jusqu&apos;au</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(piecesAllData?.data ?? []).map((piece) => (
                    <tr key={piece.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-sm text-slate-500 whitespace-nowrap">{formatDateShort(piece.createdAt)}</td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800 truncate max-w-xs" title={piece.nom}>{piece.nom}</p>
                        {piece.description && <p className="text-xs text-slate-400 truncate">{piece.description}</p>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded-full font-semibold">
                          {SOURCE_TYPE_LABELS[piece.sourceType] ?? piece.sourceType}
                        </span>
                        <p className="text-xs text-slate-400 mt-0.5">#{piece.sourceId}</p>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {piece.type.includes("pdf") ? "📄 PDF" : piece.type.includes("image") ? "🖼️ Image" : piece.type}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatTaille(piece.taille)}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{piece.uploadeUser.prenom} {piece.uploadeUser.nom}</td>
                      <td className="px-5 py-3 text-xs text-slate-400">{formatDateShort(piece.archiverJusquau)}</td>
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <a href={piece.url} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Télécharger">
                            <ExternalLink size={15} />
                          </a>
                          <button onClick={() => supprimerPiece(piece.id)}
                            disabled={piecesSuppLoading === piece.id}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40" title="Supprimer">
                            {piecesSuppLoading === piece.id
                              ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                              : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(piecesAllData?.data ?? []).length === 0 && !piecesAllLoading && (
                    <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">Aucune pièce justificative trouvée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {piecesAllData && piecesAllData.meta.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-500">Page <b>{piecesAllData.meta.page}</b> / <b>{piecesAllData.meta.totalPages}</b></p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPiecesPage((p) => Math.max(1, p - 1))} disabled={piecesPage <= 1}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold">{piecesPage}</span>
                <button onClick={() => setPiecesPage((p) => Math.min(piecesAllData.meta.totalPages, p + 1))} disabled={piecesPage >= piecesAllData.meta.totalPages}
                  className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
