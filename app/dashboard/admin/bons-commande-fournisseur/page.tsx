"use client";

import SortieCaissePicker from "@/components/SortieCaissePicker";
import type { OperationCaisseDispo } from "@/components/FicheDecaissementModal";
import { Suspense, useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, Printer, X, Loader2, CheckCircle2, Ban, Send, Stamp, PenLine, Search, Wallet, RefreshCw} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useFocusDetail } from "@/hooks/useFocusDetail";
import { formatCurrency, formatDate } from "@/lib/format";

/** Bon de commande fournisseur (CDC digitalisation §3.3) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface FournisseurOption { id: number; nom: string; code: string; email?: string | null }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface LigneBC { id: number; quantite: number; prixUnitaire: string; produit: { id: number; nom: string; codeProduit: string | null } }
interface BonCommandeRow {
  id: number; reference: string; statut: string; devise: string | null;
  montantTotal: string; montantPaye: string; dateCommande: string; dateLivraisonPrevue: string | null; notes: string | null;
  fournisseur: FournisseurOption; pointDeVente: PDV;
  signeParId?: number | null; visaCGTParId?: number | null;
  signePar: { id: number; nom: string; prenom: string } | null;
  visaCGTPar: { id: number; nom: string; prenom: string } | null;
  lignes: LigneBC[];
  receptions: { id: number; reference: string; statut: string }[];
}
interface BonsResponse { data: BonCommandeRow[]; stats: Record<string, number>; seuilVisaCGT: number }

const STATUT_LABEL: Record<string, string> = {
  DRAFT: "Brouillon", PENDING_APPROVAL: "En attente d'approbation", APPROVED: "Approuvé", SENT: "Envoyé",
  ACKNOWLEDGED: "Accusé de réception", PARTIALLY_DELIVERED: "Partiellement livré", COMPLETED: "Terminé", CANCELLED: "Annulé",
};
const STATUT_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600", PENDING_APPROVAL: "bg-amber-100 text-amber-700", APPROVED: "bg-blue-100 text-blue-700",
  SENT: "bg-indigo-100 text-indigo-700", ACKNOWLEDGED: "bg-cyan-100 text-cyan-700", PARTIALLY_DELIVERED: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700", CANCELLED: "bg-red-100 text-red-600",
};

export default function AdminBonsCommandeFournisseurPage() {
  return <Suspense fallback={null}><BonsCommandeContenu /></Suspense>;
}

function BonsCommandeContenu() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [paiementBon, setPaiementBon] = useState<BonCommandeRow | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<BonsResponse>(`/api/logistique/bons-commande?${params}`);
  const bons = data?.data ?? [];
  const focusId = useFocusDetail(!loading);
  const seuil = data?.seuilVisaCGT ?? Infinity;

  async function action(id: number, body: Record<string, unknown>, successMsg = "Bon de commande mis à jour") {
    try {
      const res = await fetch(`/api/logistique/bons-commande/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function envoyer(id: number) {
    try {
      const res = await fetch(`/api/logistique/bons-commande/${id}/envoyer`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(j.emailEnvoye ? "Bon envoyé par email au fournisseur" : "Bon marqué envoyé (pas d'email fournisseur)");
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bons de commande fournisseur</h1>
          <p className="text-sm text-slate-500 mt-1">Commandes AfriSime → fournisseur</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" icon={<RefreshCw size={16} />} title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouveau bon de commande</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l} {data?.stats?.[k] ? `(${data.stats[k]})` : ""}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && bons.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && bons.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun bon de commande sur ce filtre.</p>}
        {bons.map((b) => {
          const montant = Number(b.montantTotal);
          const soldeDu = montant - Number(b.montantPaye);
          const visaRequis = montant > seuil;
          return (
            <div key={b.id} id={`doc-${b.id}`} className={focusId === b.id ? "rounded-2xl ring-2 ring-primary-400" : ""}>
            <Card>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{b.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[b.statut]}`}>{STATUT_LABEL[b.statut]}</span>
                    {visaRequis && !b.visaCGTParId && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Visa CGT requis</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{b.fournisseur.nom} — {b.pointDeVente.nom} ({b.pointDeVente.code})</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {b.lignes.length} ligne(s) · {formatCurrency(montant)} {b.devise} · dû {formatCurrency(soldeDu)} · commandé le {formatDate(b.dateCommande)}
                    {b.dateLivraisonPrevue && ` · livraison prévue le ${formatDate(b.dateLivraisonPrevue)}`}
                  </p>
                  {b.receptions.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">Réceptions : {b.receptions.map((r) => r.reference).join(", ")}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {b.statut === "DRAFT" && (
                    <button onClick={() => action(b.id, { action: "SOUMETTRE" }, "Soumis pour approbation")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"><Send size={13} /> Soumettre</button>
                  )}
                  {b.statut === "PENDING_APPROVAL" && (
                    <>
                      <button onClick={() => action(b.id, { action: "APPROUVER" }, "Approuvé")}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><CheckCircle2 size={13} /> Approuver</button>
                      <button onClick={() => action(b.id, { action: "REJETER" }, "Renvoyé en brouillon")}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Rejeter</button>
                    </>
                  )}
                  {b.statut === "APPROVED" && (
                    <>
                      {!b.signeParId && (
                        <button onClick={() => action(b.id, { action: "SIGNER" }, "Signé")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"><PenLine size={13} /> Signer</button>
                      )}
                      {visaRequis && !b.visaCGTParId && (
                        <button onClick={() => action(b.id, { action: "VISER_CGT" }, "Visa CGT apposé")}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200"><Stamp size={13} /> Viser CGT</button>
                      )}
                      <button onClick={() => envoyer(b.id)} disabled={visaRequis && !b.visaCGTParId}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 disabled:opacity-40"><Send size={13} /> Envoyer</button>
                    </>
                  )}
                  {b.statut === "SENT" && (
                    <button onClick={() => action(b.id, { action: "ACCUSER_RECEPTION" }, "Accusé de réception enregistré")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-100 text-cyan-700 rounded-lg text-xs font-medium hover:bg-cyan-200"><CheckCircle2 size={13} /> Accuser réception</button>
                  )}
                  {soldeDu > 0 && ["APPROVED", "SENT", "ACKNOWLEDGED", "PARTIALLY_DELIVERED"].includes(b.statut) && (
                    <button onClick={() => setPaiementBon(b)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-200"><Wallet size={13} /> Paiement</button>
                  )}
                  {["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "ACKNOWLEDGED"].includes(b.statut) && (
                    <button onClick={() => action(b.id, { action: "ANNULER" }, "Bon annulé")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Annuler</button>
                  )}
                  <a href={`/api/logistique/bons-commande/${b.id}/pdf`} target="_blank" rel="noreferrer"
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
                </div>
              </div>
            </Card>
            </div>
          );
        })}
      </div>

      {showCreate && <FormBonCommande onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />}
      {paiementBon && (
        <FormPaiement bon={paiementBon} onClose={() => setPaiementBon(null)} onDone={() => { setPaiementBon(null); refetch(); }} />
      )}
    </div>
  );
}

function usePicker<T>(searchUrl: (q: string) => string) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<T[]>([]);
  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setOptions([]); return; }
    const r = await fetch(searchUrl(q));
    const j = await r.json();
    if (r.ok) setOptions(j.data);
  }
  return { query, options, search, setOptions };
}

function FormBonCommande({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: pdvData } = useApi<{ data: PDV[] }>("/api/admin/pdv?actif=true&limit=100");
  const pdvs = pdvData?.data ?? [];
  const fournisseurSearch = usePicker<FournisseurOption>((q) => `/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
  const produitSearch = usePicker<ProduitOption>((q) => `/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);

  const [fournisseur, setFournisseur] = useState<FournisseurOption | null>(null);
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState("");
  const [devise, setDevise] = useState("XOF");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; prixUnitaire: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function ajouterLigne(p: ProduitOption) {
    if (lignes.some((l) => l.produit.id === p.id)) return;
    setLignes((prev) => [...prev, { produit: p, quantite: "1", prixUnitaire: "0" }]);
    produitSearch.setOptions([]);
  }

  async function submit() {
    if (!fournisseur) { toast.error("Sélectionnez un fournisseur"); return; }
    if (!pointDeVenteId) { toast.error("Sélectionnez le point de vente destinataire"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/bons-commande", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseurId: fournisseur.id, pointDeVenteId: Number(pointDeVenteId),
          dateLivraisonPrevue: dateLivraisonPrevue || undefined, devise, notes: notes || undefined,
          lignes: lignes.map((l) => ({ produitId: l.produit.id, quantite: Number(l.quantite), prixUnitaire: Number(l.prixUnitaire) })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Bon de commande ${j.data.reference} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Nouveau bon de commande fournisseur</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur *</label>
            {fournisseur ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{fournisseur.nom} ({fournisseur.code})</span>
                <button onClick={() => setFournisseur(null)}><X size={14} className="text-slate-400" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={fournisseurSearch.query} onChange={(e) => fournisseurSearch.search(e.target.value)} placeholder="Nom ou code fournisseur…" className={`${inputCls} pl-8`} />
                {fournisseurSearch.options.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {fournisseurSearch.options.map((f) => (
                      <button key={f.id} onClick={() => { setFournisseur(f); fournisseurSearch.setOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                        {f.nom} ({f.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente / dépôt destinataire *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date de livraison prévue</label>
              <input type="date" value={dateLivraisonPrevue} onChange={(e) => setDateLivraisonPrevue(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Devise</label>
            <input value={devise} onChange={(e) => setDevise(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ajouter un produit</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={produitSearch.query} onChange={(e) => produitSearch.search(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-8`} />
              {produitSearch.options.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {produitSearch.options.map((p) => (
                    <button key={p.id} onClick={() => ajouterLigne(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                      {p.nom} {p.codeProduit ? `(${p.codeProduit})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="space-y-2">
              {lignes.map((l) => (
                <div key={l.produit.id} className="flex items-center gap-2 p-2 border border-slate-100 rounded-lg">
                  <span className="text-sm flex-1">{l.produit.nom}</span>
                  <input type="number" min={1} value={l.quantite}
                    onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantite: e.target.value } : x))}
                    className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté" />
                  <input type="number" min={0} value={l.prixUnitaire}
                    onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, prixUnitaire: e.target.value } : x))}
                    className="w-28 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Prix unitaire" />
                  <button onClick={() => setLignes((prev) => prev.filter((x) => x.produit.id !== l.produit.id))}><X size={14} className="text-slate-400" /></button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function FormPaiement({ bon, onClose, onDone }: { bon: BonCommandeRow; onClose: () => void; onDone: () => void }) {
  const soldeDu = Number(bon.montantTotal) - Number(bon.montantPaye);
  const [sortie, setSortie] = useState<OperationCaisseDispo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!sortie) { toast.error("Sélectionnez la sortie de caisse du paiement"); return; }
    if (sortie.montant > soldeDu + 0.01) { toast.error(`Le montant de la sortie dépasse le solde dû (${formatCurrency(soldeDu)})`); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/logistique/bons-commande/${bon.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ENREGISTRER_PAIEMENT", ...(sortie.source === "CAISSE" ? { operationCaisseId: sortie.id } : { operationCaissePDVId: sortie.id }) }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Fiche de décaissement ${j.data.reference} créée — soumise au contrôle N1/N2`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Enregistrer un paiement — {bon.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">Solde dû : {formatCurrency(soldeDu)}. Le paiement est d&apos;abord effectué en caisse (sortie « Fournisseur ») ; rattachez ici cette sortie : une fiche de décaissement est créée et soumise au contrôle N1/N2.</p>
          <SortieCaissePicker value={sortie} onChange={setSortie} categorie="FOURNISSEUR" vide="Aucune sortie de caisse « Fournisseur » sans fiche. Faites d'abord enregistrer le paiement en caisse." />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting || !sortie} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />} Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}
