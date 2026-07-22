"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Wallet, ArrowLeft, Loader2, TrendingUp, TrendingDown, ShoppingCart,
  Activity, Clock, MapPin, Phone, User, Users, UserPlus, Trash2, Search, Hash, Plus, X, Printer, ArrowDownCircle, CreditCard, ShieldAlert,
  FileText, FileCheck, BookOpen, Target, Calendar, PiggyBank, Ban, Repeat, Power,
  Award, Gift, Star, Sparkles, Lock, Unlock, Building2, Pencil,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { usePermissions } from "@/hooks/usePermissions";
import PayerCreditsModal from "@/components/PayerCreditsModal";   
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
  typeCompte: string; libelle: string | null;
  membres: MembreCC[];
}
interface MembreCC {
  id: number; role: string; quotePart: string | number | null; createdAt: string;
  client: { id: number; nom: string; prenom: string; telephone: string; codeClient: string | null; photoUrl: string | null };
}
interface Mouvement {
  id: number; reference: string; nature: string; montant: string | number;
  soldeAvant: string | number; soldeApres: string | number; modePaiement: string | null;
  observation: string | null; statut: string; agence: string | null; createdAt: string;
  numeroJour: number | null; dateOperation: string | null;
  user: { nom: string; prenom: string } | null;
  agentApporteur: { nom: string; prenom: string } | null;
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
const TYPE_COMPTE_LABEL: Record<string, string> = {
  INDIVIDUEL: "Individuel", MENAGE: "Ménage", COMMUNAUTE: "Communauté", GROUPEMENT: "Groupement",
};
const ROLE_MEMBRE_LABEL: Record<string, string> = {
  TITULAIRE: "Titulaire", MANDATAIRE: "Mandataire", MEMBRE: "Membre",
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
  // Édition/correction des données (compte + mouvements) : réservée à l'admin.
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  // RBAC granulaire : les documents (relevé/attestation/carnet) sont un EXPORT.
  const { can } = usePermissions();
  const canExport = can("compte_courant", "EXPORT");

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
  // Métadonnées de collecte optionnelles (parité avec les crédits).
  const [numeroJour, setNumeroJour] = useState("");
  const [dateDepot, setDateDepot] = useState("");
  const [agentApporteur, setAgentApporteur] = useState("");
  const { data: collData } = useApi<{ data: { id: number; nom: string; prenom: string }[] }>(
    depotOpen ? "/api/comptes-courants/collecteurs" : null,
  );
  const collecteurs = collData?.data ?? [];

  // ── Paiement d'un crédit depuis le CC (modal partagé multi-crédits) ──
  const [payOpen, setPayOpen] = useState(false);

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

  // ── Édition admin : informations du compte ──
  const [editCompteOpen, setEditCompteOpen] = useState(false);
  const [ecLibelle, setEcLibelle] = useState("");
  const [ecAgence, setEcAgence] = useState("");
  const [ecGuichet, setEcGuichet] = useState("");
  const [ecType, setEcType] = useState("INDIVIDUEL");
  const [ecSaving, setEcSaving] = useState(false);

  // ── Édition admin : correction d'un mouvement ──
  const [editMvt, setEditMvt] = useState<Mouvement | null>(null);
  const [emObservation, setEmObservation] = useState("");
  const [emMode, setEmMode] = useState("");
  const [emAgence, setEmAgence] = useState("");
  const [emNumeroJour, setEmNumeroJour] = useState("");
  const [emDate, setEmDate] = useState("");
  const [emMontant, setEmMontant] = useState("");
  const [emSaving, setEmSaving] = useState(false);
  const emMontantEditable = editMvt ? (editMvt.nature === "DEPOT" || editMvt.nature === "RETRAIT") : false;

  const recuUrl = (mid: number) => `/api/comptes-courants/${params.id}/mouvements/${mid}/recu`;

  const submitDepot = async () => {
    const m = Number(montant);
    if (!m || m <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}/depots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: m, modePaiement: mode, reference: reference || undefined, observation: observation || undefined,
          numeroJour: numeroJour || undefined, dateDepot: dateDepot || undefined, agentApporteurId: agentApporteur || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Dépôt enregistré ✓");
      setDepotOpen(false); setMontant(""); setReference(""); setObservation("");
      setNumeroJour(""); setDateDepot(""); setAgentApporteur("");
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

  const openEditCompte = () => {
    if (!c) return;
    setEcLibelle(c.libelle ?? "");
    setEcAgence(c.codeAgence);
    setEcGuichet(c.codeGuichet);
    setEcType(c.typeCompte);
    setEditCompteOpen(true);
  };

  const submitEditCompte = async () => {
    setEcSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${params.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libelle: ecLibelle, codeAgence: ecAgence, codeGuichet: ecGuichet, typeCompte: ecType }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Compte mis à jour ✓");
      setEditCompteOpen(false); refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setEcSaving(false); }
  };

  const openEditMvt = (m: Mouvement) => {
    setEmObservation(m.observation ?? "");
    setEmMode(m.modePaiement ?? "");
    setEmAgence(m.agence ?? "");
    setEmNumeroJour(m.numeroJour != null ? String(m.numeroJour) : "");
    setEmDate(m.dateOperation ? m.dateOperation.slice(0, 10) : "");
    setEmMontant(String(Math.abs(N(m.montant))));
    setEditMvt(m);
  };

  const submitEditMvt = async () => {
    if (!editMvt) return;
    // Le solde du compte ne change QUE si le montant a été corrigé : on évite alors
    // le refetch (lourd) du compte pour une simple modification de métadonnée.
    const montantModifie = emMontantEditable && emMontant !== "" && Number(emMontant) !== Math.abs(N(editMvt.montant));
    setEmSaving(true);
    try {
      const body: Record<string, unknown> = {
        observation: emObservation, modePaiement: emMode || null, agence: emAgence || null,
        numeroJour: emNumeroJour || null, dateOperation: emDate || null,
      };
      if (emMontantEditable && emMontant) body.montant = Number(emMontant);
      const r = await fetch(`/api/comptes-courants/${params.id}/mouvements/${editMvt.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Mouvement corrigé ✓");
      setEditMvt(null);
      refetchMvt();
      if (montantModifie) refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setEmSaving(false); }
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
                    <h2 className="text-xl font-bold">{c.libelle ?? `${c.client.prenom} ${c.client.nom}`}</h2>
                    {c.libelle && <p className="text-xs text-white/85">Représentant : {c.client.prenom} {c.client.nom}</p>}
                    <p className="font-mono text-sm text-white/85">{c.numeroCompte}</p>
                    <p className="font-mono text-[11px] text-white/70">{c.ribComplet}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    {c.typeCompte !== "INDIVIDUEL" && (
                      <span className="text-xs px-2.5 py-1 rounded-full border border-white/40 bg-white/15 text-white font-medium inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {TYPE_COMPTE_LABEL[c.typeCompte] ?? c.typeCompte}
                      </span>
                    )}
                    <span className={`text-xs px-3 py-1 rounded-full border font-medium bg-white/90 ${STATUT_STYLE[c.statut] ?? ""}`}>
                      {STATUT_LABEL[c.statut] ?? c.statut}
                    </span>
                  </div>
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
                  <button onClick={() => setPayOpen(true)}
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><Wallet className="w-4 h-4 text-gray-400" /> Informations compte</h3>
                  {isAdmin && (
                    <button onClick={openEditCompte}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" /> Modifier
                    </button>
                  )}
                </div>
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

            {/* Membres du compte collectif (CDC §19.A) */}
            {c.typeCompte !== "INDIVIDUEL" && (
              <MembresSection
                compteId={Number(params.id)}
                membres={c.membres}
                canManage={canDeposit}
                excludeIds={c.membres.map((m) => m.client.id)}
                onChanged={refetch}
              />
            )}

            {/* Épargne programmée (CDC §19.B) */}
            <EpargneSection compteId={Number(params.id)} canManage={canDeposit} compteActif={c.statut === "ACTIF"} />

            {/* Prélèvement automatique des échéances (CDC §19.C) */}
            <PrelevementsSection compteId={Number(params.id)} canManage={canDeposit} compteActif={c.statut === "ACTIF"} creditsPayables={creditsPayables} />

            {/* Programme de fidélité / récompenses (CDC §19.D) */}
            <FideliteSection compteId={Number(params.id)} canManage={canDeposit} />

            {/* Blocage volontaire de l'épargne (CDC §19.E) */}
            <BlocageSection compteId={Number(params.id)} canManage={canDeposit} compteActif={c.statut === "ACTIF"} onChanged={() => { refetch(); refetchMvt(); }} />

            {/* Activité multi-agences (CDC §19.F) */}
            <AgencesSection compteId={Number(params.id)} agenceDomiciliation={c.codeAgence} />

            {/* Documents (CDC §14, Lot 5) — visible si permission EXPORT (RBAC granulaire) */}
            {canExport && (
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
            )}

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
                        // « Antérieure » seulement si la date d'opération est réellement
                        // avant le JOUR d'enregistrement — pas juste parce qu'elle existe.
                        const dateOp = m.dateOperation ? new Date(m.dateOperation) : null;
                        const created = new Date(m.createdAt);
                        const anterieure = dateOp
                          ? Date.UTC(dateOp.getUTCFullYear(), dateOp.getUTCMonth(), dateOp.getUTCDate())
                            < Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())
                          : false;
                        return (
                          <tr key={m.id} className={`hover:bg-gray-50/60 ${annule ? "opacity-60" : ""}`}>
                            <td className="px-5 py-3 text-xs text-gray-500">
                              {/* Date d'opération saisie prioritaire ; « antérieure » uniquement si backdatée. */}
                              {dateOp
                                ? <span title={`Saisi le ${created.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`}>
                                    {dateOp.toLocaleDateString("fr-FR")}
                                    {anterieure && <span className="ml-1 text-[10px] text-amber-600">(antérieure)</span>}
                                  </span>
                                : created.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${NATURE_STYLE[m.nature] ?? "bg-gray-100 text-gray-600"}`}>
                                {NATURE_LABEL[m.nature] ?? m.nature}
                              </span>
                              {m.numeroJour != null && <span className="text-[10px] px-1.5 py-0.5 ml-1 rounded-full bg-blue-100 text-blue-700 font-medium">J{m.numeroJour}</span>}
                              {annule && <span className="text-[10px] px-1.5 py-0.5 ml-1 rounded-full bg-gray-200 text-gray-500 font-medium">Rejeté</span>}
                            </td>
                            <td className={`px-5 py-3 text-right font-semibold ${annule ? "text-gray-400 line-through" : neg ? "text-orange-600" : "text-emerald-600"}`}>
                              {neg ? "−" : "+"} {formatCurrency(Math.abs(N(m.montant)))}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(N(m.soldeAvant))}</td>
                            <td className="px-5 py-3 text-right text-gray-800">{annule ? "—" : formatCurrency(N(m.soldeApres))}</td>
                            <td className="px-5 py-3 text-xs text-gray-600">
                              {m.user ? `${m.user.prenom} ${m.user.nom}` : "—"}
                              {m.agentApporteur && <span className="block text-[10px] text-gray-400">apporté par {m.agentApporteur.prenom} {m.agentApporteur.nom}</span>}
                            </td>
                            <td className="px-5 py-3 text-xs text-gray-500">{m.agence ?? "—"}</td>
                            <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{m.reference}</td>
                            <td className="px-5 py-3 text-[11px] text-gray-500 max-w-[200px] truncate" title={m.observation ?? ""}>{m.observation ?? "—"}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isAdmin && !annule && (
                                  <button onClick={() => openEditMvt(m)} title="Corriger ce mouvement"
                                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600">
                                    <Pencil className="w-3.5 h-3.5" /> Corriger
                                  </button>
                                )}
                                <a href={recuUrl(m.id)} target="_blank" rel="noopener noreferrer" title="Reçu PDF"
                                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600">
                                  <Printer className="w-3.5 h-3.5" /> Reçu
                                </a>
                              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">N° de jour (optionnel)</span>
                  <input type="number" min={1} value={numeroJour} onChange={(e) => setNumeroJour(e.target.value)} placeholder="Ex. 1, 2…"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Date du dépôt (optionnel)</span>
                  <input type="date" value={dateDepot} onChange={(e) => setDateDepot(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Agent apporteur (optionnel)</span>
                <select value={agentApporteur} onChange={(e) => setAgentApporteur(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">— Aucun —</option>
                  {collecteurs.map((a) => <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}
                </select>
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

      {/* Paiement crédit(s) via compte courant — modal partagé multi-crédits */}
      {payOpen && c && (
        <PayerCreditsModal
          compte={{ id: Number(params.id), numeroCompte: c.numeroCompte, solde: c.solde, clientNom: `${c.client.prenom} ${c.client.nom}` }}
          onClose={() => setPayOpen(false)}
          onDone={() => { refetch(); refetchMvt(); refetchCred(); }}
        />
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

      {/* Modal édition des informations du compte (admin) */}
      {editCompteOpen && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Pencil className="w-4 h-4 text-slate-600" /> Modifier le compte</h3>
              <button onClick={() => setEditCompteOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">Compte {c.numeroCompte} · le solde et les totaux ne sont pas modifiables (dérivés des mouvements).</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Libellé {c.typeCompte !== "INDIVIDUEL" ? "(nom du ménage / communauté)" : "(optionnel)"}</span>
                <input value={ecLibelle} onChange={(e) => setEcLibelle(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Code agence</span>
                  <input value={ecAgence} onChange={(e) => setEcAgence(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Code guichet</span>
                  <input value={ecGuichet} onChange={(e) => setEcGuichet(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Type de compte</span>
                <select value={ecType} onChange={(e) => setEcType(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">
                  {Object.keys(TYPE_COMPTE_LABEL).map((t) => <option key={t} value={t}>{TYPE_COMPTE_LABEL[t]}</option>)}
                </select>
              </label>
              <p className="text-[11px] text-gray-400">Modifier les codes agence/guichet régénère le RIB complet.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setEditCompteOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitEditCompte} disabled={ecSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {ecSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal correction d'un mouvement (admin) */}
      {editMvt && c && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Pencil className="w-4 h-4 text-indigo-600" /> Corriger le mouvement</h3>
              <button onClick={() => setEditMvt(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-500">{NATURE_LABEL[editMvt.nature] ?? editMvt.nature} · {editMvt.reference}</p>
              {emMontantEditable ? (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                  <input type="number" min={0} value={emMontant} onChange={(e) => setEmMontant(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-[11px] text-amber-600 mt-1 block">Corriger le montant recalcule le solde du compte et tout l&apos;historique postérieur.</span>
                </label>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">
                  Montant : <b>{formatCurrency(Math.abs(N(editMvt.montant)))}</b> — non modifiable pour ce type. Pour corriger le montant d&apos;un paiement crédit, annulez-le puis re-saisissez-le.
                </div>
              )}
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Observation</span>
                <input value={emObservation} onChange={(e) => setEmObservation(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Mode de paiement</span>
                  <select value={emMode} onChange={(e) => setEmMode(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">— Aucun —</option>
                    {MODES.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Agence</span>
                  <input value={emAgence} onChange={(e) => setEmAgence(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">N° de jour</span>
                  <input type="number" min={1} value={emNumeroJour} onChange={(e) => setEmNumeroJour(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Date d&apos;opération</span>
                  <input type="date" value={emDate} onChange={(e) => setEmDate(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setEditMvt(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={submitEditMvt} disabled={emSaving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {emSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Enregistrer
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

interface ClientHitMini {
  id: number; nom: string; prenom: string; telephone: string; codeClient: string | null;
}

// Gestion des membres d'un compte courant collectif (CDC §19.A).
function MembresSection({ compteId, membres, canManage, excludeIds, onChanged }:
  { compteId: number; membres: MembreCC[]; canManage: boolean; excludeIds: number[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ClientHitMini[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (!canManage || search.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/clients?search=${encodeURIComponent(search)}&limit=8`);
        const j = await r.json();
        setResults((j.data ?? []).filter((c: ClientHitMini) => !excludeIds.includes(c.id)));
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, canManage, excludeIds]);

  const ajouter = async (clientId: number) => {
    setAdding(clientId);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/membres`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, role: "MEMBRE" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Membre ajouté ✓");
      setSearch(""); setResults([]); onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setAdding(null); }
  };

  const modifier = async (mid: number, patch: { role?: string; quotePart?: string | null }) => {
    setBusyId(mid);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/membres/${mid}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  const retirer = async (mid: number) => {
    setBusyId(mid);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/membres/${mid}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Membre retiré ✓");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-indigo-500" /> Membres du compte
        <span className="text-xs font-normal text-gray-400">({membres.length})</span>
      </h3>

      <ul className="space-y-2">
        {membres.map((m) => {
          const titulaire = m.role === "TITULAIRE";
          return (
            <li key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {m.client.photoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={m.client.photoUrl} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-slate-500">{initials(m.client.prenom, m.client.nom)}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{m.client.prenom} {m.client.nom}</p>
                <p className="text-[11px] text-gray-400">{m.client.telephone}{m.client.codeClient ? ` · ${m.client.codeClient}` : ""}</p>
              </div>
              {titulaire ? (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">Titulaire</span>
              ) : canManage ? (
                <>
                  <select value={m.role} disabled={busyId === m.id}
                    onChange={(e) => modifier(m.id, { role: e.target.value })}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 disabled:opacity-50">
                    <option value="MEMBRE">Membre</option>
                    <option value="MANDATAIRE">Mandataire</option>
                  </select>
                  <input type="number" min={0} max={100} defaultValue={m.quotePart != null ? String(m.quotePart) : ""}
                    disabled={busyId === m.id} placeholder="% part" title="Quote-part (%)"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v !== (m.quotePart != null ? String(m.quotePart) : "")) modifier(m.id, { quotePart: v === "" ? null : v }); }}
                    className="w-16 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 disabled:opacity-50" />
                  <button onClick={() => retirer(m.id)} disabled={busyId === m.id} className="text-slate-400 hover:text-rose-500 disabled:opacity-50" title="Retirer">
                    {busyId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </>
              ) : (
                <span className="text-xs text-gray-500">
                  {ROLE_MEMBRE_LABEL[m.role] ?? m.role}{m.quotePart != null ? ` · ${m.quotePart}%` : ""}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {canManage && (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Ajouter un membre par nom, téléphone ou code…"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
          </div>
          {results.length > 0 && (
            <div className="mt-2 border border-slate-100 rounded-xl divide-y divide-slate-50 overflow-hidden">
              {results.map((c) => (
                <button key={c.id} type="button" onClick={() => ajouter(c.id)} disabled={adding === c.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/50 flex items-center justify-between disabled:opacity-50">
                  <span>
                    <span className="font-medium text-gray-800">{c.prenom} {c.nom}</span>
                    <span className="text-xs text-gray-400 ml-2">{c.telephone}{c.codeClient ? ` · ${c.codeClient}` : ""}</span>
                  </span>
                  {adding === c.id ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <UserPlus className="w-4 h-4 text-indigo-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Épargne programmée (CDC §19.B) ──────────────────────────────────────────

const FREQ_LABEL_FR: Record<string, string> = { QUOTIDIENNE: "Quotidienne", HEBDOMADAIRE: "Hebdomadaire", MENSUELLE: "Mensuelle" };
const FREQ_MOT: Record<string, string> = { QUOTIDIENNE: "/ jour", HEBDOMADAIRE: "/ semaine", MENSUELLE: "/ mois" };
const STATUT_PLAN_STYLE: Record<string, string> = {
  EN_COURS: "bg-blue-50 text-blue-700 border-blue-200",
  ATTEINT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ABANDONNE: "bg-gray-100 text-gray-600 border-gray-200",
  EXPIRE: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUT_PLAN_LABEL: Record<string, string> = {
  EN_COURS: "En cours", ATTEINT: "Objectif atteint", ABANDONNE: "Abandonné", EXPIRE: "Échu",
};

interface ProgressionUI {
  objectif: number; cumule: number; montantRestant: number; tauxProgression: number;
  periodesTotales: number; periodesEcoulees: number; montantAttenduADate: number;
  ecart: number; enRetard: boolean; joursRestants: number; prochaineCotisation: string | null;
}
interface PlanEpargneRow {
  id: number; libelle: string; objectifMontant: number; frequence: string;
  montantCotisation: number; dateDebut: string; dateEcheance: string;
  montantCumule: number; statut: string; dateAtteint: string | null; observation: string | null;
  progression: ProgressionUI; _count?: { cotisations: number };
}

function EpargneSection({ compteId, canManage, compteActif }:
  { compteId: number; canManage: boolean; compteActif: boolean }) {
  const { data, refetch } = useApi<{ data: PlanEpargneRow[] }>(`/api/comptes-courants/${compteId}/epargne`);
  const plans = data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [objectif, setObjectif] = useState("");
  const [frequence, setFrequence] = useState("MENSUELLE");
  const [cotisation, setCotisation] = useState("");
  const [echeance, setEcheance] = useState("");
  const [saving, setSaving] = useState(false);

  const [cotiser, setCotiser] = useState<PlanEpargneRow | null>(null);
  const [cotMontant, setCotMontant] = useState("");
  const [cotMode, setCotMode] = useState(MODES[0]);
  const [cotSaving, setCotSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const resetCreate = () => { setLibelle(""); setObjectif(""); setFrequence("MENSUELLE"); setCotisation(""); setEcheance(""); };

  const creer = async () => {
    if (!libelle.trim()) { toast.error("Intitulé requis"); return; }
    if (!objectif || Number(objectif) <= 0) { toast.error("Objectif invalide"); return; }
    if (!cotisation || Number(cotisation) <= 0) { toast.error("Cotisation invalide"); return; }
    if (!echeance) { toast.error("Échéance requise"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/epargne`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libelle: libelle.trim(), objectifMontant: Number(objectif), frequence, montantCotisation: Number(cotisation), dateEcheance: echeance }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Plan d'épargne créé ✓");
      setCreateOpen(false); resetCreate(); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const envoyerCotisation = async () => {
    if (!cotiser) return;
    if (!cotMontant || Number(cotMontant) <= 0) { toast.error("Montant invalide"); return; }
    setCotSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/epargne/${cotiser.id}/cotiser`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: Number(cotMontant), modePaiement: cotMode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(j.data?.atteint ? "Objectif atteint 🎯" : "Cotisation enregistrée ✓");
      setCotiser(null); setCotMontant(""); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setCotSaving(false); }
  };

  const changerStatut = async (plan: PlanEpargneRow, action: "ABANDONNER" | "REPRENDRE") => {
    setBusyId(plan.id);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/epargne/${plan.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(action === "ABANDONNER" ? "Plan abandonné" : "Plan repris ✓");
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-pink-500" /> Épargne programmée
          <span className="text-xs font-normal text-gray-400">({plans.length})</span>
        </h3>
        {canManage && compteActif && (
          <button onClick={() => { resetCreate(); setCreateOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Nouveau plan
          </button>
        )}
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Aucun plan d&apos;épargne. Définissez un objectif pour accompagner ce client.</p>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const pr = p.progression;
            const enCours = p.statut === "EN_COURS";
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 flex items-center gap-1.5"><Target className="w-4 h-4 text-pink-500" />{p.libelle}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_PLAN_STYLE[p.statut] ?? ""}`}>
                        {STATUT_PLAN_LABEL[p.statut] ?? p.statut}
                      </span>
                      {enCours && pr.enRetard && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">En retard</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatCurrency(p.montantCotisation)} {FREQ_MOT[p.frequence] ?? ""} · échéance {formatDate(p.dateEcheance)}
                      {enCours && pr.joursRestants >= 0 ? ` · ${pr.joursRestants} j restants` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(p.montantCumule)}</p>
                    <p className="text-[11px] text-gray-400">/ {formatCurrency(p.objectifMontant)}</p>
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${p.statut === "ATTEINT" ? "bg-emerald-500" : pr.enRetard ? "bg-amber-500" : "bg-pink-500"}`}
                    style={{ width: `${Math.min(100, pr.tauxProgression)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-500">
                  <span>{pr.tauxProgression}% atteint</span>
                  {enCours && (
                    <span className={pr.ecart < 0 ? "text-amber-600" : "text-emerald-600"}>
                      {pr.ecart < 0 ? `Retard ${formatCurrency(Math.abs(pr.ecart))}` : `Avance ${formatCurrency(pr.ecart)}`}
                      {" "}(attendu {formatCurrency(pr.montantAttenduADate)})
                    </span>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-2 mt-3">
                    {enCours && compteActif && (
                      <button onClick={() => { setCotiser(p); setCotMontant(String(p.montantCotisation)); setCotMode(MODES[0]); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg text-xs font-medium">
                        <Plus className="w-3.5 h-3.5" /> Cotiser
                      </button>
                    )}
                    {enCours && (
                      <button onClick={() => changerStatut(p, "ABANDONNER")} disabled={busyId === p.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium disabled:opacity-50">
                        <Ban className="w-3.5 h-3.5" /> Abandonner
                      </button>
                    )}
                    {p.statut === "ABANDONNE" && (
                      <button onClick={() => changerStatut(p, "REPRENDRE")} disabled={busyId === p.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-medium disabled:opacity-50">
                        <Activity className="w-3.5 h-3.5" /> Reprendre
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création de plan */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setCreateOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><PiggyBank className="w-5 h-5 text-pink-500" /> Nouveau plan d&apos;épargne</h4>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Objectif</span>
                <input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Ex. Achat moto, Rentrée scolaire…"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Montant objectif (FCFA)</span>
                  <input type="number" min={0} value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="300000"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Échéance</span>
                  <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Fréquence</span>
                  <select value={frequence} onChange={(e) => setFrequence(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500">
                    {Object.keys(FREQ_LABEL_FR).map((f) => <option key={f} value={f}>{FREQ_LABEL_FR[f]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Cotisation (FCFA)</span>
                  <input type="number" min={0} value={cotisation} onChange={(e) => setCotisation(e.target.value)} placeholder="50000"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </label>
              </div>
              <button onClick={creer} disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PiggyBank className="w-4 h-4" />} Créer le plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cotisation */}
      {cotiser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !cotSaving && setCotiser(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><Target className="w-5 h-5 text-pink-500" /> Cotiser</h4>
              <button onClick={() => setCotiser(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">{cotiser.libelle} · {formatCurrency(cotiser.montantCumule)} / {formatCurrency(cotiser.objectifMontant)}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant (FCFA)</span>
                <input type="number" min={0} value={cotMontant} onChange={(e) => setCotMontant(e.target.value)} autoFocus
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Mode de paiement</span>
                <select value={cotMode} onChange={(e) => setCotMode(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pink-500">
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <p className="text-[11px] text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> La cotisation est un dépôt crédité sur le compte courant.</p>
              <button onClick={envoyerCotisation} disabled={cotSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {cotSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Enregistrer la cotisation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Prélèvement automatique des échéances (CDC §19.C) ───────────────────────

interface AutorisationRow {
  id: number; actif: boolean; montantMax: number | null; montantMinSolde: number | null;
  dernierPrelevementAt: string | null; totalPreleve: number; nbPrelevements: number; createdAt: string;
  credit: { id: number; reference: string; statut: string; soldeRestant: number; montantTotal: number; montantJournalier: number };
  creePar: { nom: string; prenom: string } | null;
}

function PrelevementsSection({ compteId, canManage, compteActif, creditsPayables }:
  { compteId: number; canManage: boolean; compteActif: boolean; creditsPayables: CreditPayable[] }) {
  const { data, refetch } = useApi<{ data: AutorisationRow[] }>(`/api/comptes-courants/${compteId}/prelevements`);
  const autorisations = data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [creditId, setCreditId] = useState("");
  const [montantMax, setMontantMax] = useState("");
  const [montantMinSolde, setMontantMinSolde] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const dejaAutorises = new Set(autorisations.map((a) => a.credit.id));
  const creditsDispo = creditsPayables.filter((c) => !dejaAutorises.has(c.creditId));

  const creer = async () => {
    if (!creditId) { toast.error("Sélectionnez un crédit"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/prelevements`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditId: Number(creditId),
          montantMax: montantMax.trim() ? Number(montantMax) : null,
          montantMinSolde: montantMinSolde.trim() ? Number(montantMinSolde) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Prélèvement automatique activé ✓");
      setCreateOpen(false); setCreditId(""); setMontantMax(""); setMontantMinSolde(""); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const basculer = async (a: AutorisationRow) => {
    setBusyId(a.id);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/prelevements/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: a.actif ? "DESACTIVER" : "ACTIVER" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(a.actif ? "Prélèvement suspendu" : "Prélèvement réactivé ✓");
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  const supprimer = async (a: AutorisationRow) => {
    setBusyId(a.id);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/prelevements/${a.id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Autorisation supprimée");
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-indigo-500" /> Prélèvement automatique
          <span className="text-xs font-normal text-gray-400">({autorisations.length})</span>
        </h3>
        {canManage && compteActif && creditsDispo.length > 0 && (
          <button onClick={() => { setCreditId(""); setMontantMax(""); setMontantMinSolde(""); setCreateOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> Autoriser un crédit
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mb-4">Le système règle automatiquement les échéances dues en débitant le compte courant (exécution quotidienne).</p>

      {autorisations.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Aucun prélèvement automatique configuré.</p>
      ) : (
        <div className="space-y-2">
          {autorisations.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-indigo-500" /> {a.credit.reference}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${a.actif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {a.actif ? "Actif" : "Suspendu"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Reste dû {formatCurrency(a.credit.soldeRestant)} · échéance/jour {formatCurrency(a.credit.montantJournalier)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {a.montantMax != null ? `Plafond ${formatCurrency(a.montantMax)}/exécution · ` : ""}
                    {a.montantMinSolde != null ? `garde ${formatCurrency(a.montantMinSolde)} · ` : ""}
                    {a.nbPrelevements} prélèvement(s), {formatCurrency(a.totalPreleve)} au total
                    {a.dernierPrelevementAt ? ` · dernier ${formatDate(a.dernierPrelevementAt)}` : ""}
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => basculer(a)} disabled={busyId === a.id}
                      title={a.actif ? "Suspendre" : "Réactiver"}
                      className={`p-1.5 rounded-lg border disabled:opacity-50 ${a.actif ? "border-amber-200 text-amber-600 hover:bg-amber-50" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
                      {busyId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    </button>
                    <button onClick={() => supprimer(a)} disabled={busyId === a.id}
                      title="Supprimer" className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création d'autorisation */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setCreateOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><Repeat className="w-5 h-5 text-indigo-500" /> Autoriser un prélèvement</h4>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Crédit à prélever</span>
                <select value={creditId} onChange={(e) => setCreditId(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Sélectionner —</option>
                  {creditsDispo.map((c) => (
                    <option key={c.creditId} value={c.creditId}>{c.reference} — reste {formatCurrency(c.soldeRestant)}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Plafond / exécution</span>
                  <input type="number" min={0} value={montantMax} onChange={(e) => setMontantMax(e.target.value)} placeholder="illimité"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-500">Solde à préserver</span>
                  <input type="number" min={0} value={montantMinSolde} onChange={(e) => setMontantMinSolde(e.target.value)} placeholder="paramétrage"
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </label>
              </div>
              <p className="text-[11px] text-gray-400">Chaque jour, l&apos;échéance due est réglée depuis le compte courant, dans la limite du plafond et sans descendre sous le solde à préserver.</p>
              <button onClick={creer} disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />} Activer le prélèvement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Programme de fidélité / récompenses (CDC §19.D) ─────────────────────────

const NIVEAU_STYLE: Record<string, string> = {
  BRONZE: "bg-amber-100 text-amber-800 border-amber-300",
  ARGENT: "bg-slate-100 text-slate-600 border-slate-300",
  OR: "bg-yellow-100 text-yellow-700 border-yellow-300",
  PLATINE: "bg-violet-100 text-violet-700 border-violet-300",
};
const NIVEAU_LABEL: Record<string, string> = { BRONZE: "Bronze", ARGENT: "Argent", OR: "Or", PLATINE: "Platine" };
const FID_TYPE_LABEL: Record<string, string> = { GAIN: "Gain", BONUS: "Bonus", DEPENSE: "Dépense", AJUSTEMENT: "Ajustement" };

interface FideliteData {
  soldePoints: number; totalGagnes: number; totalUtilises: number; niveau: string;
  avantages: { reductionFraisDossier: number; prioriteCredit: boolean; cadeaux: boolean };
  progression: { prochainNiveau: string | null; seuilProchain: number | null; restant: number; pct: number };
  bareme: { pointsParMontant: number; bonusParDepot: number };
  historique: { id: number; type: string; points: number; motif: string; source: string | null; createdAt: string; creePar: { nom: string; prenom: string } | null }[];
}

function FideliteSection({ compteId, canManage }: { compteId: number; canManage: boolean }) {
  const { data, refetch } = useApi<{ data: FideliteData }>(`/api/comptes-courants/${compteId}/fidelite`);
  const f = data?.data;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"BONUS" | "DEPENSE" | "AJUSTEMENT">("BONUS");
  const [points, setPoints] = useState("");
  const [signe, setSigne] = useState("+");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);

  const soumettre = async () => {
    if (!points || Number(points) <= 0) { toast.error("Nombre de points invalide"); return; }
    if (!motif.trim()) { toast.error("Motif requis"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/fidelite/ajuster`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, points: Number(points), motif: motif.trim(), ...(type === "AJUSTEMENT" ? { signe } : {}) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Points mis à jour ✓");
      setOpen(false); setPoints(""); setMotif(""); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  if (!f) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Award className="w-4 h-4 text-yellow-500" /> Fidélité &amp; récompenses
        </h3>
        {canManage && (
          <button onClick={() => { setType("BONUS"); setPoints(""); setSigne("+"); setMotif(""); setOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Attribuer / utiliser
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Solde de points + niveau */}
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="text-2xl font-extrabold text-gray-900">{f.soldePoints.toLocaleString("fr-FR")}</span>
            <span className="text-xs text-gray-400">points</span>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${NIVEAU_STYLE[f.niveau] ?? ""}`}>
            Niveau {NIVEAU_LABEL[f.niveau] ?? f.niveau}
          </span>
          <p className="text-[11px] text-gray-400 mt-2">Gagnés {f.totalGagnes.toLocaleString("fr-FR")} · utilisés {f.totalUtilises.toLocaleString("fr-FR")}</p>
        </div>

        {/* Progression niveau suivant */}
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Progression</p>
          {f.progression.prochainNiveau ? (
            <>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-yellow-400" style={{ width: `${f.progression.pct}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                {f.progression.restant.toLocaleString("fr-FR")} pts pour {NIVEAU_LABEL[f.progression.prochainNiveau]}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-violet-600 flex items-center gap-1"><Sparkles className="w-4 h-4" /> Niveau maximum atteint</p>
          )}
          <p className="text-[10px] text-gray-400 mt-2">1 pt / {f.bareme.pointsParMontant.toLocaleString("fr-FR")} FCFA{f.bareme.bonusParDepot > 0 ? ` · +${f.bareme.bonusParDepot} pts/dépôt` : ""}</p>
        </div>

        {/* Avantages du niveau */}
        <div className="rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Avantages</p>
          <ul className="space-y-1 text-xs text-gray-600">
            <li className="flex items-center gap-1.5">
              <span className={f.avantages.reductionFraisDossier > 0 ? "text-emerald-500" : "text-slate-300"}>●</span>
              Réduction frais de dossier {f.avantages.reductionFraisDossier > 0 ? `−${f.avantages.reductionFraisDossier}%` : "—"}
            </li>
            <li className="flex items-center gap-1.5">
              <span className={f.avantages.prioriteCredit ? "text-emerald-500" : "text-slate-300"}>●</span>
              Priorité sur les crédits {f.avantages.prioriteCredit ? "✓" : "—"}
            </li>
            <li className="flex items-center gap-1.5">
              <Gift className={`w-3.5 h-3.5 ${f.avantages.cadeaux ? "text-pink-500" : "text-slate-300"}`} />
              Cadeaux {f.avantages.cadeaux ? "✓" : "—"}
            </li>
          </ul>
        </div>
      </div>

      {/* Historique des points */}
      {f.historique.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Derniers mouvements de points</p>
          <div className="divide-y divide-slate-50 border border-slate-100 rounded-xl overflow-hidden">
            {f.historique.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="text-gray-700">{t.motif}</span>
                  <span className="text-gray-400 ml-2">{FID_TYPE_LABEL[t.type] ?? t.type} · {formatDate(t.createdAt)}</span>
                </div>
                <span className={`font-semibold shrink-0 ${t.points >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {t.points >= 0 ? "+" : ""}{t.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal attribution / utilisation */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles className="w-5 h-5 text-yellow-500" /> Points de fidélité</h4>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Opération</span>
                <select value={type} onChange={(e) => setType(e.target.value as "BONUS" | "DEPENSE" | "AJUSTEMENT")}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                  <option value="BONUS">Attribuer un bonus (+)</option>
                  <option value="DEPENSE">Utiliser des points (cadeau / avantage) (−)</option>
                  <option value="AJUSTEMENT">Ajustement (+/−)</option>
                </select>
              </label>
              <div className="flex gap-2">
                {type === "AJUSTEMENT" && (
                  <select value={signe} onChange={(e) => setSigne(e.target.value)}
                    className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50">
                    <option value="+">+</option>
                    <option value="-">−</option>
                  </select>
                )}
                <label className="block flex-1">
                  <span className="text-xs font-semibold text-slate-500">Points</span>
                  <input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} autoFocus
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif</span>
                <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. cadeau anniversaire, geste commercial…"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-500" />
              </label>
              {type === "DEPENSE" && f.soldePoints > 0 && (
                <p className="text-[11px] text-gray-400">Solde disponible : {f.soldePoints.toLocaleString("fr-FR")} points.</p>
              )}
              <button onClick={soumettre} disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />} Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Blocage volontaire de l'épargne (CDC §19.E) ─────────────────────────────

const STATUT_BLOCAGE_STYLE: Record<string, string> = {
  ACTIF: "bg-indigo-50 text-indigo-700 border-indigo-200",
  LIBERE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ANNULE: "bg-gray-100 text-gray-500 border-gray-200",
};
const STATUT_BLOCAGE_LABEL: Record<string, string> = { ACTIF: "Bloqué", LIBERE: "Libéré", ANNULE: "Annulé" };

interface BlocageRow {
  id: number; montant: number; motif: string | null; dateBlocage: string; dateDeblocage: string;
  statut: string; libereLe: string | null; createdAt: string; creePar: { nom: string; prenom: string } | null;
}
interface BlocageData { solde: number; montantBloque: number; soldeDisponible: number; blocages: BlocageRow[] }

function BlocageSection({ compteId, canManage, compteActif, onChanged }:
  { compteId: number; canManage: boolean; compteActif: boolean; onChanged: () => void }) {
  const { data, refetch } = useApi<{ data: BlocageData }>(`/api/comptes-courants/${compteId}/blocages`);
  const d = data?.data;

  const [open, setOpen] = useState(false);
  const [montant, setMontant] = useState("");
  const [dateDeblocage, setDateDeblocage] = useState("");
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = () => { refetch(); onChanged(); };

  const bloquer = async () => {
    if (!montant || Number(montant) <= 0) { toast.error("Montant invalide"); return; }
    if (!dateDeblocage) { toast.error("Date de déblocage requise"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/blocages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ montant: Number(montant), dateDeblocage, motif: motif.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Épargne bloquée ✓");
      setOpen(false); setMontant(""); setDateDeblocage(""); setMotif(""); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const agir = async (b: BlocageRow, action: "LIBERER" | "ANNULER") => {
    setBusyId(b.id);
    try {
      const r = await fetch(`/api/comptes-courants/${compteId}/blocages/${b.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(action === "LIBERER" ? "Fonds débloqués ✓" : "Blocage annulé");
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyId(null); }
  };

  if (!d) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-500" /> Épargne bloquée
        </h3>
        {canManage && compteActif && d.soldeDisponible > 0 && (
          <button onClick={() => { setMontant(""); setDateDeblocage(""); setMotif(""); setOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium">
            <Lock className="w-3.5 h-3.5" /> Bloquer une épargne
          </button>
        )}
      </div>

      {/* Synthèse disponible / bloqué */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-[11px] text-gray-400">Disponible</p>
          <p className="text-lg font-bold text-emerald-600">{formatCurrency(d.soldeDisponible)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-[11px] text-gray-400">Bloqué</p>
          <p className="text-lg font-bold text-indigo-600">{formatCurrency(d.montantBloque)}</p>
        </div>
      </div>

      {d.blocages.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Aucun blocage d&apos;épargne.</p>
      ) : (
        <div className="space-y-2">
          {d.blocages.map((b) => {
            const actif = b.statut === "ACTIF";
            return (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 flex items-center gap-1.5">
                    {formatCurrency(b.montant)}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_BLOCAGE_STYLE[b.statut] ?? ""}`}>
                      {STATUT_BLOCAGE_LABEL[b.statut] ?? b.statut}
                    </span>
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {actif ? `Jusqu'au ${formatDate(b.dateDeblocage)}` : `${b.statut === "LIBERE" ? "Libéré" : "Annulé"} le ${b.libereLe ? formatDate(b.libereLe) : "—"}`}
                    {b.motif ? ` · ${b.motif}` : ""}
                  </p>
                </div>
                {canManage && actif && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => agir(b, "LIBERER")} disabled={busyId === b.id}
                      title="Débloquer par anticipation"
                      className="p-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                      {busyId === b.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    </button>
                    <button onClick={() => agir(b, "ANNULER")} disabled={busyId === b.id}
                      title="Annuler le blocage" className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 disabled:opacity-50">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal blocage */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-gray-800 flex items-center gap-2"><Lock className="w-5 h-5 text-indigo-500" /> Bloquer une épargne</h4>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Disponible : {formatCurrency(d.soldeDisponible)}</p>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Montant à bloquer (FCFA)</span>
                <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} autoFocus
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Débloqué le</span>
                <input type="date" value={dateDeblocage} onChange={(e) => setDateDeblocage(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Motif <span className="font-normal text-slate-400">(optionnel)</span></span>
                <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. achat d'un terrain…"
                  className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </label>
              <p className="text-[11px] text-gray-400">Les fonds bloqués restent indisponibles (retrait, paiement, prélèvement) jusqu&apos;à la date choisie.</p>
              <button onClick={bloquer} disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Bloquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activité multi-agences (CDC §19.F) ──────────────────────────────────────

interface AgenceRow { agence: string; nbOperations: number; totalEntrees: number; totalSorties: number }

function AgencesSection({ compteId, agenceDomiciliation }: { compteId: number; agenceDomiciliation: string }) {
  const { data } = useApi<{ data: AgenceRow[] }>(`/api/comptes-courants/${compteId}/agences`);
  const lignes = data?.data ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-teal-500" /> Activité par agence
      </h3>
      <p className="text-[11px] text-gray-400 mb-4">
        Compte domicilié à <span className="font-medium">{agenceDomiciliation}</span> — utilisable dans toutes les agences AfriSime (synchronisation temps réel).
      </p>

      {lignes.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">Aucune opération enregistrée.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-2 font-semibold">Agence d&apos;opération</th>
                <th className="text-center py-2 font-semibold">Opérations</th>
                <th className="text-right py-2 font-semibold">Entrées</th>
                <th className="text-right py-2 font-semibold">Sorties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lignes.map((l) => (
                <tr key={l.agence}>
                  <td className="py-2.5 text-gray-800 font-medium flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-teal-400" /> {l.agence}
                  </td>
                  <td className="py-2.5 text-center text-gray-600">{l.nbOperations}</td>
                  <td className="py-2.5 text-right text-emerald-600 font-medium">{formatCurrency(l.totalEntrees)}</td>
                  <td className="py-2.5 text-right text-orange-600 font-medium">{formatCurrency(l.totalSorties)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
