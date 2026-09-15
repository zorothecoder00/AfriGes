"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Plus, X, RefreshCw, Send, FileText, Trash2, Search } from "lucide-react";

interface PersonRef { id: number; nom: string; prenom: string }
interface ClientRef { id: number; nom: string; prenom: string; telephone: string; adresse: string | null }
interface ProduitRef { id: number; nom: string; reference: string | null; prixUnitaire: number | string }
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

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

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
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Commande[]; stats: Record<string, number> }>(`/api/ventes/commandes-client?${params}`);
  const commandes = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/agentsTerrain" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
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

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [clientSearch, setClientSearch] = useState("");
  const [client, setClient] = useState<ClientRef | null>(null);
  const [typeClientCommande, setTypeClientCommande] = useState<"PARTICULIER" | "REVENDEUR">("PARTICULIER");
  const [modeReglement, setModeReglement] = useState<"COMPTANT" | "MOBILE_MONEY" | "CREDIT">("COMPTANT");
  const [dateLivraisonSouhaitee, setDateLivraisonSouhaitee] = useState("");
  const [lieuLivraison, setLieuLivraison] = useState("");
  const [lignes, setLignes] = useState<{ produitId: number | null; produitNom: string; quantite: string; remisePourcent: string }[]>([{ produitId: null, produitNom: "", quantite: "", remisePourcent: "0" }]);
  const [produitSearch, setProduitSearch] = useState("");
  const [ligneEnRecherche, setLigneEnRecherche] = useState<number | null>(null);
  const [signatureClientNom, setSignatureClientNom] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clientsData } = useApi<{ data: ClientRef[] }>(clientSearch.length >= 2 ? `/api/agentTerrain/clients?search=${encodeURIComponent(clientSearch)}&limit=8` : null);
  const { data: produitsData } = useApi<{ data: ProduitRef[] }>(produitSearch.length >= 2 ? `/api/agentTerrain/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null);
  const clients = clientsData?.data ?? [];
  const produits = produitsData?.data ?? [];

  const updateLigne = (idx: number, patch: Partial<(typeof lignes)[number]>) => setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLigne = () => setLignes((prev) => [...prev, { produitId: null, produitNom: "", quantite: "", remisePourcent: "0" }]);
  const removeLigne = (idx: number) => setLignes((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!client) { toast.error("Sélectionnez un client"); return; }
    if (!signatureClientNom.trim()) { toast.error("Signature électronique du client obligatoire"); return; }
    const lignesValides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0);
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins une ligne valide"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/ventes/commandes-client", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id, typeClientCommande, modeReglement,
          dateLivraisonSouhaitee: dateLivraisonSouhaitee || undefined, lieuLivraison: lieuLivraison || undefined,
          lignes: lignesValides.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite), remisePourcent: Number(l.remisePourcent) || 0 })),
          signatureClientNom, notes: notes || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Commande soumise"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle commande client</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="text-xs text-slate-500">Client (recherche par téléphone ou nom)</label>
            {client ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{client.prenom} {client.nom} — {client.telephone}</span>
                <button onClick={() => { setClient(null); setClientSearch(""); }} className="text-emerald-700 hover:text-emerald-900"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Téléphone ou nom…" className={inputCls} />
                {clients.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-40 overflow-y-auto">
                    {clients.map((c) => (
                      <button key={c.id} onClick={() => setClient(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.prenom} {c.nom} — {c.telephone}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Type de client</label>
              <select value={typeClientCommande} onChange={(e) => setTypeClientCommande(e.target.value as typeof typeClientCommande)} className={inputCls}>
                <option value="PARTICULIER">Particulier</option>
                <option value="REVENDEUR">Revendeur</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Mode de règlement</label>
              <select value={modeReglement} onChange={(e) => setModeReglement(e.target.value as typeof modeReglement)} className={inputCls}>
                <option value="COMPTANT">Comptant</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CREDIT">À crédit</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Date de livraison souhaitée</label>
              <input type="date" value={dateLivraisonSouhaitee} onChange={(e) => setDateLivraisonSouhaitee(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Lieu de livraison</label>
              <input value={lieuLivraison} onChange={(e) => setLieuLivraison(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-500">Produits</label>
              <button onClick={addLigne} className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
            </div>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 relative">
                    <input
                      value={ligneEnRecherche === i ? produitSearch : l.produitNom}
                      onChange={(e) => { setProduitSearch(e.target.value); updateLigne(i, { produitNom: e.target.value, produitId: null }); setLigneEnRecherche(i); }}
                      onFocus={() => setLigneEnRecherche(i)}
                      placeholder="Rechercher un produit…" className={inputCls}
                    />
                    {ligneEnRecherche === i && produits.length > 0 && !l.produitId && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {produits.map((p) => (
                          <button key={p.id} onClick={() => { updateLigne(i, { produitId: p.id, produitNom: p.nom }); setLigneEnRecherche(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex justify-between">
                            <span>{p.nom}</span><span className="text-slate-400">{Number(p.prixUnitaire).toLocaleString("fr-FR")}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" min="1" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })} placeholder="Qté" className="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  <input type="number" min="0" max="100" value={l.remisePourcent} onChange={(e) => updateLigne(i, { remisePourcent: e.target.value })} placeholder="Remise %" className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  {lignes.length > 1 && <button onClick={() => removeLigne(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Signature électronique du client (vaut engagement d&apos;achat)</label>
            <input value={signatureClientNom} onChange={(e) => setSignatureClientNom(e.target.value)} placeholder="Nom et prénom du client" className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Send className="w-4 h-4" /> Soumettre
          </button>
        </div>
      </div>
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
              {c.bonSortie && <p className="text-sm text-slate-600">Bon de sortie : {c.bonSortie.reference} ({c.bonSortie.statut})</p>}
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
