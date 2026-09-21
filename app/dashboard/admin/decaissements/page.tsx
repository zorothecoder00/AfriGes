"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, X, Loader2, Stamp, XCircle, Wallet, Printer, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import FicheDecaissementModal, { type OperationCaisseDispo } from "@/components/FicheDecaissementModal";
import { formatCurrency, formatDateTime } from "@/lib/format";

/** Fiche de décaissement (CDC digitalisation §3.6) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface Fiche {
  id: number; reference: string; statut: string; beneficiaireNom: string; motif: string; typeDepense: string;
  montantDemande: string; montantApprouve: string | null; motifRejet: string | null;
  demandeur: { nom: string; prenom: string }; fournisseur: { nom: string } | null;
  bonCommandeFournisseur: { id: number; reference: string } | null;
  operationCaisse: { id: number; reference: string } | null;
  operationCaissePDV: { id: number; reference: string } | null;
  createdAt: string;
}
interface FichesResponse { data: Fiche[]; stats: Record<string, number> }

const CATEGORIE_LABEL: Record<string, string> = { SALAIRE: "Salaire", AVANCE: "Avance", FOURNISSEUR: "Fournisseur", CARBURANT: "Carburant", AUTRE: "Autre" };

const TYPE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISES: "Achat marchandises", FOURNITURES: "Fournitures", PAIEMENT_FOURNISSEUR: "Paiement fournisseur",
  AVANCE_CAISSE: "Avance de caisse", FRAIS_FONCTIONNEMENT: "Frais de fonctionnement", TRANSPORT: "Transport", SALAIRE: "Salaire", CARBURANT: "Carburant", AUTRES: "Autres",
};
const STATUT_LABEL: Record<string, string> = { SOUMISE: "Soumise", APPROUVEE: "Approuvée", PAYEE: "Payée", REJETEE: "Rejetée" };
const STATUT_BADGE: Record<string, string> = {
  SOUMISE: "bg-amber-100 text-amber-700", APPROUVEE: "bg-blue-100 text-blue-700", PAYEE: "bg-emerald-100 text-emerald-700", REJETEE: "bg-red-100 text-red-600",
};

export default function AdminDecaissementsPage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [ficheOp, setFicheOp] = useState<OperationCaisseDispo | null>(null);
  const [rejetFiche, setRejetFiche] = useState<Fiche | null>(null);
  const [motifRejet, setMotifRejet] = useState("");
  const [executerFiche, setExecuterFiche] = useState<Fiche | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<FichesResponse>(`/api/decaissements?${params}`);
  const fiches = data?.data ?? [];
  // Sorties de caisse (grande caisse + petite caisse RPV) qui attendent leur fiche
  // Limité aux sorties récentes (par défaut 30 jours), paginé par 10.
  const [joursOps, setJoursOps] = useState("30");
  const [pageOps, setPageOps] = useState(1);
  const { data: opsData, refetch: refetchOps } = useApi<{
    data: OperationCaisseDispo[]; meta: { total: number; page: number; totalPages: number };
  }>(`/api/decaissements/operations-disponibles?jours=${joursOps}&page=${pageOps}&limit=10`);
  const sortiesSansFiche = opsData?.data ?? [];
  const totalSorties = opsData?.meta?.total ?? 0;

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/decaissements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  async function rejeter() {
    if (!rejetFiche) return;
    if (!motifRejet.trim()) { toast.error("Motif de rejet obligatoire"); return; }
    await action(rejetFiche.id, { action: "REJETER", motifRejet }, "Fiche rejetée");
    setRejetFiche(null); setMotifRejet("");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fiches de décaissement</h1>
          <p className="text-sm text-slate-500 mt-1">Justificatif d&apos;une sortie de caisse, contrôle N1/N2</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle fiche</Button>
        </div>
      </div>

      {opsData && (
        <Card className={totalSorties > 0 ? "!border-amber-200 !bg-amber-50/50" : ""}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className={totalSorties > 0 ? "text-amber-600" : "text-emerald-600"} />
              <h2 className="text-sm font-bold text-slate-800">Sorties de caisse sans fiche de décaissement ({totalSorties})</h2>
            </div>
            <select value={joursOps} onChange={(e) => { setJoursOps(e.target.value); setPageOps(1); }}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-300">
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">90 derniers jours</option>
              <option value="0">Toutes les sorties</option>
            </select>
          </div>
          {totalSorties === 0 && (
            <p className="text-xs text-slate-500">
              {joursOps === "0" ? "Toutes les sorties de caisse ont leur fiche." : "Aucune sortie sans fiche sur cette période — élargissez la période pour voir les plus anciennes."}
            </p>
          )}
          <div className="space-y-2">
            {sortiesSansFiche.map((o) => (
              <div key={`${o.source}-${o.id}`} className="flex items-center justify-between gap-3 flex-wrap bg-white border border-amber-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-mono font-semibold">{o.reference}</span> · <span className="font-semibold">{formatCurrency(o.montant)}</span>
                    {o.categorie && <span className="text-slate-500"> · {CATEGORIE_LABEL[o.categorie] ?? o.categorie}</span>}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {o.motif} · {o.source === "CAISSE_PDV" ? "Petite caisse" : "Grande caisse"}{o.pointDeVente ? ` · ${o.pointDeVente.nom}` : ""} · {o.operateurNom} · {formatDateTime(o.date)}
                  </p>
                </div>
                <button onClick={() => setFicheOp(o)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200 whitespace-nowrap">
                  <FileText size={13} /> Créer la fiche
                </button>
              </div>
            ))}
          </div>
          {opsData?.meta && (
            <div className="-mx-5 -mb-5 mt-3">
              <Pagination page={opsData.meta.page} totalPages={opsData.meta.totalPages} total={opsData.meta.total} onPageChange={setPageOps} itemLabel="sorties" />
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l} {data?.stats?.[k] ? `(${data.stats[k]})` : ""}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && fiches.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && fiches.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune fiche sur ce filtre.</p>}
        {fiches.map((f) => {
          const montant = Number(f.montantApprouve ?? f.montantDemande);
          const enAttenteN1 = f.statut === "SOUMISE" && !f.montantApprouve;
          return (
            <Card key={f.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{f.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[f.statut]}`}>{STATUT_LABEL[f.statut] ?? f.statut}</span>
                    {f.statut === "SOUMISE" && !enAttenteN1 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">En attente N2 (Direction)</span>}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{f.beneficiaireNom} — {TYPE_LABEL[f.typeDepense] ?? f.typeDepense}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {f.motif} · {formatCurrency(montant)} · demandé par {f.demandeur.prenom} {f.demandeur.nom} · {formatDateTime(f.createdAt)}
                    {f.bonCommandeFournisseur && ` · lié au ${f.bonCommandeFournisseur.reference}`}
                  </p>
                  <p className="text-xs mt-0.5 text-slate-500">
                    {f.operationCaisse || f.operationCaissePDV
                      ? <>Sortie de caisse : <span className="font-mono">{(f.operationCaisse ?? f.operationCaissePDV)!.reference}</span></>
                      : <span className="text-slate-400">Hors caisse (fiche antérieure à la règle « sortie de caisse d&apos;abord »)</span>}
                  </p>
                  {f.motifRejet && <p className="text-xs text-red-600 mt-1">Motif de rejet : {f.motifRejet}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {enAttenteN1 && (
                    <>
                      <button onClick={() => action(f.id, { action: "APPROUVER_N1" }, "Approuvée (N1)")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Approuver N1</button>
                      <button onClick={() => { setRejetFiche(f); setMotifRejet(""); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><XCircle size={13} /> Rejeter</button>
                    </>
                  )}
                  {f.statut === "SOUMISE" && !enAttenteN1 && (
                    <button onClick={() => action(f.id, { action: "APPROUVER_N2" }, "Approuvée (N2 — Direction)")} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><Stamp size={13} /> Approuver N2</button>
                  )}
                  {f.statut === "APPROUVEE" && !f.operationCaisse && !f.operationCaissePDV && (
                    <button onClick={() => setExecuterFiche(f)} className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-200"><Wallet size={13} /> Exécuter</button>
                  )}
                  <a href={`/api/decaissements/${f.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Imprimer"><Printer size={15} /></a>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {(showCreate || ficheOp) && (
        <FicheDecaissementModal
          operationInitiale={ficheOp}
          onClose={() => { setShowCreate(false); setFicheOp(null); }}
          onDone={() => { setShowCreate(false); setFicheOp(null); refetch(); refetchOps(); }}
        />
      )}
      {rejetFiche && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm">Rejeter la fiche {rejetFiche.reference}</h4>
              <button onClick={() => setRejetFiche(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="p-5"><textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" /></div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
              <button onClick={() => setRejetFiche(null)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={rejeter} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium">Rejeter</button>
            </div>
          </div>
        </div>
      )}
      {executerFiche && (
        <FormExecuter fiche={executerFiche} onClose={() => setExecuterFiche(null)} onDone={() => { setExecuterFiche(null); refetch(); }} />
      )}
    </div>
  );
}

function FormExecuter({ fiche, onClose, onDone }: { fiche: Fiche; onClose: () => void; onDone: () => void }) {
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [beneficiaireConfirmationNom, setBeneficiaireConfirmationNom] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!referencePaiement.trim()) { toast.error("Référence de paiement obligatoire"); return; }
    if (!beneficiaireConfirmationNom.trim()) { toast.error("Confirmation de réception du bénéficiaire obligatoire"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/decaissements/${fiche.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "EXECUTER", modePaiement, referencePaiement, beneficiaireConfirmationNom }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Décaissement exécuté");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Exécuter le paiement — {fiche.reference}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputCls}>
            <option value="ESPECES">Espèces</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="CHEQUE">Chèque</option>
            <option value="VIREMENT">Virement</option>
          </select>
          <input value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className={inputCls} placeholder="Référence de paiement *" />
          <input value={beneficiaireConfirmationNom} onChange={(e) => setBeneficiaireConfirmationNom(e.target.value)} className={inputCls} placeholder="Nom du bénéficiaire confirmant réception *" />
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />} Exécuter
          </button>
        </div>
      </div>
    </div>
  );
}
