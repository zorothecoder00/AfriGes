"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, MapPin, Phone, User, Hash, Plus, X, Printer, ArrowDownCircle, CreditCard, ShieldAlert,
  FileText, FileCheck, BookOpen,
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
  observation: string | null; statut: string; agence: string | null; createdAt: string;
  user: { nom: string; prenom: string } | null;
}
interface CreditPayable {
  creditId: number; reference: string; soldeRestant: number;
  montantTotal: number; montantRembourse: number; tauxPaye: number;
  montantAttendu: number;
}
interface RetraitPending {
  id: number; reference: string; montant: string | number;
  soldeAvant: string | number; soldeApres: string | number;
  modePaiement: string | null; observation: string | null; createdAt: string;
  user: { id: number; nom: string; prenom: string } | null;
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
  // Capacité VALIDATE (CDC §17) : gestion du statut du compte (blocage/clôture/réactivation).
  const canManageStatus = role === "ADMIN" || role === "SUPER_ADMIN" || gest === "CHEF_AGENCE" || gest === "RESPONSABLE_ECONOMIQUE";

  const { data: res, loading, refetch } = useApi<{ data: CompteDetail }>(`/api/comptes-courants/${params.id}`);
  const { data: mvtRes, refetch: refetchMvt } = useApi<{ data: Mouvement[] }>(`/api/comptes-courants/${params.id}/mouvements?limit=50`);
  const { data: credRes, refetch: refetchCred } = useApi<{ data: CreditPayable[] }>(`/api/comptes-courants/${params.id}/credits-payables`);
  const { data: retRes, refetch: refetchRet } = useApi<{ data: RetraitPending[] }>(`/api/comptes-courants/${params.id}/retraits`);
  const c = res?.data;
  const mouvements = mvtRes?.data ?? [];
  const creditsPayables = credRes?.data ?? [];
  const retraitsPending = retRes?.data ?? [];
  // Les retraits en attente sont affichés dans leur section dédiée, pas dans le grand livre.
  const mouvementsVisibles = mouvements.filter((m) => m.statut !== "EN_ATTENTE");

  // ── Dépôt ──
  const [depotOpen, setDepotOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [reference, setReference] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Paiement d'un crédit depuis le CC ──
  const [payOpen, setPayOpen] = useState(false);
  const [payCreditId, setPayCreditId] = useState("");
  const [payMontant, setPayMontant] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // ── Changement de statut (CDC §3) ──
  const [statutOpen, setStatutOpen] = useState(false);
  const [newStatut, setNewStatut] = useState("");
  const [motifStatut, setMotifStatut] = useState("");
  const [statutSaving, setStatutSaving] = useState(false);

  // ── Retrait sécurisé (CDC §9, Lot 4) ──
  const [retraitOpen, setRetraitOpen] = useState(false);
  const [retMontant, setRetMontant] = useState("");
  const [retMode, setRetMode] = useState(MODES[0]);
  const [retMotif, setRetMotif] = useState("");
  const [retSaving, setRetSaving] = useState(false);
  // Contrôles de sécurité obligatoires (CDC §9)
  const [retVerifPiece, setRetVerifPiece] = useState(false);
  const [retVerifPhoto, setRetVerifPhoto] = useState(false);
  const [retVerifSignature, setRetVerifSignature] = useState(false);
  const retVerifOk = retVerifPiece && retVerifPhoto && retVerifSignature;
  // Validation / rejet d'un retrait en attente
  const [valRetrait, setValRetrait] = useState<RetraitPending | null>(null);
  const [valPassword, setValPassword] = useState("");
  const [valSaving, setValSaving] = useState(false);
  const [rejRetrait, setRejRetrait] = useState<RetraitPending | null>(null);
  const [rejMotif, setRejMotif] = useState("");
  const [rejSaving, setRejSaving] = useState(false);

  // ── Documents (CDC §14, Lot 5) : relevé sur période ──
  const [releveOpen, setReleveOpen] = useState(false);
  const [releveFrom, setReleveFrom] = useState("");
  const [releveTo, setReleveTo] = useState("");

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
      if (mid) window.open(`${recuUrl(mid)}?print=1`, "_blank");
      if (j.data && j.data.ecritureGeneree === false) {
        toast.warning("Dépôt enregistré, mais écriture comptable non générée (plan comptable à configurer).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  };

  const submitPaiement = async () => {
    const m = Number(payMontant);
    if (!payCreditId) { toast.error("Choisissez un crédit"); return; }
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    setPaySaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/paiements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditId: Number(payCreditId), montant: m }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Crédit payé : ${Number(j.data.montantApplique).toLocaleString("fr-FR")} FCFA`);
      setPayOpen(false); setPayCreditId(""); setPayMontant("");
      refetch(); refetchMvt(); refetchCred();
      const mid = j.data?.mouvement?.id;
      if (mid) window.open(`${recuUrl(mid)}?print=1`, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setPaySaving(false); }
  };

  const submitStatut = async () => {
    if (!newStatut) { toast.error("Choisissez un statut"); return; }
    if (newStatut !== "ACTIF" && motifStatut.trim().length < 3) { toast.error("Motif obligatoire"); return; }
    setStatutSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/statut`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: newStatut, motif: motifStatut.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Statut mis à jour : ${STATUT_LABEL[newStatut] ?? newStatut}`);
      setStatutOpen(false); setNewStatut(""); setMotifStatut("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setStatutSaving(false); }
  };

  const submitRetrait = async () => {
    const m = Number(retMontant);
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    if (!retVerifOk) { toast.error("Validez les 3 contrôles de sécurité"); return; }
    setRetSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/retraits`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: m, modePaiement: retMode, motif: retMotif || undefined,
          verifPieceIdentite: retVerifPiece, verifPhoto: retVerifPhoto, verifSignature: retVerifSignature,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Demande de retrait envoyée pour validation ✓");
      setRetraitOpen(false); setRetMontant(""); setRetMotif("");
      setRetVerifPiece(false); setRetVerifPhoto(false); setRetVerifSignature(false);
      refetchRet(); refetchMvt();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setRetSaving(false); }
  };

  const submitValider = async () => {
    if (!valRetrait) return;
    if (!valPassword) { toast.error("Mot de passe requis"); return; }
    setValSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/retraits/${valRetrait.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VALIDER", password: valPassword }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Retrait validé ✓");
      setValRetrait(null); setValPassword("");
      refetch(); refetchMvt(); refetchRet();
      const mid = j.data?.mouvement?.id;
      if (mid) window.open(`${recuUrl(mid)}?print=1`, "_blank");
      if (j.data && j.data.ecritureGeneree === false) {
        toast.warning("Retrait validé, mais écriture comptable non générée (plan comptable à configurer).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setValSaving(false); }
  };

  const submitRejeter = async () => {
    if (!rejRetrait) return;
    if (rejMotif.trim().length < 3) { toast.error("Motif obligatoire"); return; }
    setRejSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/retraits/${rejRetrait.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJETER", motif: rejMotif.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Retrait rejeté");
      setRejRetrait(null); setRejMotif("");
      refetchRet(); refetchMvt();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setRejSaving(false); }
  };

  const openReleve = () => {
    const qs = new URLSearchParams();
    if (releveFrom) qs.set("from", releveFrom);
    if (releveTo) qs.set("to", releveTo);
    window.open(`/api/comptes-courants/${params.id}/releve${qs.toString() ? `?${qs}` : ""}`, "_blank");
    setReleveOpen(false);
  };

  const selectedCredit = creditsPayables.find((cr) => String(cr.creditId) === payCreditId);

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
                {canDeposit && c.statut === "ACTIF" && creditsPayables.length > 0 && (
                  <button onClick={() => { setPayOpen(true); setPayCreditId(String(creditsPayables[0].creditId)); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm">
                    <CreditCard className="w-4 h-4" /> Payer un crédit
                  </button>
                )}
                {canDeposit && c.statut === "ACTIF" && (
                  <button onClick={() => { setRetMontant(""); setRetMotif(""); setRetVerifPiece(false); setRetVerifPhoto(false); setRetVerifSignature(false); setRetraitOpen(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-medium shadow-sm">
                    <TrendingDown className="w-4 h-4" /> Demander un retrait
                  </button>
                )}
                {canDeposit && c.statut !== "ACTIF" && (
                  <span className="text-xs text-gray-400">Opérations bloquées : compte {STATUT_LABEL[c.statut]?.toLowerCase()}.</span>
                )}
                {canManageStatus && (
                  <button onClick={() => { setNewStatut(""); setMotifStatut(""); setStatutOpen(true); }}
                    className="ml-auto inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
                    <ShieldAlert className="w-4 h-4 text-slate-500" /> Changer le statut
                  </button>
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

            {/* Documents (CDC §14, Lot 5) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-gray-400" /> Documents</h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => { setReleveFrom(""); setReleveTo(""); setReleveOpen(true); }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
                  <FileText className="w-4 h-4 text-emerald-600" /> Relevé de compte
                </button>
                <a href={`/api/comptes-courants/${params.id}/attestation`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
                  <FileCheck className="w-4 h-4 text-blue-600" /> Attestation
                </a>
                <a href={`/api/comptes-courants/${params.id}/carnet`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
                  <BookOpen className="w-4 h-4 text-violet-600" /> Carnet
                </a>
                {c.statut === "CLOTURE" && (
                  <a href={`/api/comptes-courants/${params.id}/attestation-fermeture`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium">
                    <FileCheck className="w-4 h-4 text-rose-600" /> Attestation de fermeture
                  </a>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">Documents PDF officiels AFRISIME · le relevé peut être filtré sur une période. L&apos;attestation de fermeture est disponible pour les comptes clôturés.</p>
            </div>

            {/* Retraits en attente de validation (CDC §9, Lot 4) */}
            {retraitsPending.length > 0 && (
              <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-amber-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-amber-800">Retraits en attente de validation</h3>
                  <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">{retraitsPending.length}</span>
                </div>
                <div className="divide-y divide-amber-100">
                  {retraitsPending.map((rt) => (
                    <div key={rt.id} className="px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
                      <div className="text-sm">
                        <span className="font-semibold text-orange-700">− {formatCurrency(Math.abs(N(rt.montant)))}</span>
                        <span className="text-xs text-gray-500 ml-3">Solde après : {formatCurrency(N(rt.soldeApres))}</span>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {new Date(rt.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          {rt.user ? ` · initié par ${rt.user.prenom} ${rt.user.nom}` : ""}
                          {rt.modePaiement ? ` · ${rt.modePaiement}` : ""}
                          {rt.observation ? ` · ${rt.observation}` : ""}
                        </p>
                      </div>
                      {canManageStatus ? (
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setValPassword(""); setValRetrait(rt); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium">
                            <ShieldAlert className="w-3.5 h-3.5" /> Valider
                          </button>
                          <button onClick={() => { setRejMotif(""); setRejRetrait(rt); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium">
                            <X className="w-3.5 h-3.5" /> Rejeter
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">En attente d&apos;un valideur</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historique des mouvements (CDC §7) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-400" />
                <h3 className="font-bold text-gray-800">Historique des mouvements</h3>
              </div>
              {mouvementsVisibles.length === 0 ? (
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
                        <th className="text-right px-5 py-3 font-semibold">Solde avant</th>
                        <th className="text-right px-5 py-3 font-semibold">Solde après</th>
                        <th className="text-left px-5 py-3 font-semibold">Utilisateur</th>
                        <th className="text-left px-5 py-3 font-semibold">Agence</th>
                        <th className="text-left px-5 py-3 font-semibold">Référence</th>
                        <th className="text-left px-5 py-3 font-semibold">Observation</th>
                        <th className="px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {mouvementsVisibles.map((m) => {
                        const neg = N(m.montant) < 0;
                        const annule = m.statut === "ANNULE";
                        return (
                          <tr key={m.id} className={`hover:bg-gray-50/60 ${annule ? "opacity-60" : ""}`}>
                            <td className="px-5 py-3 text-xs text-gray-500">{new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                            <td className="px-5 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NATURE_STYLE[m.nature] ?? "bg-gray-100 text-gray-600"}`}>
                                {NATURE_LABEL[m.nature] ?? m.nature}
                              </span>
                              {annule && <span className="text-[10px] px-1.5 py-0.5 ml-1 rounded-full bg-gray-200 text-gray-500 font-medium">Rejeté</span>}
                            </td>
                            <td className={`px-5 py-3 text-right font-semibold ${annule ? "text-gray-400 line-through" : neg ? "text-orange-600" : "text-emerald-600"}`}>
                              {neg ? "−" : "+"} {formatCurrency(Math.abs(N(m.montant)))}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(N(m.soldeAvant))}</td>
                            <td className="px-5 py-3 text-right text-gray-800">{annule ? "—" : formatCurrency(N(m.soldeApres))}</td>
                            <td className="px-5 py-3 text-xs text-gray-600">{m.user ? `${m.user.prenom} ${m.user.nom}` : "—"}</td>
                            <td className="px-5 py-3 text-xs text-gray-500">{m.agence ?? "—"}</td>
                            <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{m.reference}</td>
                            <td className="px-5 py-3 text-[11px] text-gray-500 max-w-[200px] truncate" title={m.observation ?? ""}>{m.observation ?? "—"}</td>
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

      {/* Modal paiement crédit */}
      {payOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Payer un crédit</h3>
              <button onClick={() => setPayOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                Solde du compte courant : <span className="font-semibold text-emerald-700">{formatCurrency(N(c.solde))}</span>
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Crédit à payer</span>
                <select value={payCreditId} onChange={(e) => setPayCreditId(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {creditsPayables.map((cr) => (
                    <option key={cr.creditId} value={cr.creditId}>
                      {cr.reference} — reste {Math.round(cr.soldeRestant).toLocaleString("fr-FR")} FCFA
                    </option>
                  ))}
                </select>
              </label>
              {selectedCredit && (
                <p className="text-xs text-gray-500">
                  Solde restant du crédit : <span className="font-semibold text-red-600">{formatCurrency(selectedCredit.soldeRestant)}</span>
                  {selectedCredit.montantAttendu > 0 && <> · échéance du jour : {formatCurrency(selectedCredit.montantAttendu)}</>}
                </p>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant à prélever (FCFA)</span>
                <input type="number" min={0} value={payMontant} onChange={(e) => setPayMontant(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {selectedCredit && (
                  <button type="button"
                    onClick={() => setPayMontant(String(Math.round(Math.min(N(c.solde), selectedCredit.soldeRestant))))}
                    className="mt-1 text-[11px] text-blue-600 hover:underline">
                    Max ({formatCurrency(Math.min(N(c.solde), selectedCredit.soldeRestant))})
                  </button>
                )}
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setPayOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitPaiement} disabled={paySaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {paySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Payer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal changement de statut */}
      {statutOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-slate-600" /> Changer le statut</h3>
              <button onClick={() => setStatutOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                Compte {c.numeroCompte} · statut actuel :{" "}
                <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[c.statut] ?? ""}`}>{STATUT_LABEL[c.statut] ?? c.statut}</span>
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Nouveau statut</span>
                <select value={newStatut} onChange={(e) => setNewStatut(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">
                  <option value="">— Choisir —</option>
                  {Object.keys(STATUT_LABEL).filter((s) => s !== c.statut).map((s) => (
                    <option key={s} value={s}>{STATUT_LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">
                  Motif {newStatut && newStatut !== "ACTIF" ? <span className="text-red-500">*</span> : <span className="text-gray-400">(optionnel)</span>}
                </span>
                <textarea value={motifStatut} onChange={(e) => setMotifStatut(e.target.value)} rows={3}
                  placeholder={newStatut === "ACTIF" ? "Ex : régularisation, levée de suspension…" : "Ex : décès, fraude avérée, demande client…"}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </label>
              {newStatut === "CLOTURE" && N(c.solde) !== 0 && (
                <p className="text-[11px] text-red-600">Le solde doit être nul avant clôture (actuel : {formatCurrency(N(c.solde))}).</p>
              )}
              {newStatut && newStatut !== "ACTIF" && (
                <p className="text-[11px] text-amber-600">Ce statut bloquera dépôts, paiements et retraits sur le compte (CDC §10).</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setStatutOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitStatut} disabled={statutSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {statutSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal demande de retrait */}
      {retraitOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-orange-600" /> Demander un retrait</h3>
              <button onClick={() => setRetraitOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">
                Solde disponible : <span className="font-semibold text-emerald-700">{formatCurrency(N(c.solde))}</span>
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                <input type="number" min={0} autoFocus value={retMontant} onChange={(e) => setRetMontant(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mode de décaissement</span>
                <select value={retMode} onChange={(e) => setRetMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif (optionnel)</span>
                <input value={retMotif} onChange={(e) => setRetMotif(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </label>

              {/* Contrôles de sécurité obligatoires (CDC §9) */}
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Contrôles de sécurité (obligatoires)
                </p>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifPiece} onChange={(e) => setRetVerifPiece(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Pièce d&apos;identité du client vérifiée</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifPhoto} onChange={(e) => setRetVerifPhoto(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Correspondance de la photo confirmée</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={retVerifSignature} onChange={(e) => setRetVerifSignature(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-orange-600" />
                  <span>Signature du client recueillie</span>
                </label>
              </div>

              <p className="text-[11px] text-amber-600">Le retrait sera exécuté après validation d&apos;un responsable (Chef d&apos;agence).</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRetraitOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitRetrait} disabled={retSaving || !retVerifOk}
                className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold">
                {retSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />} Envoyer la demande
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validation d'un retrait (ré-authentification) */}
      {valRetrait && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-emerald-600" /> Valider le retrait</h3>
              <button onClick={() => setValRetrait(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Montant</span><span className="font-semibold text-orange-700">− {formatCurrency(Math.abs(N(valRetrait.montant)))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Solde après</span><span className="font-medium text-gray-800">{formatCurrency(N(valRetrait.soldeApres))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Initié par</span><span className="text-gray-700">{valRetrait.user ? `${valRetrait.user.prenom} ${valRetrait.user.nom}` : "—"}</span></div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Confirmez avec votre mot de passe</span>
                <input type="password" autoFocus value={valPassword} onChange={(e) => setValPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitValider(); }}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <p className="text-[11px] text-gray-400">Le débit du compte et l&apos;écriture comptable sont produits à la validation.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setValRetrait(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitValider} disabled={valSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {valSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Valider et décaisser
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejet d'un retrait */}
      {rejRetrait && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><X className="w-4 h-4 text-red-600" /> Rejeter le retrait</h3>
              <button onClick={() => setRejRetrait(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Retrait de <span className="font-semibold text-orange-700">{formatCurrency(Math.abs(N(rejRetrait.montant)))}</span> — {rejRetrait.reference}</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif du rejet <span className="text-red-500">*</span></span>
                <textarea value={rejMotif} onChange={(e) => setRejMotif(e.target.value)} rows={3} autoFocus
                  placeholder="Ex : montant erroné, pièce manquante, solde à vérifier…"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-400" />
              </label>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setRejRetrait(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitRejeter} disabled={rejSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {rejSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal relevé de compte (période) */}
      {releveOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" /> Relevé de compte</h3>
              <button onClick={() => setReleveOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Laissez les dates vides pour un relevé depuis l&apos;ouverture du compte.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Du</span>
                  <input type="date" value={releveFrom} onChange={(e) => setReleveFrom(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Au</span>
                  <input type="date" value={releveTo} onChange={(e) => setReleveTo(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setReleveOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={openReleve}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold">
                <FileText className="w-4 h-4" /> Générer le PDF
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
