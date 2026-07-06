"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, MapPin, Phone, User, Hash, Plus, X, Printer, ArrowDownCircle,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";
import ClienteleTabBar from "@/components/ClienteleTabBar";

interface CompteDetail {
  id: number; numeroCompte: string; ribComplet: string; cleRib: string;
  codeAgence: string; codeGuichet: string; statut: string; motifBlocage: string | null;
  solde: string | number; totalDepose: string | number; totalRetire: string | number; totalUtilise: string | number;
  nbMouvements: number; dateOuverture: string; derniereOperationAt: string | null;
  client: {
    id: number; nom: string; prenom: string; telephone: string; telephoneSecondaire: string | null;
    codeClient: string | null; quartier: string | null; ville: string | null; commune: string | null;
    adresse: string | null; photoUrl: string | null; etat: string; segment: string;
    agentTerrain: { nom: string; prenom: string } | null;
    pointDeVente: { nom: string; code: string } | null;
  };
  agentCreateur: { nom: string; prenom: string } | null;
}
interface Mouvement {
  id: number; reference: string; nature: string; montant: string | number;
  soldeAvant: string | number; soldeApres: string | number; modePaiement: string | null;
  observation: string | null; statut: string; createdAt: string;
  user: { nom: string; prenom: string } | null;
}

const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  SUSPENDU: "bg-amber-100 text-amber-700 border-amber-200",
  CLOTURE: "bg-gray-100 text-gray-600 border-gray-200",
  DECEDE: "bg-slate-200 text-slate-700 border-slate-300",
  BLACKLIST: "bg-red-100 text-red-700 border-red-200",
  FRAUDULEUX: "bg-rose-100 text-rose-700 border-rose-200",
};
const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif", SUSPENDU: "Suspendu", CLOTURE: "Clôturé",
  DECEDE: "Décédé", BLACKLIST: "Blacklisté", FRAUDULEUX: "Frauduleux",
};
const NATURE_LABEL: Record<string, string> = {
  DEPOT: "Dépôt", RETRAIT: "Retrait", PAIEMENT_CREDIT: "Paiement crédit",
  PAIEMENT_COMPTANT: "Paiement comptant", CORRECTION: "Correction",
  ANNULATION: "Annulation", TRANSFERT: "Transfert",
};
const NATURE_STYLE: Record<string, string> = {
  DEPOT: "bg-emerald-100 text-emerald-700", RETRAIT: "bg-orange-100 text-orange-700",
  PAIEMENT_CREDIT: "bg-blue-100 text-blue-700", PAIEMENT_COMPTANT: "bg-blue-100 text-blue-700",
  CORRECTION: "bg-amber-100 text-amber-700", ANNULATION: "bg-gray-100 text-gray-600",
  TRANSFERT: "bg-violet-100 text-violet-700",
};
const MODES = ["Espèces", "Mobile Money", "Carte", "Virement"];
const N = (v: string | number) => Number(v ?? 0);
const initials = (p?: string, n?: string) => `${p?.[0] ?? ""}${n?.[0] ?? ""}`.toUpperCase();

export default function CompteCourantDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const gest = session?.user?.gestionnaireRole;
  const canDeposit = role === "ADMIN" || role === "SUPER_ADMIN" || gest === "CHEF_AGENCE" || gest === "CAISSIER";

  const { data: res, loading, refetch } = useApi<{ data: CompteDetail }>(`/api/comptes-courants/${params.id}`);
  const { data: mvtRes, refetch: refetchMvt } = useApi<{ data: Mouvement[] }>(`/api/comptes-courants/${params.id}/mouvements?limit=50`);
  const c = res?.data;
  const mouvements = mvtRes?.data ?? [];

  // ── Dépôt ──
  const [depotOpen, setDepotOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  const recuUrl = (mid: number) => `/api/comptes-courants/${params.id}/mouvements/${mid}/recu`;

  const submitDepot = async () => {
    const m = Number(montant);
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/depots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: m, modePaiement: mode, reference: reference || undefined, observation: observation || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Dépôt enregistré ✓");
      setDepotOpen(false); setMontant(""); setReference(""); setObservation("");
      refetch(); refetchMvt();
      // Édition automatique du reçu (CDC §5)
      const mid = j.data?.mouvement?.id;
      if (mid) window.open(recuUrl(mid), "_blank");
      if (j.data && j.data.ecritureGeneree === false) {
        toast.warning("Dépôt enregistré, mais écriture comptable non générée (plan comptable à configurer).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ClienteleTabBar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Link href="/dashboard/admin/comptes-courants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux comptes courants
        </Link>

        {loading && !c ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Chargement…</div>
        ) : !c ? (
          <p className="text-center py-20 text-gray-400">Compte introuvable.</p>
        ) : (
          <>
            {/* En-tête compte */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between text-white gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden ring-2 ring-white/30">
                    {c.client.photoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.client.photoUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="font-bold text-lg">{initials(c.client.prenom, c.client.nom)}</span>}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{c.client.prenom} {c.client.nom}</h2>
                    <p className="font-mono text-sm text-white/85">{c.numeroCompte}</p>
                    <p className="font-mono text-[11px] text-white/70">{c.ribComplet}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1 rounded-full border font-medium bg-white/90 ${STATUT_STYLE[c.statut] ?? ""}`}>
                    {STATUT_LABEL[c.statut] ?? c.statut}
                  </span>
                  <p className="text-2xl font-extrabold mt-2">{formatCurrency(N(c.solde))}</p>
                  <p className="text-[11px] text-white/80">Solde actuel</p>
                </div>
              </div>
              {c.motifBlocage && (
                <div className="px-6 py-2 bg-red-50 text-red-700 text-xs border-t border-red-100">Motif de blocage : {c.motifBlocage}</div>
              )}
              {/* Actions */}
              <div className="px-6 py-3 flex items-center gap-2 border-t border-gray-100">
                {canDeposit && c.statut === "ACTIF" && (
                  <button onClick={() => setDepotOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium shadow-sm">
                    <Plus className="w-4 h-4" /> Faire un dépôt
                  </button>
                )}
                {canDeposit && c.statut !== "ACTIF" && (
                  <span className="text-xs text-gray-400">Opérations bloquées : compte {STATUT_LABEL[c.statut]?.toLowerCase()}.</span>
                )}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi label="Total déposé"  value={formatCurrency(N(c.totalDepose))}  icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50" />
              <Kpi label="Total utilisé" value={formatCurrency(N(c.totalUtilise))} icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}  bg="bg-blue-50" />
              <Kpi label="Total retiré"  value={formatCurrency(N(c.totalRetire))}  icon={<TrendingDown className="w-5 h-5 text-orange-600" />} bg="bg-orange-50" />
              <Kpi label="Mouvements"    value={String(c.nbMouvements)}            icon={<Activity className="w-5 h-5 text-violet-600" />}    bg="bg-violet-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> Informations client</h3>
                <div className="space-y-2.5 text-sm">
                  <Row icon={<Hash className="w-4 h-4" />} label="Code client" value={c.client.codeClient ?? "—"} />
                  <Row icon={<Phone className="w-4 h-4" />} label="Téléphone" value={c.client.telephone + (c.client.telephoneSecondaire ? ` · ${c.client.telephoneSecondaire}` : "")} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Communauté" value={c.client.commune ?? "—"} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Zone" value={c.client.ville ?? "—"} />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Quartier" value={c.client.quartier ?? "—"} />
                  <Row icon={<User className="w-4 h-4" />} label="Agent" value={c.client.agentTerrain ? `${c.client.agentTerrain.prenom} ${c.client.agentTerrain.nom}` : "—"} />
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-gray-400" /> Informations compte</h3>
                <div className="space-y-2.5 text-sm">
                  <Row icon={<Hash className="w-4 h-4" />} label="N° de compte" value={c.numeroCompte} mono />
                  <Row icon={<Hash className="w-4 h-4" />} label="RIB complet" value={c.ribComplet} mono />
                  <Row icon={<MapPin className="w-4 h-4" />} label="Agence / Guichet" value={`${c.codeAgence} · ${c.codeGuichet}`} />
                  <Row icon={<Clock className="w-4 h-4" />} label="Date d'ouverture" value={formatDate(c.dateOuverture)} />
                  <Row icon={<Clock className="w-4 h-4" />} label="Dernière opération" value={c.derniereOperationAt ? formatDate(c.derniereOperationAt) : "—"} />
                  <Row icon={<User className="w-4 h-4" />} label="Ouvert par" value={c.agentCreateur ? `${c.agentCreateur.prenom} ${c.agentCreateur.nom}` : "—"} />
                </div>
              </div>
            </div>

            {/* Historique des mouvements (CDC §7) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <h3 className="font-bold text-gray-800">Historique des mouvements</h3>
              </div>
              {mouvements.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <ArrowDownCircle className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  Aucun mouvement pour l&apos;instant.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Date</th>
                        <th className="text-left px-5 py-3 font-semibold">Nature</th>
                        <th className="text-right px-5 py-3 font-semibold">Montant</th>
                        <th className="text-right px-5 py-3 font-semibold">Solde après</th>
                        <th className="text-left px-5 py-3 font-semibold">Opérateur</th>
                        <th className="text-left px-5 py-3 font-semibold">Référence</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {mouvements.map((m) => {
                        const neg = N(m.montant) < 0;
                        return (
                          <tr key={m.id} className="hover:bg-gray-50/60">
                            <td className="px-5 py-3 text-xs text-gray-500">{new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NATURE_STYLE[m.nature] ?? "bg-gray-100 text-gray-600"}`}>
                                {NATURE_LABEL[m.nature] ?? m.nature}
                              </span>
                              {m.observation && <p className="text-[11px] text-gray-400 mt-0.5">{m.observation}</p>}
                            </td>
                            <td className={`px-5 py-3 text-right font-semibold ${neg ? "text-orange-600" : "text-emerald-600"}`}>
                              {neg ? "−" : "+"} {formatCurrency(Math.abs(N(m.montant)))}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-800">{formatCurrency(N(m.soldeApres))}</td>
                            <td className="px-5 py-3 text-xs text-gray-600">{m.user ? `${m.user.prenom} ${m.user.nom}` : "—"}</td>
                            <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{m.reference}</td>
                            <td className="px-5 py-3 text-right">
                              <a href={recuUrl(m.id)} target="_blank" rel="noopener noreferrer" title="Reçu PDF"
                                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600">
                                <Printer className="w-3.5 h-3.5" /> Reçu
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal dépôt */}
      {depotOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Plus className="w-4 h-4 text-emerald-600" /> Faire un dépôt</h3>
              <button onClick={() => setDepotOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Compte {c.numeroCompte} · {c.client.prenom} {c.client.nom}</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                <input type="number" min={0} autoFocus value={montant} onChange={(e) => setMontant(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mode de paiement</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Référence (optionnel)</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Observation (optionnel)</span>
                <input value={observation} onChange={(e) => setObservation(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setDepotOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitDepot} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Valider le dépôt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, icon, bg }: { label: string; value: string; icon: React.ReactNode; bg: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
      <div className={`${bg} p-2.5 rounded-xl shrink-0`}>{icon}</div>
      <div><p className="text-xs text-gray-500">{label}</p><p className="font-bold text-gray-900 text-lg">{value}</p></div>
    </div>
  );
}
function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-gray-500"><span className="text-gray-300">{icon}</span>{label}</span>
      <span className={`font-medium text-gray-800 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
