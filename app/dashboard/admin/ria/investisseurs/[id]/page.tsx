"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, User, Phone, Mail, MapPin, Briefcase, Globe,
  Wallet, TrendingUp, Plus, ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Portefeuille {
  id: number; reference: string; nom: string | null; actif: boolean;
  capitalInvesti: number; capitalDisponible: number; capitalEngage: number; capitalRecouvre: number;
  beneficesGeneres: number; beneficesDistribues: number; fondSecurite: number;
  depots:   { id: number; reference: string; montant: number; statut: string; createdAt: string }[];
  retraits: { id: number; reference: string; montant: number; statut: string; createdAt: string }[];
}

interface Investisseur {
  id: number;
  member: { id: number; nom: string; prenom: string; email: string; telephone: string | null; adresse: string | null; etat: string; dateAdhesion: string };
  profilRIA: {
    id: number; profession: string | null; pays: string | null; pieceIdentiteUrl: string | null; notes: string | null;
    portefeuilles: Portefeuille[];
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const toNum = (v: unknown) => Number(v ?? 0);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const STATUT_BADGE: Record<string, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  VALIDE:     "bg-emerald-50 text-emerald-700",
  PAYE:       "bg-blue-50 text-blue-700",
  REJETE:     "bg-red-50 text-red-600",
};

// ── Modal ajout portefeuille ──────────────────────────────────────────────────

function AddPortefeuilleModal({ profilRIAId, onClose, onSuccess }: {
  profilRIAId: number; onClose: () => void; onSuccess: () => void;
}) {
  const [nom, setNom] = useState("");
  const [notes, setNotes] = useState("");
  const mut = useMutation<{ data: unknown }, { profilRIAId: number; nom: string; notes: string }>("/api/admin/ria/portefeuilles", "POST");

  const submit = async () => {
    const res = await mut.mutate({ profilRIAId, nom, notes });
    if (res) { toast.success("Portefeuille créé"); onSuccess(); onClose(); }
    else toast.error(mut.error ?? "Erreur");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-900">Nouveau portefeuille</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nom du portefeuille</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex: Portefeuille RIA 2026"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={submit} disabled={mut.loading}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {mut.loading ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carte portefeuille ────────────────────────────────────────────────────────

function PortefeuilleCard({ pf }: { pf: Portefeuille }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
      <div className="bg-slate-50 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">{pf.nom ?? pf.reference}</p>
          <p className="text-xs text-slate-400 font-mono">{pf.reference}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${pf.actif ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
            {pf.actif ? "Actif" : "Inactif"}
          </span>
          <button onClick={() => setExpanded((v) => !v)} className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div><p className="text-xs text-slate-400">Capital investi</p><p className="font-semibold text-slate-900">{fmt(toNum(pf.capitalInvesti))} F</p></div>
        <div><p className="text-xs text-slate-400">Disponible</p><p className="font-semibold text-emerald-700">{fmt(toNum(pf.capitalDisponible))} F</p></div>
        <div><p className="text-xs text-slate-400">Engagé</p><p className="font-semibold text-blue-600">{fmt(toNum(pf.capitalEngage))} F</p></div>
        <div><p className="text-xs text-slate-400">Bénéfices générés</p><p className="font-semibold text-violet-600">{fmt(toNum(pf.beneficesGeneres))} F</p></div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Derniers dépôts */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Dépôts récents</p>
            {pf.depots.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun dépôt</p>
            ) : (
              <div className="space-y-1">
                {pf.depots.map((d) => (
                  <div key={d.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-mono text-xs">{d.reference}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fmt(toNum(d.montant))} F</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUT_BADGE[d.statut] ?? "bg-slate-100 text-slate-600"}`}>{d.statut}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Derniers retraits */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Retraits récents</p>
            {pf.retraits.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun retrait</p>
            ) : (
              <div className="space-y-1">
                {pf.retraits.map((r) => (
                  <div key={r.id} className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 font-mono text-xs">{r.reference}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{fmt(toNum(r.montant))} F</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUT_BADGE[r.statut] ?? "bg-slate-100 text-slate-600"}`}>{r.statut}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FicheInvestisseurPage() {
  const params = useParams<{ id: string }>();
  const { data: res, loading, refetch } = useApi<{ data: Investisseur }>(`/api/admin/ria/investisseurs/${params.id}`);
  const [showAddPF, setShowAddPF] = useState(false);

  const inv = res?.data;
  const m   = inv?.member;

  if (loading && !inv) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Chargement…
      </div>
    );
  }

  if (!inv || !m) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 gap-3">
        <p>Investisseur introuvable.</p>
        <Link href="/dashboard/admin/ria/investisseurs" className="text-emerald-600 hover:underline text-sm">Retour à la liste</Link>
      </div>
    );
  }

  const profil = inv.profilRIA;
  const portefeuilles = profil?.portefeuilles ?? [];
  const totalInvesti    = portefeuilles.reduce((s, p) => s + toNum(p.capitalInvesti), 0);
  const totalDisponible = portefeuilles.reduce((s, p) => s + toNum(p.capitalDisponible), 0);
  const totalEngage     = portefeuilles.reduce((s, p) => s + toNum(p.capitalEngage), 0);
  const totalBenef      = portefeuilles.reduce((s, p) => s + toNum(p.beneficesGeneres), 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/admin/ria/investisseurs"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Investisseurs
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-bold text-slate-900">{m.prenom} {m.nom}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link href={`/dashboard/admin/ria/investisseurs/${m.id}/documents`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50">
            <FileText className="w-3.5 h-3.5" /> Documents
          </Link>
          <button onClick={refetch} className="p-2 text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Profil + KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Identité */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl">
              {m.prenom[0]}{m.nom[0]}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{m.prenom} {m.nom}</p>
              <p className="text-xs text-slate-400">Depuis le {fmtDate(m.dateAdhesion)}</p>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{m.email}</div>
            {m.telephone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{m.telephone}</div>}
            {m.adresse   && <div className="flex items-center gap-2 text-sm text-slate-600"><MapPin className="w-4 h-4 text-slate-400" />{m.adresse}</div>}
            {profil?.profession && <div className="flex items-center gap-2 text-sm text-slate-600"><Briefcase className="w-4 h-4 text-slate-400" />{profil.profession}</div>}
            {profil?.pays       && <div className="flex items-center gap-2 text-sm text-slate-600"><Globe className="w-4 h-4 text-slate-400" />{profil.pays}</div>}
          </div>

          {profil?.notes && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-0.5">Notes</p>
              <p className="text-sm text-slate-600">{profil.notes}</p>
            </div>
          )}
        </div>

        {/* KPIs financiers */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: "Capital investi",   value: totalInvesti,    color: "text-slate-900",   icon: <Wallet className="w-5 h-5 text-emerald-600" /> },
            { label: "Capital disponible",value: totalDisponible, color: "text-emerald-700", icon: <Wallet className="w-5 h-5 text-emerald-500" /> },
            { label: "Capital engagé",    value: totalEngage,     color: "text-blue-700",    icon: <TrendingUp className="w-5 h-5 text-blue-500" /> },
            { label: "Bénéfices générés", value: totalBenef,      color: "text-violet-700",  icon: <TrendingUp className="w-5 h-5 text-violet-500" /> },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
              <div className="p-2 bg-slate-50 rounded-lg">{k.icon}</div>
              <div>
                <p className="text-xs text-slate-400 font-medium">{k.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${k.color}`}>{fmt(k.value)} <span className="text-xs font-normal text-slate-400">FCFA</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Portefeuilles */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Portefeuilles ({portefeuilles.length})</h2>
          {profil && (
            <button onClick={() => setShowAddPF(true)}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" /> Ajouter un portefeuille
            </button>
          )}
        </div>

        {portefeuilles.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-2xl border border-slate-200">
            Aucun portefeuille. Créez le premier.
          </div>
        ) : (
          <div className="space-y-4">
            {portefeuilles.map((pf) => <PortefeuilleCard key={pf.id} pf={pf} />)}
          </div>
        )}
      </div>

      {showAddPF && profil && (
        <AddPortefeuilleModal profilRIAId={profil.id} onClose={() => setShowAddPF(false)} onSuccess={refetch} />
      )}
    </div>
  );
}
