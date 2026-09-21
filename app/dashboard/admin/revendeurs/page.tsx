"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Store, Plus, X, RefreshCw, Printer, PauseCircle, PlayCircle, StopCircle,
  ShoppingCart, FileText, Truck, Loader2, CheckCircle2, Ban,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";
import DashboardBackButton from "@/components/DashboardBackButton";
import AfriSimeLogo from "@/components/AfriSimeLogo";

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500";
const fmt = (n: number | string) => Number(n).toLocaleString("fr-FR");

export type VarianteRevendeur = "OUVERTURE" | "CARTE" | "GRILLE" | "CONVENTION" | "ATTESTATION";

interface PDV { id: number; nom: string; code: string }
interface EligibleUser { id: number; nom: string; prenom: string; email: string | null }
interface ProfilRevendeurData {
  id: number; raisonSociale: string; statut: string;
  contactTelephone: string | null;
  user: { nom: string; prenom: string; telephone: string | null };
  pointDeVente: { id: number; nom: string; code: string } | null;
}
interface CommandeRevendeurData { id: number; reference: string; statut: string; totalTTC: number | string }
interface RevendeursResponse { data: ProfilRevendeurData[]; pdvs: PDV[] }

const STATUT_BADGE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700",
  SUSPENDU: "bg-amber-100 text-amber-700",
  RESILIE: "bg-slate-200 text-slate-600",
};
const STATUT_LABEL: Record<string, string> = { ACTIF: "Actif", SUSPENDU: "Suspendu", RESILIE: "Résilié" };
const STATUT_CDE_BADGE: Record<string, string> = {
  BROUILLON: "bg-slate-200 text-slate-600",
  CONFIRMEE: "bg-blue-100 text-blue-700",
  LIVREE: "bg-emerald-100 text-emerald-700",
  FACTUREE: "bg-purple-100 text-purple-700",
  ANNULEE: "bg-red-100 text-red-600",
};

export default function AdminRevendeursPage() {
  return (
    <Suspense fallback={null}>
      <AdminRevendeursPageInner />
    </Suspense>
  );
}

function AdminRevendeursPageInner() {
  const searchParams = useSearchParams();
  const { data: listData, loading: listLoading, refetch: refetchList } = useApi<RevendeursResponse>("/api/admin/revendeurs");
  const revendeurs = listData?.data ?? [];
  const pdvs = listData?.pdvs ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [eligibles, setEligibles] = useState<EligibleUser[]>([]);
  const [loadingEligibles, setLoadingEligibles] = useState(false);
  const [createForm, setCreateForm] = useState({
    userId: "", raisonSociale: "", nomCommercial: "", nif: "", rccm: "", adresse: "", ville: "",
    contactNom: "", contactTelephone: "", contactEmail: "", pointDeVenteId: "", conditionsParticulieres: "",
  });
  const [creating, setCreating] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);

  // Ouvre directement le profil visé par un lien de notification ou un QR
  // de document scanné (?detail=123).
  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCreate() {
    setShowCreate(true);
    setLoadingEligibles(true);
    try {
      const r = await fetch("/api/admin/revendeurs?eligibles=true");
      const j = await r.json();
      if (r.ok) setEligibles(j.data);
    } finally { setLoadingEligibles(false); }
  }

  async function submitCreate() {
    if (!createForm.userId || !createForm.raisonSociale.trim()) { toast.error("Utilisateur et raison sociale obligatoires"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/revendeurs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, userId: Number(createForm.userId) }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success("Compte revendeur ouvert");
      setShowCreate(false);
      refetchList();
      setDetailId(j.data.id);
    } catch { toast.error("Erreur réseau"); }
    finally { setCreating(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50/20 to-white font-['DM_Sans',sans-serif]">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center overflow-hidden shadow-sm border border-slate-100">
              <AfriSimeLogo className="w-full h-full object-contain" />
            </div>
            <DashboardBackButton />
            <h1 className="text-base font-bold flex items-center gap-2 text-slate-800"><Store size={18} className="text-rose-600" /> Revendeurs B2B</h1>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell href="/dashboard/admin/notifications" />
            <AccountMenuButton settingsHref="/dashboard/admin/parametres" inline />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Comptes revendeurs</h2>
            <p className="text-sm text-slate-500">Ventes en gros / B2B</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetchList()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
              <RefreshCw size={16} className={listLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium">
              <Plus size={16} /> Ouvrir un compte
            </button>
          </div>
        </div>

        {listLoading && <p className="text-sm text-slate-400">Chargement…</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {revendeurs.map((p) => (
            <button key={p.id} onClick={() => setDetailId(p.id)}
              className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-slate-800">{p.raisonSociale}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[p.statut]}`}>{STATUT_LABEL[p.statut]}</span>
              </div>
              <p className="text-xs text-slate-500">{p.user.prenom} {p.user.nom} · {p.contactTelephone ?? p.user.telephone ?? "—"}</p>
              {p.pointDeVente && <p className="text-xs text-slate-400 mt-1">{p.pointDeVente.nom} ({p.pointDeVente.code})</p>}
            </button>
          ))}
          {!listLoading && revendeurs.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 text-sm">Aucun compte revendeur ouvert pour le moment.</div>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">Ouvrir un compte revendeur</h3>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Utilisateur (rôle REVENDEUR) *</label>
                {loadingEligibles ? <p className="text-xs text-slate-400">Chargement…</p> : (
                  <select value={createForm.userId} onChange={(e) => setCreateForm((f) => ({ ...f, userId: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {eligibles.map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom} {u.email ? `(${u.email})` : ""}</option>)}
                  </select>
                )}
                {!loadingEligibles && eligibles.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Aucun utilisateur disponible — créez d&apos;abord un compte via Gestionnaires (rôle REVENDEUR).</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Raison sociale *</label>
                <input value={createForm.raisonSociale} onChange={(e) => setCreateForm((f) => ({ ...f, raisonSociale: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Nom commercial</label>
                  <input value={createForm.nomCommercial} onChange={(e) => setCreateForm((f) => ({ ...f, nomCommercial: e.target.value }))} className={inputCls} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente</label>
                  <select value={createForm.pointDeVenteId} onChange={(e) => setCreateForm((f) => ({ ...f, pointDeVenteId: e.target.value }))} className={inputCls}>
                    <option value="">—</option>
                    {pdvs.map((pdv) => <option key={pdv.id} value={pdv.id}>{pdv.nom} ({pdv.code})</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">NIF</label>
                  <input value={createForm.nif} onChange={(e) => setCreateForm((f) => ({ ...f, nif: e.target.value }))} className={inputCls} /></div>
                <div><label className="text-xs font-medium text-slate-500 mb-1 block">RCCM</label>
                  <input value={createForm.rccm} onChange={(e) => setCreateForm((f) => ({ ...f, rccm: e.target.value }))} className={inputCls} /></div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Adresse / Ville</label>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Adresse" value={createForm.adresse} onChange={(e) => setCreateForm((f) => ({ ...f, adresse: e.target.value }))} className={inputCls} />
                  <input placeholder="Ville" value={createForm.ville} onChange={(e) => setCreateForm((f) => ({ ...f, ville: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="Contact — nom" value={createForm.contactNom} onChange={(e) => setCreateForm((f) => ({ ...f, contactNom: e.target.value }))} className={inputCls} />
                <input placeholder="Contact — tél." value={createForm.contactTelephone} onChange={(e) => setCreateForm((f) => ({ ...f, contactTelephone: e.target.value }))} className={inputCls} />
                <input placeholder="Contact — email" value={createForm.contactEmail} onChange={(e) => setCreateForm((f) => ({ ...f, contactEmail: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Conditions particulières</label>
                <textarea rows={2} value={createForm.conditionsParticulieres} onChange={(e) => setCreateForm((f) => ({ ...f, conditionsParticulieres: e.target.value }))} className={inputCls + " resize-none"} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={submitCreate} disabled={creating} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ouvrir le compte
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId != null && (
        <RevendeurDetailModal id={detailId} onClose={() => { setDetailId(null); refetchList(); }} />
      )}
    </div>
  );
}

// ── Détail revendeur ────────────────────────────────────────────────────────

function RevendeurDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading, refetch } = useApi<{ data: ProfilRevendeurData; stats: { nbFactures: number; totalFacture: number; totalPaye: number; soldeDu: number } }>(`/api/admin/revendeurs/${id}`);
  const { data: cmdData, refetch: refetchCmd } = useApi<{ data: CommandeRevendeurData[] }>(`/api/admin/revendeurs/${id}/commandes`);
  const commandes = cmdData?.data ?? [];

  const [busyStatut, setBusyStatut] = useState(false);
  const [showNewCmd, setShowNewCmd] = useState(false);
  const [busyAction, setBusyAction] = useState<number | null>(null);

  async function changerStatut(action: "SUSPENDRE" | "REACTIVER" | "RESILIER") {
    setBusyStatut(true);
    try {
      const r = await fetch(`/api/admin/revendeurs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success("Statut mis à jour");
      refetch();
    } finally { setBusyStatut(false); }
  }

  async function actionCommande(commandeId: number, action: "CONFIRMER" | "FACTURER" | "ANNULER") {
    setBusyAction(commandeId);
    try {
      const r = await fetch(`/api/admin/revendeurs/${id}/commandes/${commandeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success(action === "CONFIRMER" ? "Commande confirmée — livraison générée" : action === "FACTURER" ? "Facture générée" : "Commande annulée");
      refetchCmd();
      refetch();
    } finally { setBusyAction(null); }
  }

  const profil = data?.data;
  const stats = data?.stats;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[180] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{profil?.raisonSociale ?? "…"}</h3>
            {profil && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUT_BADGE[profil.statut]}`}>{STATUT_LABEL[profil.statut]}</span>}
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        {loading || !profil ? <div className="p-10 text-center text-slate-400 text-sm">Chargement…</div> : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Actions statut + documents profil */}
            <div className="flex flex-wrap gap-2">
              {profil.statut === "ACTIF" && (
                <button onClick={() => changerStatut("SUSPENDRE")} disabled={busyStatut} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 disabled:opacity-50"><PauseCircle size={13} /> Suspendre</button>
              )}
              {profil.statut === "SUSPENDU" && (
                <button onClick={() => changerStatut("REACTIVER")} disabled={busyStatut} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"><PlayCircle size={13} /> Réactiver</button>
              )}
              {profil.statut !== "RESILIE" && (
                <button onClick={() => { if (confirm("Résilier ce compte revendeur ?")) changerStatut("RESILIER"); }} disabled={busyStatut} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 disabled:opacity-50"><StopCircle size={13} /> Résilier</button>
              )}
              <span className="flex-1" />
              {(["OUVERTURE", "CARTE", "GRILLE", "CONVENTION", "ATTESTATION"] as VarianteRevendeur[]).map((v) => (
                <a key={v} href={`/api/admin/revendeurs/${id}/pdf?variante=${v}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg" title={v}>
                  <Printer size={12} /> {v.charAt(0) + v.slice(1).toLowerCase()}
                </a>
              ))}
              <a href={`/api/admin/revendeurs/${id}/releve/pdf`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg">
                <Printer size={12} /> Relevé
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Factures</p>
                <p className="font-bold text-slate-700">{stats?.nbFactures ?? 0}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500">Total facturé</p>
                <p className="font-bold text-slate-700">{fmt(stats?.totalFacture ?? 0)}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3 text-center">
                <p className="text-xs text-rose-600">Solde dû</p>
                <p className="font-bold text-rose-700">{fmt(stats?.soldeDu ?? 0)}</p>
              </div>
            </div>

            {/* Commandes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Commandes ({commandes.length})</h4>
                <button onClick={() => setShowNewCmd((s) => !s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium"><Plus size={13} /> Nouvelle commande</button>
              </div>

              {showNewCmd && <NouvelleCommandeForm revendeurId={id} pointDeVenteId={profil.pointDeVente?.id ?? null} onCreated={() => { setShowNewCmd(false); refetchCmd(); }} />}

              <div className="space-y-2 mt-2">
                {commandes.map((c) => (
                  <div key={c.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{c.reference}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUT_CDE_BADGE[c.statut]}`}>{c.statut}</span>
                      </div>
                      <span className="font-bold text-emerald-700 text-sm">{fmt(c.totalTTC)} FCFA</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <a href={`/api/admin/revendeurs/${id}/commandes/${c.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded"><Printer size={11} /> BC</a>
                      {c.statut === "BROUILLON" && (
                        <>
                          <button onClick={() => actionCommande(c.id, "CONFIRMER")} disabled={busyAction === c.id} className="flex items-center gap-1 px-2 py-1 text-[11px] text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"><CheckCircle2 size={11} /> Confirmer</button>
                          <button onClick={() => actionCommande(c.id, "ANNULER")} disabled={busyAction === c.id} className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 rounded disabled:opacity-50"><Ban size={11} /> Annuler</button>
                        </>
                      )}
                      {(c.statut === "CONFIRMEE" || c.statut === "LIVREE" || c.statut === "FACTUREE") && (
                        <a href={`/api/admin/revendeurs/${id}/commandes/${c.id}/bon-livraison/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded"><Truck size={11} /> BL</a>
                      )}
                      {c.statut === "CONFIRMEE" && (
                        <button onClick={() => actionCommande(c.id, "FACTURER")} disabled={busyAction === c.id} className="flex items-center gap-1 px-2 py-1 text-[11px] text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"><FileText size={11} /> Facturer</button>
                      )}
                      {c.statut === "FACTUREE" && (
                        <a href={`/api/admin/revendeurs/${id}/commandes/${c.id}/facture/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2 py-1 text-[11px] text-purple-600 hover:bg-purple-50 rounded"><FileText size={11} /> Facture</a>
                      )}
                    </div>
                  </div>
                ))}
                {commandes.length === 0 && <p className="text-xs text-slate-400 italic">Aucune commande.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NouvelleCommandeForm({ revendeurId, pointDeVenteId, onCreated }: { revendeurId: number; pointDeVenteId: number | null; onCreated: () => void }) {
  const [lignes, setLignes] = useState<{ produitId: string; quantite: string }[]>([{ produitId: "", quantite: "1" }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const valides = lignes.filter((l) => l.produitId && Number(l.quantite) > 0).map((l) => ({ produitId: Number(l.produitId), quantite: Number(l.quantite) }));
    if (!valides.length) { toast.error("Ajoutez au moins un produit"); return; }
    if (!pointDeVenteId) { toast.error("Ce revendeur n'a pas de point de vente de rattachement"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/revendeurs/${revendeurId}/commandes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointDeVenteId, lignes: valides, notes: notes || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success("Commande créée");
      onCreated();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mb-3 p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2">
      <p className="text-xs text-slate-500">Saisir les identifiants produit (ID) — à défaut, le revendeur peut commander lui-même depuis son espace avec la recherche produit.</p>
      {lignes.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input placeholder="ID produit" value={l.produitId} onChange={(e) => setLignes((ls) => ls.map((x, xi) => xi === i ? { ...x, produitId: e.target.value } : x))} className={inputCls} />
          <input placeholder="Qté" type="number" min={1} value={l.quantite} onChange={(e) => setLignes((ls) => ls.map((x, xi) => xi === i ? { ...x, quantite: e.target.value } : x))} className={inputCls + " max-w-[100px]"} />
        </div>
      ))}
      <button onClick={() => setLignes((ls) => [...ls, { produitId: "", quantite: "1" }])} className="text-xs text-rose-600 hover:underline">+ ajouter une ligne</button>
      <textarea placeholder="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls + " resize-none"} />
      <div className="flex justify-end">
        <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />} Créer la commande
        </button>
      </div>
    </div>
  );
}
