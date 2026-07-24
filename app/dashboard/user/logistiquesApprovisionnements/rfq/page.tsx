"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import {
  ArrowLeft, FileSearch, Plus, X, RefreshCw, Save, Send,
  Trophy, CheckCircle, Ban, Search,
} from "lucide-react";

interface FournisseurRef { id: number; nom: string; code: string | null; email: string | null; noteGlobale: number | string | null }
interface Reponse {
  id: number; fournisseurId: number; statut: string;
  prixUnitaire: number | string | null; delaiLivraisonJours: number | null;
  notes: string | null; emailEnvoyeA: string | null; dateReponse: string | null;
  fournisseur: FournisseurRef;
}
interface RFQ {
  id: number; reference: string; statut: string; quantite: number;
  dateLimiteReponse: string | null; notes: string | null; createdAt: string; dateCloture: string | null;
  produit: { id: number; nom: string; codeProduit: string | null; uniteAchat: { nom: string } | null };
  pointDeVente: { id: number; nom: string; code: string } | null;
  fournisseurRetenu: FournisseurRef | null;
  reponses: Reponse[];
  _count?: { reponses: number };
}
interface Candidat {
  fournisseurId: number; prixUnitaire: number; delaiLivraisonJours: number;
  scoreQualite: number | null; scorePrix: number; scoreDelai: number;
  scoreQualiteEffectif: number; scoreGlobal: number; rangPrix: number; rangDelai: number; rangGlobal: number;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  BROUILLON:       { label: "Brouillon",         badge: "bg-slate-100 text-slate-600" },
  ENVOYEE:         { label: "Envoyée",            badge: "bg-blue-100 text-blue-700" },
  REPONSES_RECUES: { label: "Réponses reçues",    badge: "bg-amber-100 text-amber-700" },
  CLOTUREE:        { label: "Clôturée",           badge: "bg-emerald-100 text-emerald-700" },
  ANNULEE:         { label: "Annulée",            badge: "bg-red-100 text-red-600" },
};
const REPONSE_STATUT_CFG: Record<string, { label: string; badge: string }> = {
  EN_ATTENTE: { label: "En attente", badge: "bg-slate-100 text-slate-500" },
  RECUE:      { label: "Reçue",      badge: "bg-blue-100 text-blue-700" },
  RETENUE:    { label: "Retenue",    badge: "bg-emerald-100 text-emerald-700" },
  REJETEE:    { label: "Rejetée",    badge: "bg-red-100 text-red-600" },
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function RFQPage() {
  return (
    <Suspense fallback={null}>
      <RFQPageInner />
    </Suspense>
  );
}

function RFQPageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("");
  const [showCreate, setShowCreate] = useState(searchParams.get("produitId") != null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: RFQ[]; stats: Record<string, number> }>(`/api/logistique/rfq?${params}`);
  const demandes = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard/user/logistiquesApprovisionnements" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-2">
              <ArrowLeft size={15} /> Approvisionnement
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileSearch className="w-6 h-6 text-emerald-600" /> Demandes de cotation (RFQ)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Consultez plusieurs fournisseurs et comparez automatiquement leurs offres</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle RFQ
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statutFilter === k ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
              }`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : demandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <FileSearch className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune demande de cotation</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {demandes.map((d) => {
              const cfg = STATUT_CFG[d.statut] ?? STATUT_CFG.BROUILLON;
              return (
                <div key={d.id} onClick={() => setDetailId(d.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{d.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{d.produit.nom} · {d.quantite} unité(s)</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{d._count?.reponses ?? d.reponses.length} fournisseur(s) consulté(s)</span>
                  {d.fournisseurRetenu && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                      <Trophy className="w-3.5 h-3.5" /> {d.fournisseurRetenu.nom}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateRFQModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }}
          prefill={{ produitId: searchParams.get("produitId"), produitNom: searchParams.get("produitNom"), quantite: searchParams.get("quantite") }}
        />
      )}
      {detailId && <RFQDetail id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

// ── Création ───────────────────────────────────────────────────────────────────

function CreateRFQModal({ onClose, onCreated, prefill }: {
  onClose: () => void; onCreated: (id: number) => void;
  prefill?: { produitId: string | null; produitNom: string | null; quantite: string | null };
}) {
  const [produitSearch, setProduitSearch] = useState("");
  const [produitId, setProduitId] = useState<number | null>(prefill?.produitId ? Number(prefill.produitId) : null);
  const [produitNom, setProduitNom] = useState(prefill?.produitNom ?? "");
  const [quantite, setQuantite] = useState(prefill?.quantite ?? "");
  const [dateLimiteReponse, setDateLimiteReponse] = useState("");
  const [notes, setNotes] = useState("");
  const [fournisseurIds, setFournisseurIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: produitsData } = useApi<{ data: { id: number; nom: string; codeProduit: string | null }[] }>(
    produitSearch.length >= 2 ? `/api/logistique/produits?search=${encodeURIComponent(produitSearch)}&limit=10` : null
  );
  const { data: fournisseursData } = useApi<{ data: FournisseurRef[] }>("/api/logistique/fournisseurs?actif=true");
  const fournisseurs = fournisseursData?.data ?? [];

  const toggleFournisseur = (id: number) => {
    setFournisseurIds((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!produitId) { toast.error("Sélectionnez un produit"); return; }
    if (!quantite || Number(quantite) <= 0) { toast.error("Quantité invalide"); return; }
    if (fournisseurIds.length === 0) { toast.error("Sélectionnez au moins un fournisseur à consulter"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/rfq", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produitId, quantite: Number(quantite), dateLimiteReponse: dateLimiteReponse || undefined, notes: notes || undefined, fournisseurIds }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("RFQ créée"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande de cotation</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <Field label="Produit *">
            {produitId ? (
              <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                <span>{produitNom}</span>
                <button onClick={() => { setProduitId(null); setProduitNom(""); setProduitSearch(""); }} className="text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={produitSearch} onChange={(e) => setProduitSearch(e.target.value)} placeholder="Rechercher un produit…" className={`${inputCls} pl-9`} />
                {produitsData?.data && produitsData.data.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {produitsData.data.map((p) => (
                      <button key={p.id} onClick={() => { setProduitId(p.id); setProduitNom(p.nom); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                        {p.nom} {p.codeProduit && <span className="text-xs text-slate-400 font-mono">{p.codeProduit}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité *"><input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} className={inputCls} /></Field>
            <Field label="Date limite de réponse"><input type="date" value={dateLimiteReponse} onChange={(e) => setDateLimiteReponse(e.target.value)} className={inputCls} /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-y`} /></Field>

          <Field label={`Fournisseurs à consulter * (${fournisseurIds.length} sélectionné(s))`}>
            <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100">
              {fournisseurs.length === 0 ? (
                <p className="p-3 text-xs text-slate-400">Aucun fournisseur actif. Créez-en un d&apos;abord.</p>
              ) : fournisseurs.map((f) => (
                <label key={f.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={fournisseurIds.includes(f.id)} onChange={() => toggleFournisseur(f.id)} />
                  <span className="flex-1">{f.nom}</span>
                  {!f.email && <span className="text-[10px] text-amber-600">sans email — consultation manuelle</span>}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail + comparatif ─────────────────────────────────────────────────────────

function RFQDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: RFQ; comparatif: Candidat[] }>(`/api/logistique/rfq/${id}`);
  const [sending, setSending] = useState(false);
  const [cotationFor, setCotationFor] = useState<Reponse | null>(null);

  const d = data?.data;
  const comparatif = data?.comparatif ?? [];
  const meilleur = comparatif[0];

  const envoyer = async () => {
    setSending(true);
    try {
      const r = await fetch(`/api/logistique/rfq/${id}/envoyer`, { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success(`Consultation envoyée (${j.emailsEnvoyes}/${j.totalFournisseurs} email(s))`); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSending(false); }
  };

  const annuler = async () => {
    if (!confirm("Annuler cette demande de cotation ?")) return;
    const r = await fetch(`/api/logistique/rfq/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ANNULER" }),
    });
    if (r.ok) { toast.success("RFQ annulée"); refetch(); onUpdated(); }
  };

  const retenir = async (reponseId: number) => {
    if (!confirm("Retenir ce fournisseur et clôturer la RFQ ?")) return;
    const r = await fetch(`/api/logistique/rfq/${id}/retenir`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reponseId }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { toast.success("Fournisseur retenu, RFQ clôturée"); refetch(); onUpdated(); }
    else toast.error(j.error ?? "Erreur");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{d?.reference ?? "Chargement…"}</h2>
            {d && <p className="text-xs text-slate-400">{d.produit.nom} · {d.quantite} unité(s){d.pointDeVente ? ` · ${d.pointDeVente.nom}` : ""}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {d?.statut === "BROUILLON" && (
              <button onClick={envoyer} disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Envoyer la consultation
              </button>
            )}
            {d && !["CLOTUREE", "ANNULEE"].includes(d.statut) && (
              <button onClick={annuler} title="Annuler" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {loading || !d ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              {d.fournisseurRetenu && (
                <div className="flex items-center justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800">
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 flex-shrink-0" /> Fournisseur retenu : <strong>{d.fournisseurRetenu.nom}</strong>
                    {d.dateCloture && <span className="text-xs text-emerald-600">— {formatDate(d.dateCloture)}</span>}
                  </span>
                  {(() => {
                    const retenue = d.reponses.find((r) => r.statut === "RETENUE");
                    if (!retenue) return null;
                    const qp = new URLSearchParams({
                      fournisseurId: String(d.fournisseurRetenu!.id),
                      produitId: String(d.produit.id), produitNom: d.produit.nom,
                      quantite: String(d.quantite), prixUnitaire: String(retenue.prixUnitaire ?? 0),
                      rfqId: String(d.id),
                    });
                    return (
                      <Link href={`/dashboard/user/logistiquesApprovisionnements/bons-commande?${qp}`}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                        Créer le bon de commande
                      </Link>
                    );
                  })()}
                </div>
              )}

              {/* Comparatif */}
              {comparatif.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Comparatif automatique</p>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Fournisseur</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Prix</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Délai</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Score</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {comparatif.map((c) => {
                          const rep = d.reponses.find((r) => r.fournisseurId === c.fournisseurId);
                          const estRecommande = c.fournisseurId === meilleur?.fournisseurId;
                          return (
                            <tr key={c.fournisseurId} className={estRecommande ? "bg-emerald-50/50" : ""}>
                              <td className="px-3 py-2.5">
                                <span className="font-medium text-slate-800">{rep?.fournisseur.nom}</span>
                                {estRecommande && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full"><Trophy className="w-3 h-3" /> Recommandé</span>}
                              </td>
                              <td className="text-center px-3 py-2.5">{c.prixUnitaire.toLocaleString("fr-FR")} <span className="text-xs text-slate-400">(#{c.rangPrix})</span></td>
                              <td className="text-center px-3 py-2.5">{c.delaiLivraisonJours} j <span className="text-xs text-slate-400">(#{c.rangDelai})</span></td>
                              <td className="text-center px-3 py-2.5 font-bold text-slate-800">{c.scoreGlobal}/100</td>
                              <td className="text-center px-3 py-2.5">
                                {d.statut !== "CLOTUREE" && rep && (
                                  <button onClick={() => retenir(rep.id)} className="text-xs text-emerald-600 hover:underline font-medium">Retenir</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Fournisseurs consultés */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Fournisseurs consultés</p>
                <div className="space-y-2">
                  {d.reponses.map((r) => {
                    const cfg = REPONSE_STATUT_CFG[r.statut] ?? REPONSE_STATUT_CFG.EN_ATTENTE;
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-slate-800">{r.fournisseur.nom}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.badge}`}>{cfg.label}</span>
                            {!r.fournisseur.email && <span className="text-[10px] text-amber-600">sans email</span>}
                          </div>
                          {r.prixUnitaire != null && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {Number(r.prixUnitaire).toLocaleString("fr-FR")} FCFA · {r.delaiLivraisonJours} j de délai
                              {r.dateReponse && ` · reçue le ${formatDate(r.dateReponse)}`}
                            </p>
                          )}
                        </div>
                        {(r.statut === "EN_ATTENTE" || r.statut === "RECUE") && d.statut !== "CLOTUREE" && (
                          <button onClick={() => setCotationFor(r)} className="text-xs text-emerald-600 hover:underline font-medium flex-shrink-0">
                            {r.statut === "RECUE" ? "Modifier" : "Saisir la cotation"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {cotationFor && (
        <CotationModal reponse={cotationFor} rfqId={id} onClose={() => setCotationFor(null)} onSaved={() => { setCotationFor(null); refetch(); }} />
      )}
    </div>
  );
}

function CotationModal({ reponse, rfqId, onClose, onSaved }: { reponse: Reponse; rfqId: number; onClose: () => void; onSaved: () => void }) {
  const [prixUnitaire, setPrixUnitaire] = useState(reponse.prixUnitaire != null ? String(reponse.prixUnitaire) : "");
  const [delaiLivraisonJours, setDelaiLivraisonJours] = useState(reponse.delaiLivraisonJours != null ? String(reponse.delaiLivraisonJours) : "");
  const [notes, setNotes] = useState(reponse.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!prixUnitaire || Number(prixUnitaire) <= 0) { toast.error("Prix invalide"); return; }
    if (delaiLivraisonJours === "" || Number(delaiLivraisonJours) < 0) { toast.error("Délai invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/rfq/${rfqId}/reponses/${reponse.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prixUnitaire: Number(prixUnitaire), delaiLivraisonJours: Number(delaiLivraisonJours), notes: notes || undefined }),
      });
      if (r.ok) { toast.success("Cotation enregistrée"); onSaved(); }
      else toast.error("Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Cotation — {reponse.fournisseur.nom}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Prix unitaire (FCFA) *"><input type="number" min="0" value={prixUnitaire} onChange={(e) => setPrixUnitaire(e.target.value)} className={inputCls} /></Field>
          <Field label="Délai de livraison (jours) *"><input type="number" min="0" value={delaiLivraisonJours} onChange={(e) => setDelaiLivraisonJours(e.target.value)} className={inputCls} /></Field>
          <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-y`} /></Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
