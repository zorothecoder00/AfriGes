"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  Navigation, Phone, MapPin, Wallet, AlertTriangle, Clock, CheckCircle2,
  Target, BookOpen, Loader2, RefreshCw, Banknote, UserPlus, X,
} from "lucide-react";

type Priorite = "URGENTE" | "HAUTE" | "NORMALE";
interface LigneTournee {
  creditId: number; clientId: number; reference: string; clientNom: string; telephone: string;
  quartier: string; formule: string; miseDuJour: number; montantRetard: number;
  montantACollecter: number; echeance: string; retardJours: number; priorite: Priorite;
}
interface ScanData {
  agent: { nom: string; prenom: string };
  date: string;
  objectifsJour: { quinzaine: number; trentaine: number; carnets: number; disponible: boolean };
  clients: LigneTournee[];
}

const fmt = (v: number) => new Intl.NumberFormat("fr-FR").format(Math.round(v));
const BADGE: Record<Priorite, string> = {
  URGENTE: "bg-red-100 text-red-700",
  HAUTE: "bg-amber-100 text-amber-700",
  NORMALE: "bg-blue-100 text-blue-700",
};

interface PayTarget { creditId: number; clientId: number; clientNom: string; montantAttendu: number }

export default function ScanTourneePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [carnetTarget, setCarnetTarget] = useState<{ clientId: number; clientNom: string } | null>(null);
  const [nouveauClientOpen, setNouveauClientOpen] = useState(false);
  const [visitingId, setVisitingId] = useState<number | null>(null);

  const charger = () => {
    fetch(`/api/agent-scan/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Erreur");
        setData(j.data as ScanData); setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur"))
      .finally(() => setLoading(false));
  };
  useEffect(charger, [token]);

  const marquerVisite = async (clientId: number) => {
    setVisitingId(clientId);
    try {
      const r = await fetch(`/api/agent-scan/${token}/visiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Visite enregistrée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setVisitingId(null);
    }
  };

  const totalACollecter = data?.clients.reduce((s, c) => s + c.montantACollecter, 0) ?? 0;
  const urgentes = data?.clients.filter((c) => c.priorite === "URGENTE").length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-tight">Ma journée</h1>
              {data && <p className="text-xs text-slate-500">{data.agent.prenom} {data.agent.nom}</p>}
            </div>
          </div>
          <button onClick={() => { setLoading(true); charger(); }} className="p-2 text-slate-400 hover:text-slate-600" title="Rafraîchir">
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
            <p className="text-slate-700 font-medium">Lien invalide ou expiré</p>
            <p className="text-sm text-slate-400 mt-1">Demandez un nouveau QR à votre responsable.</p>
          </div>
        ) : data ? (
          <>
            <p className="text-xs text-slate-400 -mt-2">
              {new Date(data.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>

            {/* Objectifs du jour */}
            <section className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-4 text-white">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Target className="w-4 h-4" /> Mes objectifs du jour
              </p>
              {data.objectifsJour.disponible ? (
                <div className="grid grid-cols-3 gap-3">
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.quinzaine)}</p><p className="text-[11px] text-indigo-100">Quinzaine</p></div>
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.trentaine)}</p><p className="text-[11px] text-indigo-100">Trentaine</p></div>
                  <div><p className="text-2xl font-bold">{fmt(data.objectifsJour.carnets)}</p><p className="text-[11px] text-indigo-100">Carnets</p></div>
                </div>
              ) : (
                <p className="text-xs text-indigo-100">Objectifs non encore définis par la Direction pour ce mois.</p>
              )}
            </section>

            {/* Résumé collecte */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <MapPin className="w-4 h-4 text-slate-400 mx-auto" />
                <p className="text-xl font-bold text-slate-800 mt-1">{data.clients.length}</p>
                <p className="text-[10px] text-slate-400">à visiter</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-100 text-center">
                <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
                <p className="text-xl font-bold text-red-600 mt-1">{urgentes}</p>
                <p className="text-[10px] text-slate-400">urgentes</p>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-3 border border-indigo-100 text-center">
                <Wallet className="w-4 h-4 text-indigo-500 mx-auto" />
                <p className="text-base font-bold text-indigo-700 mt-1">{fmt(totalACollecter)}</p>
                <p className="text-[10px] text-indigo-400">à collecter</p>
              </div>
            </div>

            {/* Actions rapides */}
            <div className="flex gap-2">
              <button
                onClick={() => setCarnetTarget({ clientId: 0, clientNom: "" })}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <BookOpen className="w-4 h-4 text-indigo-500" /> Vendre un carnet
              </button>
              <button
                onClick={() => setNouveauClientOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <UserPlus className="w-4 h-4 text-indigo-500" /> Nouveau client
              </button>
            </div>

            {/* Clients à visiter */}
            <section>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" /> Clients à visiter (cotisations du jour + retards)
              </p>
              {data.clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-slate-100">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                  <p className="text-slate-700 font-medium">Aucune visite prévue</p>
                  <p className="text-xs text-slate-400 mt-1">Aucune échéance ni retard aujourd&apos;hui.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.clients.map((c) => (
                    <div key={c.creditId} className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{c.clientNom}</p>
                          <p className="text-xs text-slate-400">{c.quartier} · {c.formule}</p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full ${BADGE[c.priorite]}`}>{c.priorite}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <a href={`tel:${c.telephone}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium">
                          <Phone className="w-4 h-4" /> {c.telephone}
                        </a>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{fmt(c.montantACollecter)} F</p>
                          {c.retardJours > 0 && (
                            <p className="text-[11px] text-red-500 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" /> {c.retardJours} j de retard
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                        <button
                          onClick={() => setPayTarget({ creditId: c.creditId, clientId: c.clientId, clientNom: c.clientNom, montantAttendu: c.montantACollecter })}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
                        >
                          <Banknote className="w-3.5 h-3.5" /> Payer
                        </button>
                        <button
                          onClick={() => setCarnetTarget({ clientId: c.clientId, clientNom: c.clientNom })}
                          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50"
                        >
                          Carnet
                        </button>
                        <button
                          onClick={() => marquerVisite(c.clientId)}
                          disabled={visitingId === c.clientId}
                          className="px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                        >
                          {visitingId === c.clientId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Visité"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="text-[11px] text-slate-400 text-center pt-2">
              Généré automatiquement · données de la journée. Ce lien est personnel — ne le partagez pas.
            </p>
          </>
        ) : null}
      </div>

      {payTarget && (
        <ModalPayer token={token} target={payTarget} onClose={() => setPayTarget(null)} onSuccess={charger} />
      )}
      {carnetTarget && (
        <ModalCarnet token={token} target={carnetTarget} onClose={() => setCarnetTarget(null)} onSuccess={charger} />
      )}
      {nouveauClientOpen && (
        <ModalNouveauClient token={token} onClose={() => setNouveauClientOpen(false)} onSuccess={charger} />
      )}
    </div>
  );
}

// ─── Modal Payer un crédit (espèces) ──────────────────────────────────────────

function ModalPayer({ token, target, onClose, onSuccess }: {
  token: string; target: PayTarget; onClose: () => void; onSuccess: () => void;
}) {
  const [montant, setMontant] = useState(String(Math.round(target.montantAttendu)));
  const [submitting, setSubmitting] = useState(false);
  const montantNum = parseFloat(montant) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/agent-scan/${token}/encaisser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditId: target.creditId, montant: montantNum }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Paiement enregistré !");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Payer le crédit</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">{target.clientNom}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant encaissé (espèces) *</label>
            <input type="number" min="1" required value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium">Annuler</button>
            <button type="submit" disabled={submitting || montantNum <= 0}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Vendre un carnet ───────────────────────────────────────────────────

function ModalCarnet({ token, target, onClose, onSuccess }: {
  token: string; target: { clientId: number; clientNom: string }; onClose: () => void; onSuccess: () => void;
}) {
  const [montant, setMontant] = useState("300");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/agent-scan/${token}/carnet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: parseFloat(montant) || 300, clientId: target.clientId || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Vente de carnet enregistrée !");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Vendre un carnet</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {target.clientNom && <p className="text-sm text-slate-600 mb-4">{target.clientNom}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Montant</label>
            <input type="number" min="1" value={montant} onChange={(e) => setMontant(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium">Annuler</button>
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : "Confirmer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal Nouveau client ─────────────────────────────────────────────────────

function ModalNouveauClient({ token, onClose, onSuccess }: {
  token: string; onClose: () => void; onSuccess: () => void;
}) {
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [quartier, setQuartier] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch(`/api/agent-scan/${token}/nouveau-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, prenom, telephone, quartier: quartier || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Client enregistré !");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Nouveau client</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prénom *</label>
              <input type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
              <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone *</label>
            <input type="tel" required value={telephone} onChange={(e) => setTelephone(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quartier</label>
            <input type="text" value={quartier} onChange={(e) => setQuartier(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium">Annuler</button>
            <button type="submit" disabled={submitting || !nom || !prenom || !telephone}
              className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
