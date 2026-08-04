"use client";

import { useState, useRef, useCallback } from "react";
import {
  Building2, RefreshCw, PlusCircle, Save, FileText, Trash2, X,
  ChevronLeft, ChevronRight, Paperclip, Upload, ExternalLink,
} from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { useT } from "@/contexts/AppSettingsContext";
import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import AideComptable from "@/components/AideComptable";
import { AIDE_COMPTABLE } from "@/lib/aideComptableContenu";

const UploadButton = generateUploadButton<OurFileRouter>();

// ── Types ──────────────────────────────────────────────────────────────────

interface ImmobilisationEntry {
  id: number;
  numeroInventaire: string;
  designation: string;
  categorie: string;
  statut: string;
  coutAcquisition: number;
  amortissementCumule: number;
  valeurNetteComptable: number;
  dateAcquisition: string;
  dateMiseEnService: string;
  dureeAnnees: number;
  compte: { numero: string; libelle: string };
  fournisseur?: { nom: string } | null;
  responsable?: { nom: string; prenom: string } | null;
}
interface ImmobilisationsResponse {
  data: ImmobilisationEntry[];
  meta: { total: number; page: number; limit: number; totalPages: number };
  totaux: { coutAcquisition: number; amortissementCumule: number; valeurNetteComptable: number };
}
interface ImmoDetail extends ImmobilisationEntry {
  lignesAmortissement: { id: number; periode: string; montantDotation: number; cumulApres: number; vncApres: number }[];
}
interface PieceEntry {
  id: number; nom: string; url: string; uploadthingKey: string; type: string; taille: number;
  nature: string; createdAt: string; uploadeUser: { nom: string; prenom: string };
}
interface PiecesResponse { success: boolean; data: PieceEntry[] }

const NATURE_DOCUMENT_LABELS: Record<string, string> = {
  FACTURE: "Facture", RECU: "Reçu", BON_COMMANDE: "Bon de commande",
  BON_LIVRAISON: "Bon de livraison", CONTRAT: "Contrat", RELEVE_BANCAIRE: "Relevé bancaire",
  PIECE_CAISSE: "Pièce de caisse", DOCUMENT_FISCAL: "Document fiscal", AUTRE: "Autre",
};

function formatTaille(octets: number): string {
  if (octets >= 1024 * 1024) return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
  if (octets >= 1024)        return `${Math.round(octets / 1024)} Ko`;
  return `${octets} o`;
}

const CATEGORIE_LABELS: Record<string, string> = {
  TERRAIN: "Terrain", BATIMENT: "Bâtiment", MATERIEL_MOBILIER: "Matériel et mobilier",
  MATERIEL_TRANSPORT: "Matériel de transport", MATERIEL_INFORMATIQUE: "Matériel informatique", AUTRE: "Autre",
};

const STATUT_IMMO_COLORS: Record<string, string> = {
  EN_SERVICE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  AMORTIE: "bg-slate-100 text-slate-600 border-slate-200",
  CEDEE: "bg-red-50 text-red-600 border-red-200",
  HORS_SERVICE: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function ImmobilisationsPage() {
  const t = useT();

  // ── État Immobilisations ──────────────────────────────────────────────
  const IMMO_VIDE = {
    designation: "", categorie: "MATERIEL_MOBILIER", dateAcquisition: "", dateMiseEnService: "",
    coutAcquisition: "", valeurResiduelle: "0", dureeAnnees: "5", localisation: "", numeroSerie: "", notes: "",
  };
  const [immoPage, setImmoPage]         = useState(1);
  const [showAddImmo, setShowAddImmo]   = useState(false);
  const [newImmo, setNewImmo]           = useState(IMMO_VIDE);
  const [immoDetailId, setImmoDetailId] = useState<number | null>(null);

  // ── Immobilisations API ────────────────────────────────────────────────
  const { data: immoData, loading: immoLoading, refetch: refetchImmo } =
    useApi<ImmobilisationsResponse>(`/api/comptable/immobilisations?page=${immoPage}&limit=20`);

  const { mutate: creerImmo, loading: creatingImmo } = useMutation<unknown, object>(
    "/api/comptable/immobilisations", "POST",
    { successMessage: "Immobilisation créée" }
  );
  const immoActionIdRef = useRef<number | null>(null);
  const { mutate: amortirImmo, loading: amortissantImmo } = useMutation<{ data?: { montant: number } }, object>(
    () => `/api/comptable/immobilisations/${immoActionIdRef.current}/amortir`, "POST",
  );
  const { mutate: cederImmo } = useMutation<unknown, object>(
    () => `/api/comptable/immobilisations/${immoActionIdRef.current}/ceder`, "POST",
    { successMessage: "Immobilisation cédée" }
  );
  const { mutate: genererDotationsMois, loading: generantDotations } = useMutation<{ message: string }, object>(
    "/api/comptable/immobilisations/dotations", "POST",
  );

  async function handleCreerImmo() {
    const res = await creerImmo({ ...newImmo, coutAcquisition: Number(newImmo.coutAcquisition), valeurResiduelle: Number(newImmo.valeurResiduelle), dureeAnnees: Number(newImmo.dureeAnnees) });
    if (res) { refetchImmo(); setShowAddImmo(false); setNewImmo(IMMO_VIDE); }
  }
  async function handleAmortirImmo(id: number) {
    immoActionIdRef.current = id;
    const res = await amortirImmo({});
    if (res) refetchImmo();
  }
  async function handleCederImmo(id: number) {
    if (!confirm("Confirmer la sortie de cette immobilisation du patrimoine ?")) return;
    immoActionIdRef.current = id;
    const res = await cederImmo({});
    if (res) refetchImmo();
  }
  async function handleGenererDotationsMois() {
    const res = await genererDotationsMois({});
    if (res) refetchImmo();
  }

  const { data: immoDetailData, loading: immoDetailLoading } =
    useApi<{ data: ImmoDetail }>(immoDetailId ? `/api/comptable/immobilisations/${immoDetailId}` : null);

  // ── Pièces justificatives (CDC §22 — "justificatif" est un champ du registre) ──
  const [piecesModal, setPiecesModal] = useState<{ immoId: number; designation: string } | null>(null);
  const [piecesLocalList, setPiecesLocalList] = useState<PieceEntry[]>([]);
  const [piecesLoading, setPiecesLoading] = useState(false);
  const [piecesSuppLoading, setPiecesSuppLoading] = useState<number | null>(null);
  const [pieceNatureChoisie, setPieceNatureChoisie] = useState("AUTRE");

  const fetchPiecesModal = useCallback(async (immoId: number) => {
    setPiecesLoading(true);
    try {
      const res = await fetch(`/api/comptable/pieces?sourceType=IMMOBILISATION&sourceId=${immoId}`);
      const json: PiecesResponse = await res.json();
      setPiecesLocalList(json.data ?? []);
    } catch {
      setPiecesLocalList([]);
    } finally {
      setPiecesLoading(false);
    }
  }, []);

  function openPiecesModal(immoId: number, designation: string) {
    setPiecesModal({ immoId, designation });
    fetchPiecesModal(immoId);
  }

  async function supprimerPiece(pieceId: number) {
    setPiecesSuppLoading(pieceId);
    try {
      await fetch(`/api/comptable/pieces/${pieceId}`, { method: "DELETE" });
      setPiecesLocalList((prev) => prev.filter((p) => p.id !== pieceId));
    } finally {
      setPiecesSuppLoading(null);
    }
  }

  return (
    <>
    <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-violet-600" size={22} /> Immobilisations
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {AIDE_COMPTABLE["immobilisations"] && <AideComptable contenu={AIDE_COMPTABLE["immobilisations"]} />}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="text-violet-600" size={20} /> Immobilisations
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {immoData?.meta.total ?? "…"} immobilisations · Coût {formatCurrency(immoData?.totaux.coutAcquisition ?? 0)} ·
              {" "}VNC {formatCurrency(immoData?.totaux.valeurNetteComptable ?? 0)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleGenererDotationsMois} disabled={generantDotations}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {generantDotations ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RefreshCw size={15} />}
              Générer les dotations du mois
            </button>
            <button onClick={() => setShowAddImmo(!showAddImmo)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
              <PlusCircle size={15} /> Nouvelle immobilisation
            </button>
          </div>
        </div>

        {showAddImmo && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
            <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle size={16} className="text-violet-600" /> Nouvelle immobilisation</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">Désignation *</label>
                <input value={newImmo.designation} onChange={(e) => setNewImmo(p => ({ ...p, designation: e.target.value }))}
                  placeholder="ex: Véhicule de livraison Toyota" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Catégorie *</label>
                <select value={newImmo.categorie} onChange={(e) => setNewImmo(p => ({ ...p, categorie: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  {Object.entries(CATEGORIE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date d&apos;acquisition *</label>
                <input type="date" value={newImmo.dateAcquisition} onChange={(e) => setNewImmo(p => ({ ...p, dateAcquisition: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Date de mise en service *</label>
                <input type="date" value={newImmo.dateMiseEnService} onChange={(e) => setNewImmo(p => ({ ...p, dateMiseEnService: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Coût d&apos;acquisition *</label>
                <input type="number" value={newImmo.coutAcquisition} onChange={(e) => setNewImmo(p => ({ ...p, coutAcquisition: e.target.value }))}
                  placeholder="ex: 5000000" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Valeur résiduelle</label>
                <input type="number" value={newImmo.valeurResiduelle} onChange={(e) => setNewImmo(p => ({ ...p, valeurResiduelle: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Durée (années) *</label>
                <input type="number" value={newImmo.dureeAnnees} onChange={(e) => setNewImmo(p => ({ ...p, dureeAnnees: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 [appearance:textfield]" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Localisation</label>
                <input value={newImmo.localisation} onChange={(e) => setNewImmo(p => ({ ...p, localisation: e.target.value }))}
                  placeholder="ex: Agence Lomé" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">N° de série</label>
                <input value={newImmo.numeroSerie} onChange={(e) => setNewImmo(p => ({ ...p, numeroSerie: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAddImmo(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">{t('btn_cancel')}</button>
              <button onClick={handleCreerImmo}
                disabled={creatingImmo || !newImmo.designation || !newImmo.dateAcquisition || !newImmo.dateMiseEnService || !newImmo.coutAcquisition}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {creatingImmo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={15} />} Créer
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          {immoLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Inventaire</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Désignation</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden md:table-cell">Catégorie</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Coût</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase hidden lg:table-cell">Amort. cumulé</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">VNC</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(immoData?.data ?? []).map((immo) => (
                  <tr key={immo.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-violet-700">{immo.numeroInventaire}</td>
                    <td className="px-4 py-3 text-slate-800">{immo.designation}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{CATEGORIE_LABELS[immo.categorie] ?? immo.categorie}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCurrency(Number(immo.coutAcquisition))}</td>
                    <td className="px-4 py-3 text-right text-amber-700 hidden lg:table-cell">{formatCurrency(Number(immo.amortissementCumule))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(Number(immo.valeurNetteComptable))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUT_IMMO_COLORS[immo.statut] ?? "bg-slate-100 text-slate-600"}`}>{immo.statut}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setImmoDetailId(immoDetailId === immo.id ? null : immo.id)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Détail"><FileText size={14} /></button>
                        <button onClick={() => openPiecesModal(immo.id, immo.designation)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg" title="Pièces justificatives"><Paperclip size={14} /></button>
                        {immo.statut === "EN_SERVICE" && (
                          <>
                            <button onClick={() => handleAmortirImmo(immo.id)} disabled={amortissantImmo}
                              className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                              Amortir
                            </button>
                            <button onClick={() => handleCederImmo(immo.id)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Céder / sortir"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(immoData?.data ?? []).length === 0 && !immoLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                      <p>Aucune immobilisation enregistrée.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {immoData && immoData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
              <span className="text-xs text-slate-500">{immoData.meta.total} immobilisations · page {immoPage}/{immoData.meta.totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setImmoPage(p => Math.max(1, p - 1))} disabled={immoPage === 1}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                <button onClick={() => setImmoPage(p => Math.min(immoData.meta.totalPages, p + 1))} disabled={immoPage === immoData.meta.totalPages}
                  className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {immoDetailId && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-violet-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileText size={16} className="text-violet-600" /> Historique des dotations
              </h4>
              <button onClick={() => setImmoDetailId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={15} /></button>
            </div>
            {immoDetailLoading ? (
              <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
            ) : (immoDetailData?.data.lignesAmortissement ?? []).length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Aucune dotation générée pour le moment.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold text-slate-500">Période</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-slate-500">Dotation</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-amber-600">Cumul après</th>
                    <th className="text-right px-3 py-1.5 font-semibold text-emerald-600">VNC après</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {immoDetailData!.data.lignesAmortissement.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-1.5 font-mono text-slate-700">{l.periode}</td>
                      <td className="px-3 py-1.5 text-right text-slate-700">{formatCurrency(Number(l.montantDotation))}</td>
                      <td className="px-3 py-1.5 text-right text-amber-700">{formatCurrency(Number(l.cumulApres))}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-700">{formatCurrency(Number(l.vncApres))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </main>

    {/* Modal pièces justificatives */}
    {piecesModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <Paperclip size={18} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-sm">Pièces justificatives</h3>
              <p className="text-xs text-slate-400 truncate">{piecesModal.designation}</p>
            </div>
            <button onClick={() => setPiecesModal(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 min-h-0">
            {piecesLoading ? (
              <div className="py-6 text-center"><div className="w-7 h-7 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto" /></div>
            ) : piecesLocalList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                <Paperclip size={32} className="mx-auto mb-2 opacity-30" />
                Aucune pièce jointe pour cette immobilisation
              </div>
            ) : (
              piecesLocalList.map((piece) => (
                <div key={piece.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                    {piece.type.includes("pdf") ? "📄" : piece.type.includes("image") ? "🖼️" : "📎"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{piece.nom}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded-full font-medium">{NATURE_DOCUMENT_LABELS[piece.nature] ?? piece.nature}</span>
                      {formatTaille(piece.taille)} · {piece.uploadeUser.prenom} {piece.uploadeUser.nom} · {formatDateShort(piece.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={piece.url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Ouvrir">
                      <ExternalLink size={15} />
                    </a>
                    <button onClick={() => supprimerPiece(piece.id)}
                      disabled={piecesSuppLoading === piece.id}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-40" title="Supprimer">
                      {piecesSuppLoading === piece.id
                        ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                        : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Upload size={12} />Ajouter un document (PDF, image ou Excel, max 16 Mo)
            </p>
            <select value={pieceNatureChoisie} onChange={(e) => setPieceNatureChoisie(e.target.value)}
              className="w-full mb-3 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
              {Object.entries(NATURE_DOCUMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <UploadButton
              endpoint="justificatif"
              onClientUploadComplete={async (res) => {
                for (const file of res) {
                  await fetch("/api/comptable/pieces", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({
                      sourceType:     "IMMOBILISATION",
                      sourceId:       piecesModal.immoId,
                      nom:            file.name,
                      url:            file.url,
                      uploadthingKey: file.key,
                      type:           file.type ?? "application/octet-stream",
                      taille:         file.size,
                      nature:         pieceNatureChoisie,
                    }),
                  });
                }
                fetchPiecesModal(piecesModal.immoId);
              }}
              onUploadError={(err) => console.error("Upload error:", err)}
              appearance={{
                button: "bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors",
                allowedContent: "text-slate-400 text-xs mt-1",
              }}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
}
