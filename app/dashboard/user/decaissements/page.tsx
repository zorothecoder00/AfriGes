"use client";

import { useState, useEffect, Suspense } from "react";
import RetourLien from "@/components/RetourLien";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useApi } from "@/hooks/useApi";
import FicheDecaissementModal from "@/components/FicheDecaissementModal";
import { toast } from "sonner";
import { Wallet2, Plus, X, RefreshCw, FileText, CheckCircle, XCircle, Banknote } from "lucide-react";


interface PersonRef { id: number; nom: string; prenom: string }
interface Fiche {
  id: number; reference: string; statut: string;
  demandeur: PersonRef;
  beneficiaireNom: string; beneficiaireContact: string | null;
  motif: string; typeDepense: string;
  montantDemande: number | string; montantApprouve: number | string | null; motifEcartMontant: string | null;
  modePaiement: string | null; referencePaiement: string | null;
  piecesJustificatives: string[];
  approbateurN1: PersonRef | null; approbateurN2: PersonRef | null; executePar: PersonRef | null;
  motifRejet: string | null;
  operationCaisse?: { id: number; reference: string } | null;
  operationCaissePDV?: { id: number; reference: string } | null;
  createdAt: string;
}

const STATUT_CFG: Record<string, { label: string; badge: string }> = {
  SOUMISE: { label: "Soumise", badge: "bg-blue-100 text-blue-700" },
  APPROUVEE: { label: "Approuvée", badge: "bg-cyan-100 text-cyan-700" },
  PAYEE: { label: "Payée", badge: "bg-emerald-100 text-emerald-700" },
  REJETEE: { label: "Rejetée", badge: "bg-red-100 text-red-700" },
};

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

export default function DecaissementsPage() {
  return (
    <Suspense fallback={null}>
      <DecaissementsPageInner />
    </Suspense>
  );
}

function DecaissementsPageInner() {
  const searchParams = useSearchParams();
  const { data: sessionData } = useSession();
  const role = sessionData?.user?.role;
  const gRole = sessionData?.user?.gestionnaireRole;
  const isComptableOuAdmin = role === "ADMIN" || role === "SUPER_ADMIN" || gRole === "COMPTABLE" || gRole === "CHEF_COMPTABLE";

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
  const { data, loading, refetch } = useApi<{ data: Fiche[]; stats: Record<string, number> }>(`/api/decaissements?${params}`);
  const fiches = data?.data ?? [];
  const stats = data?.stats ?? {};

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <RetourLien className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 transition-colors" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet2 className="w-6 h-6 text-violet-600" /> Fiches de décaissement
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{isComptableOuAdmin ? "Toutes les demandes de sortie de fonds" : "Mes demandes de sortie de fonds"}</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nouvelle fiche
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUT_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setStatutFilter(statutFilter === k ? "" : k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statutFilter === k ? "ring-1 ring-violet-400 " + cfg.badge : cfg.badge + " opacity-60 hover:opacity-100"}`}>
              {cfg.label} ({stats[k] ?? 0})
            </button>
          ))}
          <button onClick={refetch} className="ml-auto p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
        ) : fiches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center py-16 text-slate-400">
            <Wallet2 className="w-10 h-10 mb-2 opacity-30" /><p className="text-sm">Aucune fiche</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {fiches.map((f) => {
              const cfg = STATUT_CFG[f.statut] ?? STATUT_CFG.SOUMISE;
              return (
                <div key={f.id} onClick={() => setDetailId(f.id)} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{f.reference}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{f.beneficiaireNom} · {f.typeDepense}{isComptableOuAdmin ? ` · ${f.demandeur.prenom} ${f.demandeur.nom}` : ""}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 flex-shrink-0">{Number(f.montantDemande).toLocaleString("fr-FR")} FCFA</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && <FicheDecaissementModal onClose={() => setShowCreate(false)} onDone={(fiche) => { setShowCreate(false); refetch(); setDetailId(fiche.id); }} />}
      {detailId && <DetailModal id={detailId} onClose={() => setDetailId(null)} onUpdated={refetch} isComptableOuAdmin={isComptableOuAdmin} role={role} gRole={gRole} />}
    </div>
  );
}

function DetailModal({ id, onClose, onUpdated, isComptableOuAdmin, role, gRole }: { id: number; onClose: () => void; onUpdated: () => void; isComptableOuAdmin: boolean; role?: string | null; gRole?: string | null }) {
  const { data, loading, refetch } = useApi<{ data: Fiche; seuilN2: number }>(`/api/decaissements/${id}`);
  const [busy, setBusy] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [showRejet, setShowRejet] = useState(false);
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [referencePaiement, setReferencePaiement] = useState("");
  const [beneficiaireConfirmationNom, setBeneficiaireConfirmationNom] = useState("");
  const f = data?.data;
  const seuilN2 = data?.seuilN2 ?? Infinity;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isCaissier = gRole === "CAISSIER";
  const montantRef = f ? Number(f.montantApprouve ?? f.montantDemande) : 0;
  const attenteN2 = !!f && f.statut === "SOUMISE" && !!f.approbateurN1 && !f.approbateurN2 && montantRef > seuilN2;
  const attenteN1 = !!f && f.statut === "SOUMISE" && !f.approbateurN1;

  const doAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/decaissements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Mis à jour"); refetch(); onUpdated(); } else toast.error(j.error ?? "Erreur");
    } finally { setBusy(false); }
  };

  const executer = () => {
    if (!referencePaiement.trim() || !beneficiaireConfirmationNom.trim()) { toast.error("Référence de paiement et confirmation du bénéficiaire requises"); return; }
    doAction("EXECUTER", { modePaiement, referencePaiement, beneficiaireConfirmationNom });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{f?.reference ?? "Chargement…"}</h2>
          <div className="flex items-center gap-1">
            {f && <a href={`/api/decaissements/${id}/pdf`} target="_blank" rel="noreferrer" title="PDF" className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></a>}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-3">
          {loading || !f ? (
            <div className="flex justify-center py-12 text-slate-400"><RefreshCw className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(STATUT_CFG[f.statut] ?? STATUT_CFG.SOUMISE).badge}`}>{(STATUT_CFG[f.statut] ?? STATUT_CFG.SOUMISE).label}</span>
              <p className="text-sm text-slate-600">Bénéficiaire : <b>{f.beneficiaireNom}</b></p>
              <p className="text-sm text-slate-600">Type : {f.typeDepense}</p>
              <p className="text-sm text-slate-600">Motif : {f.motif}</p>
              <p className="text-sm text-slate-600">Montant demandé : <b>{Number(f.montantDemande).toLocaleString("fr-FR")} FCFA</b></p>
              {f.montantApprouve != null && <p className="text-sm text-slate-600">Montant approuvé : <b>{Number(f.montantApprouve).toLocaleString("fr-FR")} FCFA</b></p>}
              {f.approbateurN1 && <p className="text-sm text-emerald-700">Visa N1 : {f.approbateurN1.prenom} {f.approbateurN1.nom}</p>}
              {f.approbateurN2 && <p className="text-sm text-amber-700">Visa N2 (Direction) : {f.approbateurN2.prenom} {f.approbateurN2.nom}</p>}
              {f.executePar && <p className="text-sm text-blue-700">Payé par {f.executePar.prenom} {f.executePar.nom} — réf. {f.referencePaiement}</p>}
              {f.motifRejet && <p className="text-sm text-red-600">Motif de rejet : {f.motifRejet}</p>}
            </>
          )}
        </div>

        {f && isComptableOuAdmin && attenteN1 && (
          <div className="px-6 py-4 border-t border-slate-200 space-y-2">
            {showRejet && <input value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} placeholder="Motif de rejet" className={inputCls} />}
            <div className="flex justify-end gap-2">
              {showRejet ? (
                <button onClick={() => doAction("REJETER", { motifRejet })} disabled={busy || !motifRejet.trim()} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"><XCircle className="w-4 h-4" /> Confirmer le rejet</button>
              ) : (
                <button onClick={() => setShowRejet(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"><XCircle className="w-4 h-4" /> Rejeter</button>
              )}
              <button onClick={() => doAction("APPROUVER_N1")} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"><CheckCircle className="w-4 h-4" /> Approuver (N1)</button>
            </div>
          </div>
        )}

        {f && isAdmin && attenteN2 && (
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
            <button onClick={() => doAction("APPROUVER_N2")} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"><CheckCircle className="w-4 h-4" /> Approuver (Direction — N2)</button>
          </div>
        )}

        {f && f.statut === "APPROUVEE" && !f.operationCaisse && !f.operationCaissePDV && (isCaissier || isComptableOuAdmin) && (
          <div className="px-6 py-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Exécution du paiement</p>
            <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputCls}>
              <option value="ESPECES">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option><option value="CHEQUE">Chèque</option><option value="VIREMENT">Virement</option>
            </select>
            <input placeholder="Référence de paiement" value={referencePaiement} onChange={(e) => setReferencePaiement(e.target.value)} className={inputCls} />
            <input placeholder="Nom du bénéficiaire (confirmation de réception)" value={beneficiaireConfirmationNom} onChange={(e) => setBeneficiaireConfirmationNom(e.target.value)} className={inputCls} />
            <button onClick={executer} disabled={busy} className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50"><Banknote className="w-4 h-4" /> Exécuter le paiement</button>
          </div>
        )}
      </div>
    </div>
  );
}
