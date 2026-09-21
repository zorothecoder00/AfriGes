"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import RetourLien from "@/components/RetourLien";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, X, RefreshCw, Printer, Loader2, Search,
  PackageX, Repeat, AlertTriangle, ReceiptText, CheckCircle2, Ban, UserCheck,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { LABEL_TYPE_RECLAMATION, LABEL_TYPE_ACTION_RECLAMATION } from "@/lib/reclamationClient";

/** Retours et réclamations client (CDC digitalisation §5.8). */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500";

interface ClientOption { id: number; nom: string; prenom: string; telephone: string | null; codeClient: string | null }
interface ProduitOption { id: number; nom: string; codeProduit: string | null }

interface RetourRow { id: number; numero: string; statut: string }
interface RemplacementRow { id: number; numero: string; statut: string; produitOrigine: { nom: string }; produitRemplacement: { nom: string } }
interface IncidentRow { id: number; numero: string; lieu: string }

interface ReclamationRow {
  id: number;
  numero: string;
  type: string;
  objet: string;
  description: string;
  statut: string;
  sourceReference: string | null;
  createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string | null; codeClient?: string | null };
  pointDeVente: { nom: string; code: string } | null;
  creePar: { nom: string; prenom: string } | null;
  lignes: { produit: { nom: string; codeProduit?: string | null }; quantite: number; motif: string | null }[];
  actions: { id: number; type: string; description: string | null; dateAction: string; auteur: { nom: string; prenom: string } }[];
  retours: RetourRow[];
  remplacements: RemplacementRow[];
  incidents: IncidentRow[];
  avoirs: { id: number; reference: string; montant: string | number; motif: string; dateEmission: string }[];
  assigneA: { id: number; nom: string; prenom: string } | null;
  motifRejet: string | null;
  resumeCloture: string | null;
  clotureLe: string | null;
}

const STATUT_BADGE: Record<string, string> = {
  ENREGISTREE: "bg-blue-100 text-blue-700",
  EN_TRAITEMENT: "bg-amber-100 text-amber-700",
  RESOLUE: "bg-emerald-100 text-emerald-700",
  CLOTUREE: "bg-slate-200 text-slate-600",
  REJETEE: "bg-red-100 text-red-600",
};
const STATUT_LABEL: Record<string, string> = {
  ENREGISTREE: "Enregistrée", EN_TRAITEMENT: "En traitement", RESOLUE: "Résolue", CLOTUREE: "Clôturée", REJETEE: "Rejetée",
};

export default function AdminReclamationsPage() {
  return (
    <Suspense fallback={null}>
      <AdminReclamationsPageInner />
    </Suspense>
  );
}

function AdminReclamationsPageInner() {
  const searchParams = useSearchParams();

  const [statutFiltre, setStatutFiltre] = useState("");
  const apiUrl = `/api/admin/reclamations${statutFiltre ? `?statut=${statutFiltre}` : ""}`;
  const { data, loading, refetch } = useApi<{ data: ReclamationRow[] }>(apiUrl);
  const reclamations = data?.data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Ouvre directement le dossier visé par un lien de notification ou un QR
  // de document scanné (?detail=123), cf. lib/documentQr / composants d'impression.
  useEffect(() => {
    const detail = searchParams.get("detail");
    if (detail) setDetailId(Number(detail));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Création ──────────────────────────────────────────────────────────
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientChoisi, setClientChoisi] = useState<ClientOption | null>(null);
  const [searchingClient, setSearchingClient] = useState(false);
  const [form, setForm] = useState({ type: "PRODUIT_DEFECTUEUX", objet: "", description: "", sourceReference: "" });
  const [creating, setCreating] = useState(false);

  async function rechercherClient(q: string) {
    setClientQuery(q);
    setClientChoisi(null);
    if (q.trim().length < 2) { setClientOptions([]); return; }
    setSearchingClient(true);
    try {
      const r = await fetch(`/api/admin/reclamations/clients-recherche?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (r.ok) setClientOptions(j.data);
    } finally { setSearchingClient(false); }
  }

  function resetCreateForm() {
    setClientQuery(""); setClientOptions([]); setClientChoisi(null);
    setForm({ type: "PRODUIT_DEFECTUEUX", objet: "", description: "", sourceReference: "" });
  }

  async function submitCreate() {
    if (!clientChoisi) { toast.error("Sélectionnez un client"); return; }
    if (!form.objet.trim() || !form.description.trim()) { toast.error("Objet et description obligatoires"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/reclamations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientChoisi.id, ...form }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Réclamation ${j.data.numero} enregistrée`);
      refetch();
      setShowCreate(false);
      resetCreateForm();
      setDetailId(j.data.id);
    } catch { toast.error("Erreur réseau"); }
    finally { setCreating(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50/20 to-white font-['DM_Sans',sans-serif]">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <RetourLien />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Réclamations clients</h2>
            <p className="text-sm text-slate-500">CDC digitalisation §5.8 — réclamations, retours, remplacements, incidents</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={statutFiltre} onChange={(e) => setStatutFiltre(e.target.value)} className="w-44 shrink-0 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500">
              <option value="">Tous les statuts</option>
              {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={() => refetch()} className="shrink-0 p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowCreate(true)} className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium">
              <Plus size={16} /> Nouvelle réclamation
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-slate-400">Chargement…</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reclamations.map((r) => (
            <button key={r.id} onClick={() => setDetailId(r.id)}
              className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between mb-2">
                <p className="font-bold text-slate-800 font-mono text-sm">{r.numero}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[r.statut]}`}>{STATUT_LABEL[r.statut]}</span>
              </div>
              <p className="text-sm text-slate-700 font-medium">{r.objet}</p>
              <p className="text-xs text-slate-500 mt-1">{r.client.prenom} {r.client.nom} · {LABEL_TYPE_RECLAMATION[r.type as keyof typeof LABEL_TYPE_RECLAMATION] ?? r.type}</p>
              {r.pointDeVente && <p className="text-xs text-slate-400 mt-1">{r.pointDeVente.nom} ({r.pointDeVente.code})</p>}
            </button>
          ))}
          {!loading && reclamations.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 text-sm">Aucune réclamation pour le moment.</div>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">Formulaire de réclamation client</h3>
              <button onClick={() => { setShowCreate(false); resetCreateForm(); }}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Client *</label>
                {clientChoisi ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                    <span>{clientChoisi.prenom} {clientChoisi.nom} — {clientChoisi.telephone ?? "—"}</span>
                    <button onClick={() => setClientChoisi(null)}><X size={14} className="text-slate-400" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={clientQuery} onChange={(e) => rechercherClient(e.target.value)}
                      placeholder="Nom, téléphone ou code client…" className={`${inputCls} pl-8`} />
                    {searchingClient && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                    {clientOptions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {clientOptions.map((c) => (
                          <button key={c.id} onClick={() => { setClientChoisi(c); setClientOptions([]); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
                            {c.prenom} {c.nom} — {c.telephone ?? "—"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Type de réclamation *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inputCls}>
                  {Object.entries(LABEL_TYPE_RECLAMATION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Objet *</label>
                <input value={form.objet} onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))} className={inputCls} placeholder="Résumé court" />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Référence vente / facture / crédit (optionnel)</label>
                <input value={form.sourceReference} onChange={(e) => setForm((f) => ({ ...f, sourceReference: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => { setShowCreate(false); resetCreateForm(); }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={submitCreate} disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId !== null && (
        <DetailReclamation
          id={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

// ── Détail d'une réclamation ────────────────────────────────────────────

function DetailReclamation({ id, onClose, onChanged }: {
  id: number; onClose: () => void; onChanged: () => void;
}) {
  const apiUrl = `/api/admin/reclamations/${id}`;
  const { data, loading, refetch } = useApi<{ data: ReclamationRow }>(apiUrl);
  const r = data?.data;

  const [noteType, setNoteType] = useState("NOTE_INTERNE");
  const [noteDesc, setNoteDesc] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showRejet, setShowRejet] = useState(false);
  const [motifRejet, setMotifRejet] = useState("");
  const [showCloture, setShowCloture] = useState(false);
  const [resumeCloture, setResumeCloture] = useState("");
  const [showRetour, setShowRetour] = useState(false);
  const [showRemplacement, setShowRemplacement] = useState(false);
  const [showIncident, setShowIncident] = useState(false);
  const [showAvoir, setShowAvoir] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Traitement physique des retours/remplacements (§5.8) — normalement
  // réservé au Magasinier (/dashboard/user/magasiniers/...) ; exposé ici pour
  // que l'admin puisse gérer l'intégralité du document sans naviguer vers une
  // page "user" (qui lui est de toute façon fermée par le middleware).
  const [busyRetourId, setBusyRetourId] = useState<number | null>(null);
  const [rejetRetourId, setRejetRetourId] = useState<number | null>(null);
  const [motifRejetRetour, setMotifRejetRetour] = useState("");
  const [busyRemplacementId, setBusyRemplacementId] = useState<number | null>(null);
  const [rejetRemplacementId, setRejetRemplacementId] = useState<number | null>(null);
  const [motifRejetRemplacement, setMotifRejetRemplacement] = useState("");

  function refresh() { refetch(); onChanged(); }

  async function actionRetour(retourId: number, body: Record<string, unknown>) {
    setBusyRetourId(retourId);
    try {
      const res = await fetch(`/api/magasinier/retours-client/${retourId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return false; }
      toast.success("Retour mis à jour");
      refresh();
      return true;
    } catch { toast.error("Erreur réseau"); return false; }
    finally { setBusyRetourId(null); }
  }

  async function actionRemplacement(remplacementId: number, body: Record<string, unknown>) {
    setBusyRemplacementId(remplacementId);
    try {
      const res = await fetch(`/api/magasinier/remplacements/${remplacementId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return false; }
      toast.success("Remplacement mis à jour");
      refresh();
      return true;
    } catch { toast.error("Erreur réseau"); return false; }
    finally { setBusyRemplacementId(null); }
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(apiUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return false; }
      toast.success("Mise à jour effectuée");
      refresh();
      return true;
    } catch { toast.error("Erreur réseau"); return false; }
    finally { setBusy(false); }
  }

  async function ajouterNote() {
    if (!noteDesc.trim() && noteType === "NOTE_INTERNE") { toast.error("Description requise"); return; }
    setSubmittingNote(true);
    try {
      const res = await fetch(`${apiUrl}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: noteType, description: noteDesc || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Action enregistrée");
      setNoteDesc("");
      refresh();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmittingNote(false); }
  }

  if (loading || !r) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
        <div className="bg-white rounded-2xl p-8"><Loader2 className="animate-spin text-slate-400" /></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-800 font-mono">{r.numero}</h3>
            <p className="text-xs text-slate-500">{r.client.prenom} {r.client.nom} — {r.objet}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[r.statut]}`}>{STATUT_LABEL[r.statut]}</span>
            <a href={`/api/admin/reclamations/${r.id}/pdf`} target="_blank" rel="noreferrer" title="Imprimer le formulaire" className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={16} /></a>
            <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5 overflow-y-auto">
          <p className="text-sm text-slate-600">{r.description}</p>

          {r.statut !== "CLOTUREE" && r.statut !== "REJETEE" && (
            <div className="flex flex-wrap gap-2">
              {r.statut === "ENREGISTREE" && (
                <button onClick={() => patch({ statut: "EN_TRAITEMENT" })} disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                  <UserCheck size={13} /> Prendre en charge
                </button>
              )}
              {r.statut === "RESOLUE" && (
                <button onClick={() => setShowCloture(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-medium">
                  <CheckCircle2 size={13} /> Clôturer
                </button>
              )}
              <button onClick={() => setShowRetour(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
                <PackageX size={13} /> Fiche de retour
              </button>
              <button onClick={() => setShowRemplacement(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
                <Repeat size={13} /> Bon de remplacement
              </button>
              <button onClick={() => setShowAvoir(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
                <ReceiptText size={13} /> Émettre un avoir
              </button>
              <button onClick={() => setShowRejet(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                <Ban size={13} /> Rejeter
              </button>
            </div>
          )}

          <button onClick={() => setShowIncident(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium">
            <AlertTriangle size={13} /> Déclarer un incident
          </button>

          {/* Journal de traitement */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Traitement</h4>
              <a href={`/api/admin/reclamations/${id}/traitement/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <Printer size={12} /> {r.statut === "CLOTUREE" ? "Fiche de clôture" : "Fiche de traitement"}
              </a>
            </div>
            {r.statut !== "CLOTUREE" && r.statut !== "REJETEE" && (
              <div className="flex gap-2 mb-3">
                <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className={`${inputCls} w-auto`}>
                  {Object.entries(LABEL_TYPE_ACTION_RECLAMATION).filter(([k]) => !["REJET", "CLOTURE", "AVOIR_EMIS"].includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} placeholder="Note…" className={inputCls} />
                <button onClick={ajouterNote} disabled={submittingNote} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-50 shrink-0">
                  {submittingNote ? <Loader2 size={13} className="animate-spin" /> : "Ajouter"}
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              {r.actions.map((a) => (
                <div key={a.id} className="text-xs p-2 border border-slate-100 rounded-lg">
                  <span className="font-medium text-slate-700">{LABEL_TYPE_ACTION_RECLAMATION[a.type as keyof typeof LABEL_TYPE_ACTION_RECLAMATION] ?? a.type}</span>
                  {a.description && <span className="text-slate-500"> — {a.description}</span>}
                  <span className="text-slate-400"> · {new Date(a.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {a.auteur.prenom} {a.auteur.nom}</span>
                </div>
              ))}
            </div>
          </div>

          {r.retours.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Retours marchandise</h4>
              <div className="space-y-1.5">
                {r.retours.map((d) => (
                  <div key={d.id} className="text-xs p-2 border border-slate-100 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <span>{d.numero} — {STATUT_LABEL_RETOUR[d.statut] ?? d.statut}</span>
                    <div className="flex items-center gap-1.5">
                      {d.statut === "DECLARE" && (
                        <button onClick={() => actionRetour(d.id, { action: "RECEPTIONNER" })} disabled={busyRetourId === d.id}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-medium hover:bg-amber-200 disabled:opacity-50">Réceptionner</button>
                      )}
                      {d.statut === "RECEPTIONNE" && (
                        <button onClick={() => actionRetour(d.id, { action: "VALIDER" })} disabled={busyRetourId === d.id}
                          className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-medium hover:bg-emerald-200 disabled:opacity-50">Valider (Bon de retour)</button>
                      )}
                      {(d.statut === "DECLARE" || d.statut === "RECEPTIONNE") && (
                        <button onClick={() => setRejetRetourId(d.id)} disabled={busyRetourId === d.id}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded-md font-medium hover:bg-red-100 disabled:opacity-50">Rejeter</button>
                      )}
                      <a href={`/api/admin/reclamations/${id}/retours/${d.id}/pdf`} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={13} /></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.remplacements.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Remplacements</h4>
              <div className="space-y-1.5">
                {r.remplacements.map((d) => (
                  <div key={d.id} className="text-xs p-2 border border-slate-100 rounded-lg flex items-center justify-between gap-2 flex-wrap">
                    <span>{d.numero} — {d.produitOrigine.nom} → {d.produitRemplacement.nom} ({STATUT_LABEL_REMPLACEMENT[d.statut] ?? d.statut})</span>
                    <div className="flex items-center gap-1.5">
                      {d.statut === "DEMANDE" && (
                        <button onClick={() => actionRemplacement(d.id, { action: "APPROUVER" })} disabled={busyRemplacementId === d.id}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-medium hover:bg-amber-200 disabled:opacity-50">Approuver</button>
                      )}
                      {d.statut === "APPROUVE" && (
                        <button onClick={() => actionRemplacement(d.id, { action: "LIVRER" })} disabled={busyRemplacementId === d.id}
                          className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md font-medium hover:bg-emerald-200 disabled:opacity-50">Livrer</button>
                      )}
                      {(d.statut === "DEMANDE" || d.statut === "APPROUVE") && (
                        <button onClick={() => setRejetRemplacementId(d.id)} disabled={busyRemplacementId === d.id}
                          className="px-2 py-1 bg-red-50 text-red-600 rounded-md font-medium hover:bg-red-100 disabled:opacity-50">Rejeter</button>
                      )}
                      <a href={`/api/admin/reclamations/${id}/remplacements/${d.id}/pdf`} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={13} /></a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.incidents.length > 0 && (
            <ListeSection title="Incidents" items={r.incidents}
              hrefFor={(d) => `/api/admin/reclamations/incidents/${d.id}/pdf`}
              renderLabel={(d) => `${d.numero} — ${d.lieu}`} />
          )}
          {r.avoirs.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Avoirs émis</h4>
              <div className="space-y-1.5">
                {r.avoirs.map((a) => (
                  <div key={a.id} className="text-xs p-2 border border-slate-100 rounded-lg flex justify-between">
                    <span>{a.reference} — {a.motif}</span>
                    <span className="font-medium">{Number(a.montant).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.resumeCloture && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
              <p className="font-semibold text-slate-700 mb-1">Résumé de clôture</p>
              {r.resumeCloture}
            </div>
          )}
          {r.motifRejet && (
            <div className="p-3 bg-red-50 rounded-lg text-xs text-red-600">
              <p className="font-semibold mb-1">Motif de rejet</p>
              {r.motifRejet}
            </div>
          )}
        </div>
      </div>

      {showRejet && (
        <MiniModal title="Rejeter la réclamation" onClose={() => setShowRejet(false)}
          onConfirm={async () => { if (await patch({ statut: "REJETEE", motifRejet })) { setShowRejet(false); setMotifRejet(""); } }}
          confirmLabel="Rejeter" confirmClass="bg-red-600 hover:bg-red-700">
          <textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" />
        </MiniModal>
      )}

      {showCloture && (
        <MiniModal title="Clôturer la réclamation" onClose={() => setShowCloture(false)}
          onConfirm={async () => { if (await patch({ statut: "CLOTUREE", resumeCloture })) { setShowCloture(false); setResumeCloture(""); } }}
          confirmLabel="Clôturer" confirmClass="bg-slate-700 hover:bg-slate-800">
          <textarea value={resumeCloture} onChange={(e) => setResumeCloture(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Résumé de clôture *" />
        </MiniModal>
      )}

      {rejetRetourId !== null && (
        <MiniModal title="Rejeter le retour marchandise" onClose={() => { setRejetRetourId(null); setMotifRejetRetour(""); }}
          onConfirm={async () => { if (await actionRetour(rejetRetourId, { action: "REJETER", motifRejet: motifRejetRetour })) { setRejetRetourId(null); setMotifRejetRetour(""); } }}
          confirmLabel="Rejeter" confirmClass="bg-red-600 hover:bg-red-700">
          <textarea value={motifRejetRetour} onChange={(e) => setMotifRejetRetour(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" />
        </MiniModal>
      )}

      {rejetRemplacementId !== null && (
        <MiniModal title="Rejeter le remplacement" onClose={() => { setRejetRemplacementId(null); setMotifRejetRemplacement(""); }}
          onConfirm={async () => { if (await actionRemplacement(rejetRemplacementId, { action: "REJETER", motifRejet: motifRejetRemplacement })) { setRejetRemplacementId(null); setMotifRejetRemplacement(""); } }}
          confirmLabel="Rejeter" confirmClass="bg-red-600 hover:bg-red-700">
          <textarea value={motifRejetRemplacement} onChange={(e) => setMotifRejetRemplacement(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Motif du rejet *" />
        </MiniModal>
      )}

      {showRetour && (
        <FormRetour reclamationId={id} onClose={() => setShowRetour(false)} onDone={() => { setShowRetour(false); refresh(); }} />
      )}
      {showRemplacement && (
        <FormRemplacement reclamationId={id} onClose={() => setShowRemplacement(false)} onDone={() => { setShowRemplacement(false); refresh(); }} />
      )}
      {showIncident && (
        <FormIncident reclamationId={id} onClose={() => setShowIncident(false)} onDone={() => { setShowIncident(false); refresh(); }} />
      )}
      {showAvoir && (
        <FormAvoir clientId={r.client.id} reclamationId={id} onClose={() => setShowAvoir(false)} onDone={() => { setShowAvoir(false); refresh(); }} />
      )}
    </div>
  );
}

const STATUT_LABEL_RETOUR: Record<string, string> = { DECLARE: "Déclaré", RECEPTIONNE: "Réceptionné", VALIDE: "Bon de retour validé", REJETE: "Rejeté" };
const STATUT_LABEL_REMPLACEMENT: Record<string, string> = { DEMANDE: "Demandé", APPROUVE: "Approuvé", LIVRE: "Livré", REJETE: "Rejeté" };

function ListeSection<T extends { id: number }>({ title, items, hrefFor, renderLabel }: {
  title: string; items: T[]; hrefFor: (item: T) => string; renderLabel: (item: T) => string;
}) {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="text-xs p-2 border border-slate-100 rounded-lg flex justify-between items-center">
            <span>{renderLabel(it)}</span>
            <a href={hrefFor(it)} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={13} /></a>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniModal({ title, children, onClose, onConfirm, confirmLabel, confirmClass }: {
  title: string; children: ReactNode; onClose: () => void; onConfirm: () => void; confirmLabel: string; confirmClass: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={onConfirm} className={`px-3 py-1.5 text-white rounded-lg text-xs font-medium ${confirmClass}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function useProduitSearch() {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProduitOption[]>([]);
  const [searching, setSearching] = useState(false);
  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setOptions([]); return; }
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/reclamations/produits-recherche?q=${encodeURIComponent(q)}`);
      const j = await r.json();
      if (r.ok) setOptions(j.data);
    } finally { setSearching(false); }
  }
  return { query, options, searching, search, setOptions };
}

function FormRetour({ reclamationId, onClose, onDone }: { reclamationId: number; onClose: () => void; onDone: () => void }) {
  const produitSearch = useProduitSearch();
  const [produit, setProduit] = useState<ProduitOption | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [etatProduit, setEtatProduit] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!produit) { toast.error("Sélectionnez un produit"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/reclamations/${reclamationId}/retours`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignes: [{ produitId: produit.id, quantite: Number(quantite), etatProduit: etatProduit || undefined }] }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Fiche de retour ${j.data.numero} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <MiniModal title="Fiche de retour marchandise" onClose={onClose} onConfirm={submit} confirmLabel={submitting ? "…" : "Créer"} confirmClass="bg-slate-700 hover:bg-slate-800">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Produit retourné</label>
        <ProduitPicker produit={produit} setProduit={setProduit} search={produitSearch} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Quantité retournée</label>
        <input type="number" min={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={inputCls} placeholder="Quantité" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">État constaté (optionnel)</label>
        <input value={etatProduit} onChange={(e) => setEtatProduit(e.target.value)} className={inputCls} placeholder="Ex. emballage ouvert, produit périmé…" />
      </div>
    </MiniModal>
  );
}

function FormRemplacement({ reclamationId, onClose, onDone }: { reclamationId: number; onClose: () => void; onDone: () => void }) {
  const searchOrigine = useProduitSearch();
  const searchNouveau = useProduitSearch();
  const [produitOrigine, setProduitOrigine] = useState<ProduitOption | null>(null);
  const [produitRemplacement, setProduitRemplacement] = useState<ProduitOption | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!produitOrigine || !produitRemplacement) { toast.error("Sélectionnez les deux produits"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/admin/reclamations/${reclamationId}/remplacements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produitOrigineId: produitOrigine.id, produitRemplacementId: produitRemplacement.id, quantite: Number(quantite) }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Bon de remplacement ${j.data.numero} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <MiniModal title="Bon de remplacement" onClose={onClose} onConfirm={submit} confirmLabel={submitting ? "…" : "Créer"} confirmClass="bg-slate-700 hover:bg-slate-800">
      <p className="text-xs text-slate-500">Produit défectueux</p>
      <ProduitPicker produit={produitOrigine} setProduit={setProduitOrigine} search={searchOrigine} />
      <p className="text-xs text-slate-500">Produit de remplacement</p>
      <ProduitPicker produit={produitRemplacement} setProduit={setProduitRemplacement} search={searchNouveau} />
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Quantité à remplacer</label>
        <input type="number" min={1} value={quantite} onChange={(e) => setQuantite(e.target.value)} className={inputCls} placeholder="Quantité" />
      </div>
    </MiniModal>
  );
}

function FormIncident({ reclamationId, onClose, onDone }: { reclamationId: number; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState("AUTRE");
  const [lieu, setLieu] = useState("");
  const [description, setDescription] = useState("");
  const [dateIncident, setDateIncident] = useState(new Date().toISOString().slice(0, 16));
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!lieu.trim() || !description.trim()) { toast.error("Lieu et description obligatoires"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/reclamations/incidents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reclamationId, type, lieu, description, dateIncident }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Rapport d'incident ${j.data.numero} créé`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <MiniModal title="Rapport d'incident" onClose={onClose} onConfirm={submit} confirmLabel={submitting ? "…" : "Créer"} confirmClass="bg-slate-700 hover:bg-slate-800">
      <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
        <option value="LIVRAISON">Livraison</option>
        <option value="PRODUIT">Produit</option>
        <option value="COMPORTEMENT_CLIENT">Comportement client</option>
        <option value="COMPORTEMENT_AGENT">Comportement agent</option>
        <option value="AUTRE">Autre</option>
      </select>
      <input type="datetime-local" value={dateIncident} onChange={(e) => setDateIncident(e.target.value)} className={inputCls} />
      <input value={lieu} onChange={(e) => setLieu(e.target.value)} className={inputCls} placeholder="Lieu *" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Description *" />
    </MiniModal>
  );
}

function FormAvoir({ clientId, reclamationId, onClose, onDone }: { clientId?: number; reclamationId: number; onClose: () => void; onDone: () => void }) {
  const [montant, setMontant] = useState("");
  const [motif, setMotif] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!clientId) { toast.error("Client introuvable"); return; }
    if (!montant || Number(montant) <= 0 || !motif.trim()) { toast.error("Montant et motif obligatoires"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/comptable/clients/${clientId}/avoirs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: Number(montant), motif, reclamationId }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Avoir ${j.data.reference} émis`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <MiniModal title="Émettre un avoir client" onClose={onClose} onConfirm={submit} confirmLabel={submitting ? "…" : "Émettre"} confirmClass="bg-emerald-600 hover:bg-emerald-700">
      <input type="number" min={1} value={montant} onChange={(e) => setMontant(e.target.value)} className={inputCls} placeholder="Montant (FCFA) *" />
      <input value={motif} onChange={(e) => setMotif(e.target.value)} className={inputCls} placeholder="Motif *" />
    </MiniModal>
  );
}

function ProduitPicker({ produit, setProduit, search }: {
  produit: ProduitOption | null;
  setProduit: (p: ProduitOption | null) => void;
  search: ReturnType<typeof useProduitSearch>;
}) {
  if (produit) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
        <span>{produit.nom}</span>
        <button onClick={() => setProduit(null)}><X size={14} className="text-slate-400" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={search.query} onChange={(e) => search.search(e.target.value)} placeholder="Rechercher un produit…" className={inputCls} />
      {search.options.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
          {search.options.map((p) => (
            <button key={p.id} onClick={() => { setProduit(p); search.setOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
              {p.nom} {p.codeProduit ? `(${p.codeProduit})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
