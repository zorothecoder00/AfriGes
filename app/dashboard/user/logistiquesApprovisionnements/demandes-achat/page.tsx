"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  ClipboardCheck, X, RefreshCw, CheckCircle, Ban, FileSearch, User, Plus, Trash2,
} from "lucide-react";

interface Ligne {
  id: number; produitId: number; quantite: number; justification: string | null;
  produit: { id: number; nom: string; codeProduit: string | null; prixUnitaire: string | number };
  demandeCotation: { id: number; reference: string; statut: string } | null;
}
interface Demande {
  id: number; reference: string; statut: string; motif: string; notes: string | null;
  montantEstimatif: string | number; motifRejet: string | null; createdAt: string;
  demandeur: { id: number; nom: string; prenom: string };
  visePar: { id: number; nom: string; prenom: string } | null;
  pointDeVente: { id: number; nom: string; code: string } | null;
  lignes: Ligne[];
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMISE: { label: "Soumise", badge: "bg-amber-100 text-amber-700" },
  EN_VALIDATION: { label: "En attente de visa", badge: "bg-orange-100 text-orange-700" },
  APPROUVEE: { label: "Approuvée", badge: "bg-emerald-100 text-emerald-700" },
  REJETEE: { label: "Rejetée", badge: "bg-red-100 text-red-600" },
  ANNULEE: { label: "Annulée", badge: "bg-slate-200 text-slate-600" },
  CLOTUREE: { label: "Clôturée", badge: "bg-slate-200 text-slate-600" },
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function DemandesAchatPage() {
  return (
    <Suspense fallback={null}>
      <DemandesAchatPageInner />
    </Suspense>
  );
}

function DemandesAchatPageInner() {
  const searchParams = useSearchParams();
  const [statutFilter, setStatutFilter] = useState("");
  const [detailId, setDetailId] = useState<number | null>(
    searchParams.get("detail") ? Number(searchParams.get("detail")) : null
  );
  const [showCreate, setShowCreate] = useState(searchParams.get("panier") != null);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Demande[]; stats: Record<string, number>; seuilVisaDemandeAchat: number }>(
    `/api/logistique/demandes-achat?${params}`
  );
  const demandes = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <RetourApprovisionnement />
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-emerald-600" /> Demandes d&apos;achat internes
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Formalisez un besoin d&apos;achat avant de lancer une consultation fournisseur (RFQ).
            </p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700">
            <Plus className="w-4 h-4" /> Nouvelle demande
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["EN_VALIDATION", "APPROUVEE", "REJETEE", "ANNULEE", "CLOTUREE"] as const).map((k) => {
            const cfg = STATUT_CFG[k];
            return (
              <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statutFilter === k ? "ring-1 ring-emerald-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"
                }`}>
                {cfg.label} ({stats[k] ?? 0})
              </button>
            );
          })}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : demandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <ClipboardCheck className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune demande {statutFilter ? STATUT_CFG[statutFilter]?.label.toLowerCase() : ""}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {demandes.map((d) => {
              const cfg = STATUT_CFG[d.statut] ?? STATUT_CFG.SOUMISE;
              return (
                <div key={d.id} onClick={() => setDetailId(d.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{d.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <User className="w-3 h-3" /> {d.demandeur.prenom} {d.demandeur.nom}
                      <span className="mx-1">·</span> {d.motif}
                      <span className="mx-1">·</span> {formatDate(d.createdAt)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700 flex-shrink-0">{Number(d.montantEstimatif).toLocaleString("fr-FR")} FCFA</span>
                  <span className="text-xs text-slate-400 flex-shrink-0">{d.lignes.length} produit(s)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <CreateDemandeModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); refetch(); setDetailId(id); }} />}
      {detailId && <DemandeDetail id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

// ── Création ───────────────────────────────────────────────────────────────────

interface LigneForm { produitId: number | null; produitNom: string; quantite: string; justification: string }

function CreateDemandeModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const searchParams = useSearchParams();
  const panierInitial = (() => {
    const raw = searchParams.get("panier");
    if (!raw) return [{ produitId: null, produitNom: "", quantite: "", justification: "" }];
    try {
      const parsed = JSON.parse(raw) as { produitId: number; produitNom: string; quantite: number }[];
      return parsed.map((p) => ({ produitId: p.produitId, produitNom: p.produitNom, quantite: String(p.quantite), justification: "" }));
    } catch {
      return [{ produitId: null, produitNom: "", quantite: "", justification: "" }];
    }
  })();

  const [motif, setMotif] = useState("");
  const [notes, setNotes] = useState("");
  const [lignes, setLignes] = useState<LigneForm[]>(panierInitial);
  const [produitSearch, setProduitSearch] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: produitsData } = useApi<{ data: { id: number; nom: string; codeProduit: string | null }[] }>(
    Object.values(produitSearch).some((s) => s.length >= 2)
      ? `/api/logistique/produits?search=${encodeURIComponent(Object.values(produitSearch).find((s) => s.length >= 2) ?? "")}&limit=10`
      : null
  );

  const updateLigne = (i: number, patch: Partial<LigneForm>) =>
    setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const handleSubmit = async () => {
    if (!motif.trim()) { toast.error("Motif obligatoire"); return; }
    const valides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0);
    if (!valides.length) { toast.error("Ajoutez au moins une ligne valide"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/logistique/demandes-achat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motif: motif.trim(), notes: notes.trim() || undefined,
          lignes: valides.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite), justification: l.justification.trim() || undefined })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Demande créée"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouvelle demande d&apos;achat</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motif *</label>
            <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex : rupture prévisionnelle riz 25kg" className={inputCls} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Produits</label>
              <button onClick={() => setLignes((ls) => [...ls, { produitId: null, produitNom: "", quantite: "", justification: "" }])}
                className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
              </button>
            </div>
            {lignes.map((l, i) => (
              <div key={i} className="flex gap-2 items-start border border-slate-100 rounded-lg p-2">
                <div className="flex-1 space-y-1">
                  {l.produitId ? (
                    <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                      <span>{l.produitNom}</span>
                      <button onClick={() => updateLigne(i, { produitId: null, produitNom: "" })} className="text-emerald-600 hover:text-emerald-800"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={produitSearch[i] ?? ""}
                        onChange={(e) => setProduitSearch((s) => ({ ...s, [i]: e.target.value }))}
                        placeholder="Rechercher un produit…" className={inputCls}
                      />
                      {(produitSearch[i]?.length ?? 0) >= 2 && (produitsData?.data.length ?? 0) > 0 && (
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-32 overflow-y-auto">
                          {produitsData!.data.map((p) => (
                            <button key={p.id} onClick={() => { updateLigne(i, { produitId: p.id, produitNom: p.nom }); setProduitSearch((s) => ({ ...s, [i]: "" })); }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50">{p.nom}</button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <input type="text" value={l.justification} onChange={(e) => updateLigne(i, { justification: e.target.value })}
                    placeholder="Justification (optionnel)" className={`${inputCls} text-xs`} />
                </div>
                <input type="number" min="1" value={l.quantite} onChange={(e) => updateLigne(i, { quantite: e.target.value })}
                  placeholder="Qté" className="w-20 px-2 py-2 border border-slate-200 rounded-lg text-sm text-center" />
                {lignes.length > 1 && (
                  <button onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200">Annuler</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail / visa ────────────────────────────────────────────────────────────

function DemandeDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Demande }>(`/api/logistique/demandes-achat/${id}`);
  const d = data?.data;
  const [busy, setBusy] = useState(false);

  const action = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/demandes-achat/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const rejeter = () => {
    const motifRejet = prompt("Motif du rejet :");
    if (!motifRejet) return;
    action("REJETER", { motifRejet });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{d?.reference ?? "Chargement…"}</h2>
            {d && <p className="text-xs text-slate-400">Demandé par {d.demandeur.prenom} {d.demandeur.nom} · {STATUT_CFG[d.statut]?.label}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {d?.statut === "EN_VALIDATION" && (
              <>
                <button onClick={() => action("VISER")} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Viser
                </button>
                <button onClick={rejeter} disabled={busy} title="Rejeter" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"><Ban className="w-4 h-4" /></button>
              </>
            )}
            {d && ["SOUMISE", "EN_VALIDATION", "APPROUVEE"].includes(d.statut) && (
              <button onClick={() => { if (confirm("Annuler cette demande ?")) action("ANNULER"); }} disabled={busy} title="Annuler" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-50"><X className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !d ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3">{d.motif}</p>
              {d.notes && <p className="text-sm text-slate-500 italic">{d.notes}</p>}
              {d.motifRejet && <p className="text-sm text-red-600">Motif de rejet : {d.motifRejet}</p>}
              {d.visePar && <p className="text-sm text-amber-700">Visa : {d.visePar.prenom} {d.visePar.nom}</p>}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Produit</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Quantité</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {d.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-slate-800">{l.produit.nom}</span>
                          {l.produit.codeProduit && <span className="ml-1.5 text-xs text-slate-400 font-mono">{l.produit.codeProduit}</span>}
                          {l.justification && <p className="text-xs text-slate-400 mt-0.5">{l.justification}</p>}
                        </td>
                        <td className="text-center px-3 py-2.5 font-bold text-slate-800">{l.quantite}</td>
                        <td className="text-center px-3 py-2.5">
                          {d.statut === "APPROUVEE" && (
                            l.demandeCotation ? (
                              <span className="text-xs text-slate-400">RFQ {l.demandeCotation.reference}</span>
                            ) : (
                              <RfqLink produitId={l.produitId} produitNom={l.produit.nom} quantite={l.quantite} demandeAchatLigneId={l.id} />
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RfqLink({ produitId, produitNom, quantite, demandeAchatLigneId }: { produitId: number; produitNom: string; quantite: number; demandeAchatLigneId: number }) {
  const qp = new URLSearchParams({ produitId: String(produitId), produitNom, quantite: String(quantite), demandeAchatLigneId: String(demandeAchatLigneId) });
  return (
    <Link href={`/dashboard/user/logistiquesApprovisionnements/rfq?${qp}`}
      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
      <FileSearch className="w-3.5 h-3.5" /> RFQ
    </Link>
  );
}
