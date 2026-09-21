"use client";

import { Suspense, useState } from "react";
import RetourLien from "@/components/RetourLien";
import { X, Stamp, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { useFocusDetail } from "@/hooks/useFocusDetail";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";

/**
 * Bons de commande internes (demandes de réapprovisionnement remontées par le magasinier, le RPV
 * ou le chef d'agence vers l'approvisionnement central). L'admin peut valider, rejeter et clôturer
 * à chaque niveau du circuit : validation d'agence → validation centrale → prise en charge → clôture.
 */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface Ligne { id: number; quantiteDemandee: number; quantiteValidee: number | null; produit: { nom: string; codeProduit: string | null; unite: string | null } }
interface Commande {
  id: number; reference: string; statut: string; notes: string | null; createdAt: string;
  pointDeVente: { nom: string; code: string }; demandeur: { nom: string; prenom: string }; lignes: Ligne[];
}
interface Reponse { data: Commande[]; stats: Record<string, number> }

const STATUT_LABEL: Record<string, string> = {
  BROUILLON: "Brouillon", EN_VALIDATION_AGENCE: "En validation agence", SOUMISE: "Soumise (validation centrale)",
  EN_COURS: "En cours", COMPLETE: "Complète", ANNULE: "Annulée",
};
const STATUT_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-100 text-slate-600", EN_VALIDATION_AGENCE: "bg-amber-100 text-amber-700", SOUMISE: "bg-blue-100 text-blue-700",
  EN_COURS: "bg-indigo-100 text-indigo-700", COMPLETE: "bg-emerald-100 text-emerald-700", ANNULE: "bg-red-100 text-red-600",
};

export default function AdminCommandesInternesPage() {
  return <Suspense fallback={null}><Contenu /></Suspense>;
}

function Contenu() {
  const [statut, setStatut] = useState("");
  const [rejet, setRejet] = useState<Commande | null>(null);
  const [motif, setMotif] = useState("");

  const params = new URLSearchParams({ limit: "50" });
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<Reponse>(`/api/logistique/commandes-internes?${params}`);
  const commandes = data?.data ?? [];
  const focusId = useFocusDetail(!loading);

  // L'étape « validation agence » passe par la route du chef d'agence (l'admin y est autorisé).
  async function agir(c: Commande, action: "VALIDER" | "REJETER" | "CLOTURER", msg: string, notes?: string) {
    const url = c.statut === "EN_VALIDATION_AGENCE" ? `/api/chef-agence/approvisionnement/${c.id}` : `/api/logistique/commandes-internes/${c.id}`;
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, notes }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j.error || j.message || "Erreur"); return; }
      toast.success(msg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function confirmerRejet() {
    if (!rejet) return;
    if (!motif.trim()) { toast.error("Motif de rejet obligatoire"); return; }
    await agir(rejet, "REJETER", "Demande rejetée", motif.trim());
    setRejet(null); setMotif("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bons de commande internes</h1>
          <p className="text-sm text-slate-500 mt-1">Demandes de réapprovisionnement du magasinier, du RPV et du chef d&apos;agence</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
      </div>

      <Card>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l} {data?.stats?.[k] ? `(${data.stats[k]})` : ""}</option>)}
        </select>
      </Card>

      <div className="space-y-3">
        {loading && commandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && commandes.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune demande sur ce filtre.</p>}
        {commandes.map((c) => (
          <div key={c.id} id={`doc-${c.id}`} className={focusId === c.id ? "rounded-2xl ring-2 ring-primary-400" : ""}>
            <Card>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{c.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[c.statut]}`}>{STATUT_LABEL[c.statut] ?? c.statut}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{c.pointDeVente.nom} ({c.pointDeVente.code}) — demandé par {c.demandeur.prenom} {c.demandeur.nom}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(c.createdAt)}</p>
                  <ul className="mt-2 space-y-0.5">
                    {c.lignes.map((l) => (
                      <li key={l.id} className="text-xs text-slate-600">
                        {l.produit.nom} — {l.quantiteDemandee}{l.produit.unite ? ` ${l.produit.unite}` : ""}
                        {l.quantiteValidee != null && <span className="text-slate-400"> (validé : {l.quantiteValidee})</span>}
                      </li>
                    ))}
                  </ul>
                  {c.notes && <p className="text-xs text-slate-500 mt-1">Notes : {c.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(c.statut === "EN_VALIDATION_AGENCE" || c.statut === "SOUMISE") && (
                    <button onClick={() => agir(c, "VALIDER", c.statut === "SOUMISE" ? "Demande validée — prise en charge" : "Validée (agence) — transmise à l'appro central")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Valider</button>
                  )}
                  {["EN_VALIDATION_AGENCE", "SOUMISE", "EN_COURS"].includes(c.statut) && (
                    <button onClick={() => { setRejet(c); setMotif(""); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><XCircle size={13} /> Rejeter</button>
                  )}
                  {c.statut === "EN_COURS" && (
                    <button onClick={() => agir(c, "CLOTURER", "Demande clôturée")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"><CheckCircle2 size={13} /> Clôturer</button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      {rejet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Rejeter {rejet.reference}</h4>
              <button onClick={() => setRejet(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5"><textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" /></div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setRejet(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={confirmerRejet} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
