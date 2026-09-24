"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import NouveauDevisProforma from "@/components/agent-documents/NouveauDevisProforma";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, X, RefreshCw, Copy, CheckCircle2, XCircle, Repeat } from "lucide-react";

interface ClientRef { id: number; nom: string; prenom: string; telephone: string; adresse: string | null }
interface Ligne { id: number; produitId: number; quantite: number; prixUnitaire: number | string; remiseMontant: number | string; totalLigne: number | string; produit: { id: number; nom: string } }
interface Document {
  id: number; reference: string; type: "DEVIS" | "PROFORMA"; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  client: ClientRef;
  dateValidite: string; conditions: string | null;
  totalHT: number | string; totalRemise: number | string; totalTVA: number | string; totalTTC: number | string;
  tokenReponse: string;
  nomSignataireReponse: string | null; motifRefus: string | null;
  devisOrigine: { id: number; reference: string } | null;
  proformaGenere: { id: number; reference: string } | null;
  lignes: Ligne[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-100 text-slate-600" },
  ENVOYE: { label: "Envoyé", badge: "bg-blue-100 text-blue-700" },
  ACCEPTE: { label: "Accepté", badge: "bg-emerald-100 text-emerald-700" },
  REFUSE: { label: "Refusé", badge: "bg-red-100 text-red-700" },
  EXPIRE: { label: "Expiré", badge: "bg-slate-200 text-slate-500" },
};

export default function DevisProformaPage() {
  return (
    <Suspense fallback={null}>
      <DevisProformaPageInner />
    </Suspense>
  );
}

function DevisProformaPageInner() {
  const searchParams = useSearchParams();
  const [typeFilter, setTypeFilter] = useState<"" | "DEVIS" | "PROFORMA">("");
  const [statutFilter, setStatutFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [typeInitial, setTypeInitial] = useState<"DEVIS" | "PROFORMA">("DEVIS");
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    const nouveau = searchParams.get("nouveau");
    if (nouveau) { setTypeInitial(nouveau === "PROFORMA" ? "PROFORMA" : "DEVIS"); setShowCreate(true); }
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  if (typeFilter) params.set("type", typeFilter);
  const { data, loading, refetch } = useApi<{ data: Document[]; stats: Record<string, number> }>(`/api/ventes/devis-proforma?${params}`);
  const documents = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/agentsTerrain" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" /> Devis &amp; Proforma
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Propositions commerciales avant commande ferme</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {(["", "DEVIS", "PROFORMA"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${typeFilter === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}>
              {t === "" ? "Tous types" : t === "DEVIS" ? "Devis" : "Proforma"}
            </button>
          ))}
          <span className="text-slate-300">|</span>
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statutFilter === k ? "ring-1 ring-indigo-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"}`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucun document</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {documents.map((d) => {
              const cfg = STATUT_CFG[d.statut] ?? STATUT_CFG.BROUILLON;
              return (
                <div key={d.id} onClick={() => setDetailId(d.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{d.reference}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">{d.type === "PROFORMA" ? "Proforma" : "Devis"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{d.client.prenom} {d.client.nom} · {d.client.telephone}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(d.totalTTC).toLocaleString("fr-FR")} FCFA</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <NouveauDevisProforma typeInitial={typeInitial} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Document }>(`/api/ventes/devis-proforma/${id}`);
  const [busy, setBusy] = useState(false);
  const d = data?.data;

  const doAction = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/ventes/devis-proforma/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        toast.success("Mis à jour");
        if (action === "ENVOYER" && j.lien) { navigator.clipboard.writeText(j.lien); toast.success("Lien copié — à transmettre au client"); }
        refetch(); onUpdated();
      } else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{d?.reference ?? "Chargement…"}</h2>
          <div className="flex items-center gap-1">
            {d && <a href={`/api/ventes/devis-proforma/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading || !d ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">{d.type === "PROFORMA" ? "Proforma" : "Devis"}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[d.statut] ?? STATUT_CFG.BROUILLON).badge}`}>{(STATUT_CFG[d.statut] ?? STATUT_CFG.BROUILLON).label}</span>
              </div>
              <p className="text-sm text-slate-600">{d.client.prenom} {d.client.nom} — {d.client.telephone}</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {d.lignes.map((l) => (
                      <tr key={l.id}><td className="px-3 py-2">{l.produit.nom}</td><td className="text-center px-3 py-2">× {l.quantite}</td><td className="text-right px-3 py-2 font-medium">{Number(l.totalLigne).toLocaleString("fr-FR")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-sm font-bold text-slate-800">Total TTC : {Number(d.totalTTC).toLocaleString("fr-FR")} FCFA</p>
              {d.devisOrigine && <p className="text-xs text-slate-400">Issu du devis {d.devisOrigine.reference}</p>}
              {d.proformaGenere && <p className="text-xs text-slate-400">Converti en proforma {d.proformaGenere.reference}</p>}
              {d.nomSignataireReponse && <p className="text-sm text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Accepté par {d.nomSignataireReponse}</p>}
              {d.motifRefus && <p className="text-sm text-red-600 flex items-center gap-1"><XCircle className="w-4 h-4" /> {d.motifRefus}</p>}
            </>
          )}
        </div>
        {d && (
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-slate-200">
            {d.statut === "BROUILLON" && (
              <button onClick={() => doAction("ENVOYER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"><Copy className="w-4 h-4" /> Envoyer (copier le lien)</button>
            )}
            {["BROUILLON", "ENVOYE"].includes(d.statut) && (
              <button onClick={() => doAction("ANNULER")} disabled={busy} className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Annuler</button>
            )}
            {d.type === "DEVIS" && d.statut === "ACCEPTE" && !d.proformaGenere && (
              <button onClick={() => doAction("CONVERTIR_PROFORMA")} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"><Repeat className="w-4 h-4" /> Convertir en proforma</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
