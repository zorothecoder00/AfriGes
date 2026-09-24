"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import {
  Truck, X, RefreshCw, Plus, Trash2, Loader2, PlayCircle, StopCircle, Ban,
  Printer, CheckCircle2, AlertTriangle, XCircle, BarChart3,
} from "lucide-react";

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

interface PDV { id: number; nom: string; code: string }
interface Livreur { id: number; nom: string; prenom: string }
interface BLDispo { id: number; reference: string; clientNom: string; clientTelephone: string | null; adresseLivraison: string | null }
interface ArretTournee {
  id: number; ordre: number; statut: string; clientNom: string; adresseLivraison: string | null;
}
interface TourneeData { id: number; reference: string; statut: string; dateTournee: string; livreur: { nom: string; prenom: string }; pointDeVente: { nom: string; code: string }; arrets: ArretTournee[] }
interface TourneesResponse { data: TourneeData[]; pdvs: PDV[]; livreurs: Livreur[]; bonsLivraisonDisponibles: BLDispo[] }

const STATUT_TRN: Record<string, { label: string; badge: string }> = {
  PLANIFIEE: { label: "Planifiée", badge: "bg-slate-100 text-slate-600" },
  EN_COURS: { label: "En cours", badge: "bg-blue-100 text-blue-700" },
  TERMINEE: { label: "Terminée", badge: "bg-emerald-100 text-emerald-700" },
  ANNULEE: { label: "Annulée", badge: "bg-red-100 text-red-600" },
};
const STATUT_ARRET: Record<string, { label: string; badge: string; icon: typeof CheckCircle2 }> = {
  PLANIFIE: { label: "Planifié", badge: "bg-slate-100 text-slate-500", icon: Truck },
  EFFECTUE: { label: "Effectué", badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  NON_EFFECTUE: { label: "Non effectué", badge: "bg-amber-100 text-amber-700", icon: XCircle },
  INCIDENT: { label: "Incident", badge: "bg-red-100 text-red-700", icon: AlertTriangle },
};

type Tab = "tournees" | "rapport";

export default function TourneesPage() {
  return (
    <Suspense fallback={null}>
      <TourneesPageInner />
    </Suspense>
  );
}

function TourneesPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>("tournees");
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, loading, refetch } = useApi<TourneesResponse>("/api/logistique/tournees");
  const tournees = data?.data ?? [];
  const pdvs = data?.pdvs ?? [];
  const livreurs = data?.livreurs ?? [];
  const bonsLivraisonDisponibles = data?.bonsLivraisonDisponibles ?? [];

  // Ouvre directement la tournée visée par un lien de notification ou un QR
  // de document scanné (?tournee=123).
  useEffect(() => {
    const tournee = searchParams.get("tournee");
    if (tournee) setDetailId(Number(tournee));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detailTournee = tournees.find((t) => t.id === detailId) ?? null;

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Truck className="text-blue-600" /> Tournées de livraison</h1>
            <p className="text-sm text-slate-500">Logistique avancée</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => refetch()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
              <Plus size={16} /> Nouvelle tournée
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {(["tournees", "rapport"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {t === "tournees" ? "Tournées" : "Rapport de livraison"}
            </button>
          ))}
        </div>

        {tab === "tournees" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournees.map((t) => {
              const st = STATUT_TRN[t.statut] ?? { label: t.statut, badge: "bg-slate-100 text-slate-500" };
              const nbEffectues = t.arrets.filter((a) => a.statut === "EFFECTUE").length;
              return (
                <button key={t.id} onClick={() => setDetailId(t.id)}
                  className="text-left bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs text-slate-500">{t.reference}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                  </div>
                  <p className="font-bold text-slate-800">{t.livreur.prenom} {t.livreur.nom}</p>
                  <p className="text-xs text-slate-400 mt-1">{t.pointDeVente.nom} · {formatDate(t.dateTournee)}</p>
                  <p className="text-xs text-slate-500 mt-2">{nbEffectues} / {t.arrets.length} arrêt(s) effectué(s)</p>
                </button>
              );
            })}
            {!loading && tournees.length === 0 && <div className="col-span-full text-center py-12 text-slate-400 text-sm">Aucune tournée planifiée.</div>}
          </div>
        )}

        {tab === "rapport" && <RapportLivraison livreurs={livreurs} />}
      </div>

      {showCreate && (
        <NouvelleTourneeModal pdvs={pdvs} livreurs={livreurs} bonsLivraisonDisponibles={bonsLivraisonDisponibles}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refetch(); }} />
      )}

      {detailTournee && (
        <TourneeDetailModal tournee={detailTournee} onClose={() => setDetailId(null)} onChanged={refetch} />
      )}
    </div>
  );
}

// ── Nouvelle tournée ────────────────────────────────────────────────────────

function NouvelleTourneeModal({ pdvs, livreurs, bonsLivraisonDisponibles, onClose, onCreated }: {
  pdvs: PDV[]; livreurs: Livreur[]; bonsLivraisonDisponibles: BLDispo[];
  onClose: () => void; onCreated: () => void;
}) {
  const [livreurId, setLivreurId] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [moyenTransport, setMoyenTransport] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedBL, setSelectedBL] = useState<number[]>([]);
  const [manuels, setManuels] = useState<{ clientNom: string; clientTelephone: string; adresseLivraison: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleBL(id: number) {
    setSelectedBL((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }

  async function submit() {
    if (!livreurId || !pointDeVenteId) { toast.error("Livreur et point de vente obligatoires"); return; }
    const arrets = [
      ...selectedBL.map((id) => ({ bonLivraisonId: id })),
      ...manuels.filter((m) => m.clientNom.trim()).map((m) => ({ clientNom: m.clientNom, clientTelephone: m.clientTelephone || undefined, adresseLivraison: m.adresseLivraison || undefined })),
    ];
    if (!arrets.length) { toast.error("Ajoutez au moins un arrêt"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/logistique/tournees", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livreurId: Number(livreurId), pointDeVenteId: Number(pointDeVenteId), moyenTransport: moyenTransport || undefined, notes: notes || undefined, arrets }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success(`Tournée ${j.data.reference} créée`);
      onCreated();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Nouvelle tournée</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Livreur *</label>
              <select value={livreurId} onChange={(e) => setLivreurId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {livreurs.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
              </select></div>
            <div><label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select></div>
          </div>
          <input placeholder="Moyen de transport (moto, camionnette…)" value={moyenTransport} onChange={(e) => setMoyenTransport(e.target.value)} className={inputCls} />
          <textarea placeholder="Notes / instructions" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls + " resize-none"} />

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Arrêts depuis un bon de livraison</p>
            <div className="space-y-1 max-h-40 overflow-y-auto border border-slate-100 rounded-lg p-2">
              {bonsLivraisonDisponibles.map((bl) => (
                <label key={bl.id} className="flex items-center gap-2 text-sm px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                  <input type="checkbox" checked={selectedBL.includes(bl.id)} onChange={() => toggleBL(bl.id)} />
                  <span className="font-mono text-xs text-slate-400">{bl.reference}</span>
                  <span className="flex-1">{bl.clientNom}</span>
                </label>
              ))}
              {bonsLivraisonDisponibles.length === 0 && <p className="text-xs text-slate-400 italic px-2 py-1">Aucun bon de livraison disponible.</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Arrêts manuels (hors commande)</p>
              <button onClick={() => setManuels((m) => [...m, { clientNom: "", clientTelephone: "", adresseLivraison: "" }])} className="text-xs text-blue-600 hover:underline">+ ajouter</button>
            </div>
            {manuels.map((m, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input placeholder="Client" value={m.clientNom} onChange={(e) => setManuels((ms) => ms.map((x, xi) => xi === i ? { ...x, clientNom: e.target.value } : x))} className={inputCls} />
                <input placeholder="Téléphone" value={m.clientTelephone} onChange={(e) => setManuels((ms) => ms.map((x, xi) => xi === i ? { ...x, clientTelephone: e.target.value } : x))} className={inputCls} />
                <input placeholder="Adresse" value={m.adresseLivraison} onChange={(e) => setManuels((ms) => ms.map((x, xi) => xi === i ? { ...x, adresseLivraison: e.target.value } : x))} className={inputCls} />
                <button onClick={() => setManuels((ms) => ms.filter((_, xi) => xi !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la tournée
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Détail tournée ──────────────────────────────────────────────────────────

function TourneeDetailModal({ tournee, onClose, onChanged }: {
  tournee: TourneeData; onClose: () => void; onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [constatArretId, setConstatArretId] = useState<number | null>(null);

  async function action(a: "DEMARRER" | "TERMINER" | "ANNULER") {
    setBusy(true);
    try {
      const r = await fetch(`/api/logistique/tournees/${tournee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: a }) });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success("Tournée mise à jour");
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[190] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900">{tournee.reference}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUT_TRN[tournee.statut]?.badge}`}>{STATUT_TRN[tournee.statut]?.label}</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            {tournee.statut === "PLANIFIEE" && <button onClick={() => action("DEMARRER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 disabled:opacity-50"><PlayCircle size={13} /> Démarrer</button>}
            {tournee.statut === "EN_COURS" && <button onClick={() => action("TERMINER")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"><StopCircle size={13} /> Terminer</button>}
            {(tournee.statut === "PLANIFIEE" || tournee.statut === "EN_COURS") && <button onClick={() => { if (confirm("Annuler cette tournée ?")) action("ANNULER"); }} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 disabled:opacity-50"><Ban size={13} /> Annuler</button>}
            <span className="flex-1" />
            <a href={`/api/logistique/tournees/${tournee.id}/pdf?variante=MISSION`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"><Printer size={12} /> Mission</a>
            <a href={`/api/logistique/tournees/${tournee.id}/pdf?variante=CHARGEMENT`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"><Printer size={12} /> Chargement</a>
            <a href={`/api/logistique/tournees/${tournee.id}/pdf?variante=BORDEREAU`} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg"><Printer size={12} /> Bordereau</a>
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-2">Arrêts ({tournee.arrets.length})</h4>
            <div className="space-y-2">
              {tournee.arrets.map((a) => {
                const st = STATUT_ARRET[a.statut] ?? STATUT_ARRET.PLANIFIE;
                const Icon = st.icon;
                return (
                  <div key={a.id} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">#{a.ordre}</span>
                        <span className="text-sm font-medium text-slate-700">{a.clientNom}</span>
                      </div>
                      <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge}`}><Icon size={11} /> {st.label}</span>
                    </div>
                    {a.adresseLivraison && <p className="text-xs text-slate-400 mt-1">{a.adresseLivraison}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      {a.statut === "PLANIFIE" && tournee.statut === "EN_COURS" && (
                        <button onClick={() => setConstatArretId(a.id)} className="text-xs text-blue-600 hover:underline">Constater</button>
                      )}
                      {a.statut !== "PLANIFIE" && (
                        <a href={`/api/logistique/tournees/${tournee.id}/arrets/${a.id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700"><Printer size={11} /> Imprimer</a>
                      )}
                    </div>
                    {constatArretId === a.id && (
                      <ConstatArretForm tourneeId={tournee.id} arretId={a.id}
                        onDone={() => { setConstatArretId(null); onChanged(); }}
                        onCancel={() => setConstatArretId(null)} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConstatArretForm({ tourneeId, arretId, onDone, onCancel }: { tourneeId: number; arretId: number; onDone: () => void; onCancel: () => void }) {
  const [statut, setStatut] = useState<"EFFECTUE" | "NON_EFFECTUE" | "INCIDENT">("EFFECTUE");
  const [motif, setMotif] = useState("");
  const [incident, setIncident] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (statut === "NON_EFFECTUE" && !motif.trim()) { toast.error("Motif requis"); return; }
    if (statut === "INCIDENT" && !incident.trim()) { toast.error("Description requise"); return; }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/logistique/tournees/${tourneeId}/arrets/${arretId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, motifNonEffectue: motif || undefined, incidentDescription: incident || undefined, signatureClientNom: signature || undefined }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error); return; }
      toast.success("Arrêt constaté");
      onDone();
    } finally { setSubmitting(false); }
  }

  return (
    <div className="mt-3 p-3 bg-slate-50 rounded-lg space-y-2">
      <select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={inputCls}>
        <option value="EFFECTUE">Livraison effectuée</option>
        <option value="NON_EFFECTUE">Livraison non effectuée</option>
        <option value="INCIDENT">Incident</option>
      </select>
      {statut === "EFFECTUE" && <input placeholder="Réceptionné par" value={signature} onChange={(e) => setSignature(e.target.value)} className={inputCls} />}
      {statut === "NON_EFFECTUE" && <textarea placeholder="Motif" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} className={inputCls + " resize-none"} />}
      {statut === "INCIDENT" && <textarea placeholder="Description de l'incident" rows={2} value={incident} onChange={(e) => setIncident(e.target.value)} className={inputCls + " resize-none"} />}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
        <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
          {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Valider
        </button>
      </div>
    </div>
  );
}

// ── Rapport ──────────────────────────────────────────────────────────────────

function RapportLivraison({ livreurs }: { livreurs: Livreur[] }) {
  const [livreurId, setLivreurId] = useState("");
  const query = livreurId ? `?livreurId=${livreurId}` : "";
  const { data, loading } = useApi<{
    global: { nbTournees: number; nbArrets: number; nbEffectues: number; nbNonEffectues: number; nbIncidents: number; nbPlanifies: number; tauxReussite: number };
    parLivreur: { livreurId: number; nom: string; nbTournees: number; nbArrets: number; nbEffectues: number; nbNonEffectues: number; nbIncidents: number }[];
  }>(`/api/logistique/tournees/rapport${query}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="text-blue-600" size={20} />
        <select value={livreurId} onChange={(e) => setLivreurId(e.target.value)} className={inputCls + " max-w-xs"}>
          <option value="">Tous les livreurs</option>
          {livreurs.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
        </select>
      </div>

      {loading && <p className="text-sm text-slate-400">Chargement…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Tournées", value: data.global.nbTournees, solid: "bg-indigo-700 border-indigo-800" },
              { label: "Arrêts", value: data.global.nbArrets, solid: "bg-sky-700 border-sky-800" },
              { label: "Effectués", value: data.global.nbEffectues, solid: "bg-emerald-700 border-emerald-800" },
              { label: "Non effectués", value: data.global.nbNonEffectues, solid: "bg-amber-600 border-amber-700" },
              { label: "Incidents", value: data.global.nbIncidents, solid: "bg-red-700 border-red-800" },
            ].map((k) => (
              <div key={k.label} className={`${k.solid} rounded-xl p-4 shadow-sm border text-center`}>
                <p className="text-xs text-white/80">{k.label}</p>
                <p className="text-xl font-bold text-white">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-700 border-blue-800 shadow-sm rounded-xl p-4 text-center border">
            <p className="text-sm text-white/80">Taux de réussite des livraisons constatées</p>
            <p className="text-3xl font-bold text-white">{data.global.tauxReussite}%</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-600 text-xs">Livreur</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-xs">Tournées</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-xs">Arrêts</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-xs">Effectués</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-xs">Non effectués</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 text-xs">Incidents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.parLivreur.map((l) => (
                  <tr key={l.livreurId}>
                    <td className="px-4 py-2.5">{l.nom}</td>
                    <td className="text-center px-4 py-2.5">{l.nbTournees}</td>
                    <td className="text-center px-4 py-2.5">{l.nbArrets}</td>
                    <td className="text-center px-4 py-2.5 text-emerald-600 font-medium">{l.nbEffectues}</td>
                    <td className="text-center px-4 py-2.5 text-amber-600">{l.nbNonEffectues}</td>
                    <td className="text-center px-4 py-2.5 text-red-600">{l.nbIncidents}</td>
                  </tr>
                ))}
                {data.parLivreur.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Aucune donnée</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
