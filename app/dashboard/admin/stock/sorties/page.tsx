"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import RetourLien from "@/components/RetourLien";
import { Plus, Printer, X, Loader2, CheckCircle2, Ban, Stamp, Search, RefreshCw} from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatCurrency, formatDateTime } from "@/lib/format";

/** Bon de sortie de marchandises (CDC digitalisation §3.4) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }
interface LigneBonSortie { id: number; quantite: number; quantiteDemandee: number | null; prixUnit: string | null; produit: { id: number; nom: string; reference: string | null; prixUnitaire: string } }
interface BonSortie {
  id: number; reference: string; typeSortie: string; statut: "BROUILLON" | "VALIDE" | "ANNULE";
  motif: string; notes: string | null; commentaireEcart: string | null; montantTotal: string | null;
  viseParId: number | null; dateVisa: string | null;
  pointDeVente: PDV; creePar: { id: number; nom: string; prenom: string; gestionnaire?: { role: string } | null };
  validePar: { id: number; nom: string; prenom: string } | null;
  visePar: { id: number; nom: string; prenom: string } | null;
  lignes: LigneBonSortie[];
  bonLivraison: { id: number; reference: string; clientNom?: string } | null;
  commandeClient: { id: number; reference: string; client: { nom: string; prenom: string; telephone: string | null } } | null;
  dateValidation?: string | null;
  createdAt: string;
}

/** Client destinataire d'un bon (livraison client) : via la commande, à défaut via le bon de livraison. */
function clientDuBon(b: BonSortie): string | null {
  if (b.commandeClient) return `${b.commandeClient.client.prenom} ${b.commandeClient.client.nom}`;
  return b.bonLivraison?.clientNom ?? null;
}
interface BonsSortieResponse { data: BonSortie[]; meta: { total: number; page: number; limit: number; totalPages: number }; seuilVisaBonSortie: number; pdvs?: PDV[] }

const TYPE_LABEL: Record<string, string> = {
  PERTE: "Perte", CASSE: "Casse", DON: "Don", CONSOMMATION_INTERNE: "Consommation interne", LIVRAISON_CLIENT: "Livraison client",
};
const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-amber-100 text-amber-700", VALIDE: "bg-emerald-100 text-emerald-700", ANNULE: "bg-red-100 text-red-600",
};
const STATUT_LABEL: Record<string, string> = { BROUILLON: "En attente", VALIDE: "Validé", ANNULE: "Annulé" };

export default function AdminBonsSortiePage() {
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [statut, setStatut] = useState("");
  const [typeSortie, setTypeSortie] = useState("");
  const [origine, setOrigine] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<BonSortie | null>(null);
  const [aExecuter, setAExecuter] = useState<BonSortie | null>(null);

  const params = new URLSearchParams();
  if (pointDeVenteId) params.set("pointDeVenteId", pointDeVenteId);
  if (statut) params.set("statut", statut);
  if (typeSortie) params.set("typeSortie", typeSortie);
  if (origine) params.set("origine", origine);
  params.set("limit", "50");

  const { data, loading, refetch } = useApi<BonsSortieResponse>(`/api/magasinier/bons-sortie?${params}`);
  const bons = data?.data ?? [];
  const pdvs = data?.pdvs ?? [];
  const seuil = data?.seuilVisaBonSortie ?? Infinity;

  async function actionBon(id: number, body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/magasinier/bons-sortie/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return false; }
      toast.success("Bon de sortie mis à jour");
      refetch();
      return true;
    } catch { toast.error("Erreur réseau"); return false; }
  }

  return (
    <div className="md:p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">Bons de sortie de marchandises</h1>
          <p className="text-sm text-slate-500 mt-1">Sorties de stock (livraison, perte, casse, don, consommation interne)</p>
          <p className="text-xs text-slate-400 mt-0.5">Cette liste ne contient que les bons émis : les ventes directes, livraisons packs et crédit n&apos;en génèrent pas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/admin/stock/journal-sorties?from=sorties" className="text-xs font-medium text-primary-600 hover:underline whitespace-nowrap">
            Voir toutes les sorties de stock →
          </Link>
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" icon={<RefreshCw size={16} />} title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouveau bon de sortie</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Toutes les agences</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
          </select>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={typeSortie} onChange={(e) => setTypeSortie(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={origine} onChange={(e) => setOrigine(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Toutes les origines</option>
            <option value="AGENT_TERRAIN">Remplis par les agents terrain</option>
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && bons.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && bons.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucun bon de sortie sur ce filtre.</p>}
        {bons.map((b) => {
          const montant = Number(b.montantTotal ?? 0);
          const visaRequis = montant > seuil;
          const peutValider = b.statut === "BROUILLON" && (!visaRequis || b.viseParId);
          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="cursor-pointer flex-1 min-w-0" onClick={() => setDetail(b)} title="Voir le détail">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{b.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[b.statut]}`}>{STATUT_LABEL[b.statut]}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{TYPE_LABEL[b.typeSortie] ?? b.typeSortie}</span>
                    {visaRequis && !b.viseParId && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Visa requis</span>}
                    {b.creePar.gestionnaire?.role === "AGENT_TERRAIN" && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Agent terrain</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{b.pointDeVente.nom} ({b.pointDeVente.code}) — {b.motif}</p>
                  {clientDuBon(b) && <p className="text-sm text-slate-700 mt-0.5">Client : <span className="font-medium">{clientDuBon(b)}</span></p>}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {b.lignes.length} ligne(s) · {formatCurrency(montant)} · créé par {b.creePar.prenom} {b.creePar.nom} · {formatDateTime(b.createdAt)}
                  </p>
                  {b.commentaireEcart && <p className="text-xs text-amber-600 mt-1">Écart : {b.commentaireEcart}</p>}
                  {b.bonLivraison && (
                    <a href={`/api/bons-livraison/${b.bonLivraison.id}/pdf`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline mt-1">
                      <Printer size={11} /> Bon de livraison {b.bonLivraison.reference}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {visaRequis && !b.viseParId && b.statut === "BROUILLON" && (
                    <button onClick={() => actionBon(b.id, { action: "VISER" })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-medium hover:bg-orange-200">
                      <Stamp size={13} /> Viser
                    </button>
                  )}
                  {peutValider && (
                    <button onClick={() => b.typeSortie === "LIVRAISON_CLIENT" ? actionBon(b.id, { statut: "VALIDE" }) : setAExecuter(b)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200">
                      <CheckCircle2 size={13} /> Valider
                    </button>
                  )}
                  {b.statut === "BROUILLON" && (
                    <button onClick={() => actionBon(b.id, { statut: "ANNULE" })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                      <Ban size={13} /> Annuler
                    </button>
                  )}
                  <a href={`/api/magasinier/bons-sortie/${b.id}/pdf`} target="_blank" rel="noreferrer"
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {detail && <DetailBonSortie bon={detail} onClose={() => setDetail(null)} />}
      {aExecuter && (
        <ExecutionBonSortie
          bon={aExecuter}
          onClose={() => setAExecuter(null)}
          onConfirm={async (lignes, commentaireEcart) => {
            if (await actionBon(aExecuter.id, { statut: "VALIDE", lignes, commentaireEcart })) setAExecuter(null);
          }}
        />
      )}
      {showCreate && (
        <FormBonSortie pdvs={pdvs} onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

/**
 * Exécution d'un bon de sortie (hors livraison client) : quantités réellement sorties,
 * ajustables à la baisse uniquement (le serveur refuse une hausse, qui contournerait le
 * visa), commentaire d'écart obligatoire si une quantité est inférieure à la demande.
 */
function ExecutionBonSortie({ bon, onClose, onConfirm }: {
  bon: BonSortie; onClose: () => void;
  onConfirm: (lignes: { id: number; quantite: number }[], commentaireEcart?: string) => Promise<void>;
}) {
  const [quantites, setQuantites] = useState<Record<number, string>>(() => Object.fromEntries(bon.lignes.map((l) => [l.id, String(l.quantite)])));
  const [commentaire, setCommentaire] = useState("");
  const [saving, setSaving] = useState(false);
  const qte = (l: LigneBonSortie) => Number(quantites[l.id] ?? l.quantite) || 0;
  const aUnEcart = bon.lignes.some((l) => qte(l) < (l.quantiteDemandee ?? l.quantite));
  const total = bon.lignes.reduce((s, l) => s + qte(l) * Number(l.prixUnit ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Exécuter la sortie <span className="font-mono text-sm text-slate-500">{bon.reference}</span></h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-slate-500">Quantités réellement sorties (au plus la quantité demandée).</p>
          {bon.lignes.map((l) => {
            const max = l.quantiteDemandee ?? l.quantite;
            return (
              <div key={l.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-700 flex-1">{l.produit.nom} <span className="text-xs text-slate-400">(demandé : {max})</span></span>
                <input type="number" min={0} max={max} step={1} value={quantites[l.id] ?? ""}
                  onChange={(e) => setQuantites((prev) => ({ ...prev, [l.id]: e.target.value }))}
                  className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center" />
              </div>
            );
          })}
          <p className="text-xs text-slate-500 text-right">Valorisation : <span className="font-semibold text-slate-700">{formatCurrency(total)}</span></p>
          {aUnEcart && (
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2}
              placeholder="Commentaire d'écart (obligatoire : une quantité est inférieure à la demande)"
              className={`${inputCls} resize-none`} />
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button disabled={saving}
            onClick={async () => {
              setSaving(true);
              try { await onConfirm(bon.lignes.map((l) => ({ id: l.id, quantite: qte(l) })), aUnEcart ? commentaire.trim() : undefined); }
              finally { setSaving(false); }
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
            <CheckCircle2 size={14} /> Confirmer la sortie
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailBonSortie({ bon, onClose }: { bon: BonSortie; onClose: () => void }) {
  const client = clientDuBon(bon);
  const ligne = (k: string, v: ReactNode) => (
    <div className="flex justify-between gap-4 text-sm py-1 border-b border-slate-50"><span className="text-slate-500">{k}</span><span className="text-slate-800 font-medium text-right">{v}</span></div>
  );
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800 font-mono">{bon.reference}</h3>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[bon.statut]}`}>{STATUT_LABEL[bon.statut]}</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div>
            {ligne("Type de sortie", TYPE_LABEL[bon.typeSortie] ?? bon.typeSortie)}
            {ligne("Point de vente", `${bon.pointDeVente.nom} (${bon.pointDeVente.code})`)}
            {client && ligne("Client", <>{client}{bon.commandeClient?.client.telephone ? ` · ${bon.commandeClient.client.telephone}` : ""}</>)}
            {bon.commandeClient && ligne("Commande client", <Link href={`/dashboard/admin/commandes-client?detail=${bon.commandeClient.id}`} className="text-primary-600 hover:underline">{bon.commandeClient.reference}</Link>)}
            {ligne("Motif", bon.motif)}
            {ligne("Créé par", `${bon.creePar.prenom} ${bon.creePar.nom} · ${formatDateTime(bon.createdAt)}`)}
            {bon.visePar && ligne("Visa", `${bon.visePar.prenom} ${bon.visePar.nom}${bon.dateVisa ? ` · ${formatDateTime(bon.dateVisa)}` : ""}`)}
            {bon.validePar && ligne("Validé par", `${bon.validePar.prenom} ${bon.validePar.nom}${bon.dateValidation ? ` · ${formatDateTime(bon.dateValidation)}` : ""}`)}
            {bon.montantTotal != null && ligne("Valorisation", formatCurrency(Number(bon.montantTotal)))}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Lignes ({bon.lignes.length})</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-400 border-b border-slate-100"><th className="text-left py-1 font-medium">Produit</th><th className="text-center font-medium">Demandé</th><th className="text-center font-medium">Sorti</th><th className="text-right font-medium">Total</th></tr></thead>
              <tbody>
                {bon.lignes.map((l) => (
                  <tr key={l.id} className="border-b border-slate-50">
                    <td className="py-1.5">{l.produit.nom}</td>
                    <td className="text-center text-slate-500">{l.quantiteDemandee ?? "—"}</td>
                    <td className={`text-center font-medium ${l.quantiteDemandee != null && l.quantiteDemandee !== l.quantite ? "text-amber-600" : ""}`}>{l.quantite}</td>
                    <td className="text-right text-slate-600">{l.prixUnit != null ? formatCurrency(l.quantite * Number(l.prixUnit)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {bon.commentaireEcart && <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Écart : {bon.commentaireEcart}</p>}
          {bon.notes && <p className="text-sm text-slate-600">Notes : {bon.notes}</p>}
        </div>
        <div className="flex justify-between gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <div className="flex gap-3">
            {bon.bonLivraison && (
              <a href={`/api/bons-livraison/${bon.bonLivraison.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"><Printer size={13} /> Bon de livraison</a>
            )}
          </div>
          <div className="flex gap-2">
            <a href={`/api/magasinier/bons-sortie/${bon.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"><Printer size={14} /> Imprimer / PDF</a>
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg">Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useProduitSearch() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProduitOption[]>([]);
  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setOptions([]); return; }
    const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setOptions(j.data);
  }
  return { query, options, search, setOptions };
}

function FormBonSortie({ pdvs, onClose, onDone }: { pdvs: PDV[]; onClose: () => void; onDone: () => void }) {
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [typeSortie, setTypeSortie] = useState("PERTE");
  const [motif, setMotif] = useState("");
  const [notes, setNotes] = useState("");
  const [commentaireEcart, setCommentaireEcart] = useState("");
  const [lignes, setLignes] = useState<{ produit: ProduitOption; quantite: string; quantiteDemandee: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const produitSearch = useProduitSearch();

  const aUnEcart = lignes.some((l) => l.quantiteDemandee && Number(l.quantiteDemandee) > Number(l.quantite));

  function ajouterLigne(p: ProduitOption) {
    if (lignes.some((l) => l.produit.id === p.id)) return;
    setLignes((prev) => [...prev, { produit: p, quantite: "1", quantiteDemandee: "" }]);
    produitSearch.setOptions([]);
  }
  function retirerLigne(produitId: number) {
    setLignes((prev) => prev.filter((l) => l.produit.id !== produitId));
  }

  async function submit() {
    if (!pointDeVenteId) { toast.error("Sélectionnez le point de vente"); return; }
    if (!motif.trim()) { toast.error("Le motif est obligatoire"); return; }
    if (lignes.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    if (aUnEcart && !commentaireEcart.trim()) { toast.error("Un commentaire d'écart est obligatoire (quantité sortie < demandée)"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/magasinier/bons-sortie", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointDeVenteId: Number(pointDeVenteId), typeSortie, motif, notes: notes || undefined,
          commentaireEcart: aUnEcart ? commentaireEcart : undefined,
          lignes: lignes.map((l) => ({
            produitId: l.produit.id, quantite: Number(l.quantite),
            quantiteDemandee: l.quantiteDemandee ? Number(l.quantiteDemandee) : undefined,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Bon de sortie ${j.data.reference} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Nouveau bon de sortie</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente *</label>
            <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
              <option value="">Choisir…</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Type de sortie *</label>
            <select value={typeSortie} onChange={(e) => setTypeSortie(e.target.value)} className={inputCls}>
              {/* Livraison client exclue : générée uniquement par les flux de vente/livraison */}
              {Object.entries(TYPE_LABEL).filter(([k]) => k !== "LIVRAISON_CLIENT").map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Motif *</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
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
                    className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté sortie" />
                  <input type="number" min={0} value={l.quantiteDemandee}
                    onChange={(e) => setLignes((prev) => prev.map((x) => x.produit.id === l.produit.id ? { ...x, quantiteDemandee: e.target.value } : x))}
                    className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm" placeholder="Qté demandée" title="Si différente de la quantité sortie" />
                  <button onClick={() => retirerLigne(l.produit.id)}><X size={14} className="text-slate-400" /></button>
                </div>
              ))}
            </div>
          )}

          {aUnEcart && (
            <div>
              <label className="text-xs font-medium text-amber-600 mb-1 block">Commentaire d&apos;écart * (quantité sortie &lt; demandée)</label>
              <textarea value={commentaireEcart} onChange={(e) => setCommentaireEcart(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </div>
          )}
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
