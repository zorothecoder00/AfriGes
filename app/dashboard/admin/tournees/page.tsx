"use client";

import { useState } from "react";
import RetourLien from "@/components/RetourLien";
import { Plus, Printer, X, Loader2, PlayCircle, CheckCircle2, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format";

/** Tournées de livraison (CDC digitalisation §5.7) — page admin native. */

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";

interface PDV { id: number; nom: string; code: string }
interface Personne { id: number; nom: string; prenom: string }
interface BonLivraisonDispo { id: number; reference: string; clientNom: string; clientTelephone: string | null; adresseLivraison: string | null }
interface ArretRow {
  id: number; ordre: number; statut: "PLANIFIE" | "EFFECTUE" | "NON_EFFECTUE" | "INCIDENT";
  clientNom: string; clientTelephone: string | null; adresseLivraison: string | null;
  motifNonEffectue: string | null; incidentDescription: string | null;
  bonLivraison: { id: number; reference: string } | null;
}
interface TourneeRow {
  id: number; reference: string; statut: "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE";
  dateTournee: string; moyenTransport: string | null; notes: string | null;
  livreur: Personne; pointDeVente: PDV; arrets: ArretRow[]; createdAt: string;
}
interface TourneesResponse { data: TourneeRow[]; pdvs: PDV[]; livreurs: Personne[]; bonsLivraisonDisponibles: BonLivraisonDispo[] }

const STATUT_LABEL: Record<string, string> = { PLANIFIEE: "Planifiée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée" };
const STATUT_BADGE: Record<string, string> = {
  PLANIFIEE: "bg-amber-100 text-amber-700", EN_COURS: "bg-blue-100 text-blue-700",
  TERMINEE: "bg-emerald-100 text-emerald-700", ANNULEE: "bg-red-100 text-red-600",
};
const ARRET_LABEL: Record<string, string> = { PLANIFIE: "Planifié", EFFECTUE: "Effectué", NON_EFFECTUE: "Non effectué", INCIDENT: "Incident" };
const ARRET_BADGE: Record<string, string> = {
  PLANIFIE: "bg-slate-100 text-slate-600", EFFECTUE: "bg-emerald-100 text-emerald-700",
  NON_EFFECTUE: "bg-orange-100 text-orange-700", INCIDENT: "bg-red-100 text-red-600",
};

export default function AdminTourneesPage() {
  const [statut, setStatut] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (statut) params.set("statut", statut);
  const { data, loading, refetch } = useApi<TourneesResponse>(`/api/logistique/tournees?${params}`);
  const tournees = data?.data ?? [];

  async function action(id: number, body: Record<string, unknown>, successMsg: string) {
    try {
      const res = await fetch(`/api/logistique/tournees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(successMsg);
      refetch();
    } catch { toast.error("Erreur réseau"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tournées de livraison</h1>
          <p className="text-sm text-slate-500 mt-1">Planification et suivi des tournées</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200" title="Rafraîchir" />
          <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Nouvelle tournée</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      </Card>

      <div className="space-y-3">
        {loading && tournees.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
        {!loading && tournees.length === 0 && <p className="text-sm text-slate-400 text-center py-10">Aucune tournée sur ce filtre.</p>}
        {tournees.map((t) => {
          const expanded = expandedId === t.id;
          return (
            <Card key={t.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <button className="text-left flex-1 min-w-0" onClick={() => setExpandedId(expanded ? null : t.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-slate-800 text-sm">{t.reference}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[t.statut]}`}>{STATUT_LABEL[t.statut]}</span>
                    {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{t.livreur.prenom} {t.livreur.nom} — {t.pointDeVente.nom} ({t.pointDeVente.code})</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.arrets.length} arrêt(s) · {formatDateTime(t.dateTournee)} {t.moyenTransport && `· ${t.moyenTransport}`}</p>
                </button>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {t.statut === "PLANIFIEE" && (
                    <button onClick={() => action(t.id, { action: "DEMARRER" }, "Tournée démarrée")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"><PlayCircle size={13} /> Démarrer</button>
                  )}
                  {t.statut === "EN_COURS" && (
                    <button onClick={() => action(t.id, { action: "TERMINER" }, "Tournée terminée")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200"><CheckCircle2 size={13} /> Terminer</button>
                  )}
                  {(t.statut === "PLANIFIEE" || t.statut === "EN_COURS") && (
                    <button onClick={() => action(t.id, { action: "ANNULER" }, "Tournée annulée")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"><Ban size={13} /> Annuler</button>
                  )}
                  <a href={`/api/logistique/tournees/${t.id}/pdf?variante=MISSION`} target="_blank" rel="noreferrer"
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Fiche de mission"><Printer size={15} /></a>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {t.arrets.map((a) => (
                    <ArretItem key={a.id} tourneeId={t.id} tourneeEnCours={t.statut === "EN_COURS"} arret={a} onDone={refetch} />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {showCreate && data && (
        <FormTournee pdvs={data.pdvs} livreurs={data.livreurs} bonsDisponibles={data.bonsLivraisonDisponibles}
          onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); refetch(); }} />
      )}
    </div>
  );
}

function ArretItem({ tourneeId, tourneeEnCours, arret, onDone }: { tourneeId: number; tourneeEnCours: boolean; arret: ArretRow; onDone: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="p-2.5 border border-slate-100 rounded-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="text-sm font-medium text-slate-700">#{arret.ordre} {arret.clientNom}</span>
          <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ARRET_BADGE[arret.statut]}`}>{ARRET_LABEL[arret.statut]}</span>
          {arret.bonLivraison && <span className="ml-2 text-xs text-slate-400 font-mono">{arret.bonLivraison.reference}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {arret.statut === "PLANIFIE" && tourneeEnCours && (
            <button onClick={() => setShowForm(true)} className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200">Constater</button>
          )}
          <a href={`/api/logistique/tournees/${tourneeId}/arrets/${arret.id}/pdf`} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg"><Printer size={13} /></a>
        </div>
      </div>
      {arret.motifNonEffectue && <p className="text-xs text-orange-600 mt-1">Motif : {arret.motifNonEffectue}</p>}
      {arret.incidentDescription && <p className="text-xs text-red-600 mt-1">Incident : {arret.incidentDescription}</p>}
      {showForm && <FormConstaterArret tourneeId={tourneeId} arretId={arret.id} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); onDone(); }} />}
    </div>
  );
}

function FormConstaterArret({ tourneeId, arretId, onClose, onDone }: { tourneeId: number; arretId: number; onClose: () => void; onDone: () => void }) {
  const [statut, setStatut] = useState("EFFECTUE");
  const [motifNonEffectue, setMotifNonEffectue] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (statut === "NON_EFFECTUE" && !motifNonEffectue.trim()) { toast.error("Motif obligatoire"); return; }
    if (statut === "INCIDENT" && !incidentDescription.trim()) { toast.error("Description obligatoire"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/logistique/tournees/${tourneeId}/arrets/${arretId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, motifNonEffectue: motifNonEffectue || undefined, incidentDescription: incidentDescription || undefined }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success("Arrêt constaté");
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[210] p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h4 className="font-bold text-slate-800 text-sm">Constater l&apos;arrêt</h4>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          <select value={statut} onChange={(e) => setStatut(e.target.value)} className={inputCls}>
            <option value="EFFECTUE">Effectué</option>
            <option value="NON_EFFECTUE">Non effectué</option>
            <option value="INCIDENT">Incident</option>
          </select>
          {statut === "NON_EFFECTUE" && (
            <textarea value={motifNonEffectue} onChange={(e) => setMotifNonEffectue(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Motif de non-livraison *" />
          )}
          {statut === "INCIDENT" && (
            <textarea value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Description de l'incident *" />
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button onClick={submit} disabled={submitting} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormTournee({ pdvs, livreurs, bonsDisponibles, onClose, onDone }: {
  pdvs: PDV[]; livreurs: Personne[]; bonsDisponibles: BonLivraisonDispo[]; onClose: () => void; onDone: () => void;
}) {
  const [livreurId, setLivreurId] = useState("");
  const [pointDeVenteId, setPointDeVenteId] = useState("");
  const [dateTournee, setDateTournee] = useState(new Date().toISOString().slice(0, 10));
  const [moyenTransport, setMoyenTransport] = useState("");
  const [notes, setNotes] = useState("");
  const [arretsBL, setArretsBL] = useState<number[]>([]);
  const [manuel, setManuel] = useState({ clientNom: "", clientTelephone: "", adresseLivraison: "" });
  const [arretsManuel, setArretsManuel] = useState<typeof manuel[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function ajouterManuel() {
    if (!manuel.clientNom.trim()) { toast.error("Nom du client requis"); return; }
    setArretsManuel((prev) => [...prev, manuel]);
    setManuel({ clientNom: "", clientTelephone: "", adresseLivraison: "" });
  }

  async function submit() {
    if (!livreurId || !pointDeVenteId) { toast.error("Livreur et point de vente obligatoires"); return; }
    const arrets = [
      ...arretsBL.map((id) => ({ bonLivraisonId: id })),
      ...arretsManuel.map((m) => ({ clientNom: m.clientNom, clientTelephone: m.clientTelephone || undefined, adresseLivraison: m.adresseLivraison || undefined })),
    ];
    if (arrets.length === 0) { toast.error("Ajoutez au moins un arrêt"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/logistique/tournees", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livreurId: Number(livreurId), pointDeVenteId: Number(pointDeVenteId), dateTournee, moyenTransport: moyenTransport || undefined, notes: notes || undefined, arrets }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Tournée ${j.data.reference} créée`);
      onDone();
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">Nouvelle tournée</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Livreur *</label>
              <select value={livreurId} onChange={(e) => setLivreurId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {livreurs.map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Point de vente *</label>
              <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)} className={inputCls}>
                <option value="">Choisir…</option>
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date</label>
              <input type="date" value={dateTournee} onChange={(e) => setDateTournee(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Moyen de transport</label>
              <input value={moyenTransport} onChange={(e) => setMoyenTransport(e.target.value)} className={inputCls} />
            </div>
          </div>

          {bonsDisponibles.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Bons de livraison disponibles</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {bonsDisponibles.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 text-sm p-1.5 border border-slate-100 rounded-lg">
                    <input type="checkbox" checked={arretsBL.includes(b.id)}
                      onChange={(e) => setArretsBL((prev) => e.target.checked ? [...prev, b.id] : prev.filter((id) => id !== b.id))} />
                    {b.reference} — {b.clientNom}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ajouter un arrêt manuel (client sans bon de livraison)</label>
            <div className="grid grid-cols-3 gap-2">
              <input value={manuel.clientNom} onChange={(e) => setManuel((m) => ({ ...m, clientNom: e.target.value }))} className={inputCls} placeholder="Nom client" />
              <input value={manuel.clientTelephone} onChange={(e) => setManuel((m) => ({ ...m, clientTelephone: e.target.value }))} className={inputCls} placeholder="Téléphone" />
              <input value={manuel.adresseLivraison} onChange={(e) => setManuel((m) => ({ ...m, adresseLivraison: e.target.value }))} className={inputCls} placeholder="Adresse" />
            </div>
            <button onClick={ajouterManuel} className="mt-2 text-xs font-medium text-primary-600 hover:underline">+ Ajouter cet arrêt</button>
            {arretsManuel.length > 0 && (
              <ul className="mt-2 space-y-1">
                {arretsManuel.map((m, i) => (
                  <li key={i} className="text-xs text-slate-600 flex justify-between items-center p-1.5 border border-slate-100 rounded-lg">
                    {m.clientNom} {m.adresseLivraison && `— ${m.adresseLivraison}`}
                    <button onClick={() => setArretsManuel((prev) => prev.filter((_, x) => x !== i))}><X size={12} className="text-slate-400" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>
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
