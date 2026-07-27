"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import RetourApprovisionnement from "@/components/RetourApprovisionnement";
import {
  Inbox, X, RefreshCw, CheckCircle, Ban, FileSearch, Store, User,
} from "lucide-react";

interface Ligne {
  id: number; produitId: number; quantiteDemandee: number; quantiteValidee: number | null;
  produit: { id: number; nom: string; codeProduit: string | null; unite: string | null };
}
interface Commande {
  id: number; reference: string; statut: string; notes: string | null; createdAt: string;
  pointDeVente: { id: number; nom: string; code: string; type: string };
  demandeur: { id: number; nom: string; prenom: string };
  lignes: Ligne[];
}
interface AgregatProduit {
  produitId: number; produitNom: string; codeProduit: string | null; unite: string | null;
  quantiteTotale: number; detail: { pdvNom: string; quantite: number }[];
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  EN_VALIDATION_AGENCE: { label: "En attente chef d'agence", badge: "bg-orange-100 text-orange-700" },
  SOUMISE:  { label: "Soumise",  badge: "bg-amber-100 text-amber-700" },
  EN_COURS: { label: "En cours", badge: "bg-blue-100 text-blue-700" },
  COMPLETE: { label: "Traitée",  badge: "bg-emerald-100 text-emerald-700" },
  ANNULE:   { label: "Rejetée",  badge: "bg-red-100 text-red-600" },
};

export default function CommandesInternesPage() {
  const [statutFilter, setStatutFilter] = useState("SOUMISE");
  const [detailId, setDetailId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statutFilter) params.set("statut", statutFilter);
  const { data, loading, refetch } = useApi<{ data: Commande[]; stats: Record<string, number>; agregatParProduit: AgregatProduit[] }>(
    `/api/logistique/commandes-internes?${params}`
  );
  const commandes = data?.data ?? [];
  const stats = data?.stats ?? {};
  const agregat = data?.agregatParProduit ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <RetourApprovisionnement />
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Inbox className="w-6 h-6 text-emerald-600" /> Demandes d&apos;approvisionnement
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Besoins exprimés par les points de vente et agences — à valider puis transformer en RFQ si nécessaire.
            </p>
          </div>
        </div>

        {agregat.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">Besoin agrégé multi-agences</p>
              <p className="text-xs text-slate-400">Les demandes soumises pour un même produit sont additionnées — créez une seule RFQ pour le total au lieu de traiter chaque agence séparément.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {agregat.map((a) => (
                <div key={a.produitId} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.produitNom} {a.codeProduit && <span className="text-xs text-slate-400 font-mono">{a.codeProduit}</span>}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {a.detail.map((d) => `${d.pdvNom} ${d.quantite}`).join(" + ")} = {a.quantiteTotale} {a.unite ?? ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-amber-600 flex-shrink-0">{a.quantiteTotale} {a.unite ?? "unité(s)"}</span>
                  <RfqLink produitId={a.produitId} produitNom={a.produitNom} quantite={a.quantiteTotale} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {(["SOUMISE", "EN_COURS", "COMPLETE", "ANNULE"] as const).map((k) => {
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
        ) : commandes.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <Inbox className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Aucune demande {statutFilter ? STATUT_CFG[statutFilter]?.label.toLowerCase() : ""}</p>
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
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <Store className="w-3 h-3" /> {c.pointDeVente.nom}
                      <span className="mx-1">·</span>
                      <User className="w-3 h-3" /> {c.demandeur.prenom} {c.demandeur.nom}
                      <span className="mx-1">·</span> {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{c.lignes.length} produit(s)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailId && <CommandeDetail id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} />}
    </div>
  );
}

function CommandeDetail({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const { data, loading, refetch } = useApi<{ data: Commande }>(`/api/logistique/commandes-internes/${id}`);
  const c = data?.data;
  const [quantites, setQuantites] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const getQte = (l: Ligne) => quantites[l.id] ?? String(l.quantiteValidee ?? l.quantiteDemandee);

  const valider = async () => {
    if (!c) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/commandes-internes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VALIDER",
          lignes: c.lignes.map((l) => ({ id: l.id, quantiteValidee: Number(getQte(l)) || 0 })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Demande validée"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  const rejeter = async () => {
    const notes = prompt("Motif du rejet (optionnel) :") ?? undefined;
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/commandes-internes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "REJETER", notes }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Demande rejetée"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  const cloturer = async () => {
    if (!confirm("Marquer cette demande comme traitée ?")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/logistique/commandes-internes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "CLOTURER" }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Demande clôturée"); refetch(); onUpdated(); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{c?.reference ?? "Chargement…"}</h2>
            {c && <p className="text-xs text-slate-400">{c.pointDeVente.nom} · demandé par {c.demandeur.prenom} {c.demandeur.nom}</p>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {c?.statut === "SOUMISE" && (
              <button onClick={valider} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />} Valider
              </button>
            )}
            {c?.statut === "EN_COURS" && (
              <button onClick={cloturer} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle className="w-3.5 h-3.5" /> Clôturer
              </button>
            )}
            {c && ["SOUMISE", "EN_COURS"].includes(c.statut) && (
              <button onClick={rejeter} title="Rejeter" className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-4 h-4" /></button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {loading || !c ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              {c.notes && <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">{c.notes}</p>}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 text-xs">Produit</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">Demandé</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs">
                        {c.statut === "SOUMISE" ? "À valider" : "Validé"}
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-600 text-xs"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.lignes.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-slate-800">{l.produit.nom}</span>
                          {l.produit.codeProduit && <span className="ml-1.5 text-xs text-slate-400 font-mono">{l.produit.codeProduit}</span>}
                        </td>
                        <td className="text-center px-3 py-2.5 text-slate-500">{l.quantiteDemandee} {l.produit.unite ?? ""}</td>
                        <td className="text-center px-3 py-2.5">
                          {c.statut === "SOUMISE" ? (
                            <input type="number" min="0" value={getQte(l)}
                              onChange={(e) => setQuantites((p) => ({ ...p, [l.id]: e.target.value }))}
                              className="w-20 px-2 py-1 border border-slate-200 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          ) : (
                            <span className="font-bold text-slate-800">{l.quantiteValidee ?? "—"}</span>
                          )}
                        </td>
                        <td className="text-center px-3 py-2.5">
                          {c.statut === "EN_COURS" && (l.quantiteValidee ?? 0) > 0 && (
                            <RfqLink produitId={l.produitId} produitNom={l.produit.nom} quantite={l.quantiteValidee!} />
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

function RfqLink({ produitId, produitNom, quantite }: { produitId: number; produitNom: string; quantite: number }) {
  const qp = new URLSearchParams({ produitId: String(produitId), produitNom, quantite: String(quantite) });
  return (
    <Link href={`/dashboard/user/logistiquesApprovisionnements/rfq?${qp}`}
      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
      <FileSearch className="w-3.5 h-3.5" /> RFQ
    </Link>
  );
}
