"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import NouvelleCommandeClient from "@/components/agent-documents/NouvelleCommandeClient";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Plus, X, RefreshCw, FileText, Search, PackageCheck, AlertTriangle, Copy } from "lucide-react";

interface PersonRef { id: number; nom: string; prenom: string }
interface ClientRef { id: number; nom: string; prenom: string; telephone: string; adresse: string | null }
interface Ligne { id: number; produitId: number; quantite: number; prixUnitaire: number | string; remisePourcent: number | string; remiseMontant: number | string; totalLigne: number | string; produit: { id: number; nom: string; codeProduit: string | null }; stockDisponible?: number; ruptureSignalee?: boolean }
interface Commande {
  id: number; reference: string; statut: string;
  pointDeVente: { id: number; nom: string; code: string };
  client: ClientRef;
  typeClientCommande: string; modeReglement: string;
  totalHT: number | string; totalRemise: number | string; totalTVA: number | string; totalTTC: number | string;
  signatureClientNom: string;
  visaResponsablePar: PersonRef | null; motifRejet: string | null;
  bonSortie: { id: number; reference: string; statut: string } | null;
  bonPreparation: { id: number; reference: string; statut: string } | null;
  bonLivraison: { id: number; reference: string } | null;
  bonReception: { id: number; reference: string; statut: string; etatMarchandise: string | null; reserve: string | null; tokenConfirmation: string; signatureClientNom: string | null; dateSignatureClient: string | null } | null;
  lignes: Ligne[];
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMISE: { label: "Soumise", badge: "bg-blue-100 text-blue-700" },
  EN_VALIDATION: { label: "En attente de visa", badge: "bg-amber-100 text-amber-700" },
  VALIDEE: { label: "Validée", badge: "bg-cyan-100 text-cyan-700" },
  EN_PREPARATION: { label: "En préparation", badge: "bg-indigo-100 text-indigo-700" },
  LIVREE: { label: "Livrée", badge: "bg-emerald-100 text-emerald-700" },
  CLOTUREE: { label: "Clôturée", badge: "bg-slate-200 text-slate-700" },
  REJETEE: { label: "Rejetée", badge: "bg-red-100 text-red-700" },
  ANNULEE: { label: "Annulée", badge: "bg-red-100 text-red-600" },
};

export default function CommandesClientPage() {
  return (
    <Suspense fallback={null}>
      <CommandesClientPageInner />
    </Suspense>
  );
}

function CommandesClientPageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (searchParams.get("nouveau")) setShowCreate(true);
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const gRole = useSession().data?.user?.gestionnaireRole;
  const { data, loading, refetch } = useApi<{ data: Commande[]; stats: Record<string, number> }>(`/api/ventes/commandes-client?${params}`);
  const commandes = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href={gRole === "MAGAZINIER" ? "/dashboard/user/magasiniers" : "/dashboard/user/agentsTerrain"} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-emerald-600" /> Bons de commande client
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Prise de commande terrain, jusqu&apos;à la préparation magasin</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle commande
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statutFilter === k ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"}`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : commandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucune commande</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {commandes.map((c) => {
              const cfg = STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE;
              return (
                <div key={c.id} onClick={() => setDetailId(c.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{c.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{c.client.prenom} {c.client.nom} · {c.client.telephone}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(c.totalTTC).toLocaleString("fr-FR")} FCFA</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <NouvelleCommandeClient onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Commande }>(`/api/ventes/commandes-client/${id}`);
  const [busy, setBusy] = useState(false);
  const c = data?.data;

  const doAction = async (action: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/ventes/commandes-client/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); } else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{c?.reference ?? "Chargement…"}</h2>
          <div className="flex items-center gap-1">
            {c && <a href={`/api/ventes/commandes-client/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading || !c ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE).badge}`}>{(STATUT_CFG[c.statut] ?? STATUT_CFG.SOUMISE).label}</span>
              <p className="text-sm text-slate-600">{c.client.prenom} {c.client.nom} — {c.client.telephone}</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {c.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">{l.produit.nom}{l.ruptureSignalee && <span className="ml-2 text-xs text-red-600 flex items-center gap-1 inline-flex"><Search className="w-3 h-3" /> rupture partielle</span>}</td>
                        <td className="text-center px-3 py-2">× {l.quantite}</td>
                        <td className="text-right px-3 py-2 font-medium">{Number(l.totalLigne).toLocaleString("fr-FR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-sm font-bold text-slate-800">Total TTC : {Number(c.totalTTC).toLocaleString("fr-FR")} FCFA</p>
              {c.visaResponsablePar && <p className="text-sm text-amber-700">Visa RVC : {c.visaResponsablePar.prenom} {c.visaResponsablePar.nom}</p>}
              {c.motifRejet && <p className="text-sm text-red-600">Motif de rejet : {c.motifRejet}</p>}
              {c.bonSortie && (
                <p className="text-sm text-slate-600">Bon de sortie : {c.bonSortie.reference} ({c.bonSortie.statut}){" "}
                  <a href={`/api/magasinier/bons-sortie/${c.bonSortie.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline">télécharger</a>
                  {" · "}<a href={`/api/ventes/commandes-client/${c.id}/facture/pdf`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline">facture</a>
                </p>
              )}
              {c.bonPreparation && (
                <p className="text-sm text-slate-600">
                  Bon de préparation : {c.bonPreparation.reference} ({c.bonPreparation.statut === "PRETE" ? "Prête" : "En cours"})
                  {" — "}
                  <a href={`/api/magasinier/bons-preparation/${c.bonPreparation.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline">voir</a>
                </p>
              )}
              {c.bonLivraison && (
                <p className="text-sm text-slate-600">
                  Bon de livraison : {c.bonLivraison.reference}
                  {" — "}
                  <a href={`/api/bons-livraison/${c.bonLivraison.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline">voir</a>
                </p>
              )}
              {c.bonReception && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bon de réception</p>
                  {c.bonReception.statut === "EN_ATTENTE_SIGNATURE" ? (
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <span className="text-sm text-slate-500">En attente de la signature du client</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/livraison/${c.bonReception!.tokenConfirmation}`); toast.success("Lien copié"); }}
                        title="Copier le lien de confirmation" className="ml-auto p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : c.bonReception.statut === "LITIGE" ? (
                    <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Réserve : {c.bonReception.reserve}</p>
                  ) : (
                    <p className="text-sm text-emerald-700 flex items-center gap-1"><PackageCheck className="w-4 h-4" /> Signé par {c.bonReception.signatureClientNom}</p>
                  )}
                  <a href={`/api/bons-reception/${c.bonReception.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-slate-600 underline">Voir l&apos;accusé</a>
                </div>
              )}
            </>
          )}
        </div>
        {c && ["SOUMISE", "EN_VALIDATION"].includes(c.statut) && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
            <button onClick={() => doAction("ANNULER")} disabled={busy} className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Annuler</button>
          </div>
        )}
        {c && c.statut === "LIVREE" && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
            <button onClick={() => doAction("CLOTURER")} disabled={busy} className="px-3 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">Clôturer</button>
          </div>
        )}
      </div>
    </div>
  );
}
