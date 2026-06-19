"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  ChevronLeft, GitBranch, Send, Inbox, Clock, Hourglass,
  CheckCircle2, XCircle, Archive, MessageSquare,
  Save, TrendingUp, AlertTriangle, Wallet, Percent, History,
} from "lucide-react";
import { DemandeFinancementEditor } from "@/components/gouvernance/DemandeFinancementEditor";
import { PortefeuilleSelect } from "@/components/gouvernance/PortefeuilleSelect";

const MEMBRE_API = {
  clientsApiBase: "/api/membreCommission/clients",
  portefeuillesApiBase: "/api/membreCommission/portefeuilles",
  investisseursApiBase: "/api/membreCommission/investisseurs",
  gestionnairesApiBase: "/api/membreCommission/gestionnaires",
};

/* ─── Types ─── */
interface ProduitFinancement { nom: string; quantite: number; coutAchat: number; prixRevente: number }
interface ClientFinancement { clientId: number; nom?: string; montant: number; produits?: ProduitFinancement[] }
interface ContenuDF {
  region?: string; agence?: string;
  clients?: ClientFinancement[];
  dureeCycleJours?: number;
  risqueEstime?: "FAIBLE" | "MOYEN" | "ELEVE";
  investisseursConcernes?: number[];
  piecesJointesUrls?: string[];
}
interface VersionIC { id: number; version: number; contenu: ContenuDF; motif: string | null; createdAt: string; modifiePar: { id: number; nom: string; prenom: string } }
interface EchangeIC { id: number; commission: string; type: string; contenu: string; createdAt: string; auteur: { id: number; nom: string; prenom: string } }
interface Analyse {
  montantTotal: number; margeTotale: number; roiEstime: number; tauxRisque: number;
  probabiliteRemboursement: number; impactTresorerie: number | null; rentabiliteAttendue: number;
  nbClients: number; scoreMoyenSolvabilite: number | null;
}
interface ConsultationPortefeuille {
  id: number; reference: string; nom: string | null; investisseur: string | null;
  capitalDisponible: number; capitalEngage: number; capitalInvesti: number;
}
interface ConsultationClient {
  clientId: number; nom: string; scoreSolvabilite: number | null;
  nbFinancements: number; montantFinanceTotal: number; encoursTotal: number;
}
interface Consultation { portefeuilles: ConsultationPortefeuille[]; clients: ConsultationClient[] }
interface DossierDetail {
  id: number; reference: string; titre: string; description: string | null;
  type: string; statut: string;
  commissionEmettrice: string; commissionReceptrice: string;
  montantDemande: string | number | null; montantApprouve: string | number | null;
  portefeuilleExecutionId: number | null;
  portefeuilleExecution: { id: number; reference: string; nom: string | null; capitalDisponible: string | number } | null;
  versionCourante: number;
  creePar: { id: number; nom: string; prenom: string };
  validePar: { id: number; nom: string; prenom: string } | null;
  versions: VersionIC[];
  echanges: EchangeIC[];
  analyse: Analyse | null;
  consultation: Consultation | null;
  monRoleEmettrice: string | null;
  monRoleReceptrice: string | null;
  superviseur: boolean;
  createdAt: string;
}

const STATUT_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  EN_PREPARATION:      { label: "En préparation",      color: "bg-slate-100 text-slate-600",     icon: <GitBranch className="w-4 h-4" /> },
  TRANSMIS:            { label: "Transmis",            color: "bg-blue-100 text-blue-700",       icon: <Send className="w-4 h-4" /> },
  RECU:                { label: "Reçu",                color: "bg-indigo-100 text-indigo-700",   icon: <Inbox className="w-4 h-4" /> },
  EN_ANALYSE:          { label: "En analyse",          color: "bg-amber-100 text-amber-700",     icon: <Clock className="w-4 h-4" /> },
  EN_ATTENTE_DECISION: { label: "En attente décision", color: "bg-orange-100 text-orange-700",   icon: <Hourglass className="w-4 h-4" /> },
  APPROUVE:            { label: "Financement autorisé", color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-4 h-4" /> },
  REJETE:              { label: "Rejeté",              color: "bg-rose-100 text-rose-700",       icon: <XCircle className="w-4 h-4" /> },
  EN_COURS_EXECUTION:  { label: "En cours d'exécution", color: "bg-cyan-100 text-cyan-700",      icon: <Wallet className="w-4 h-4" /> },
  EXECUTE:             { label: "Clôturé",             color: "bg-teal-100 text-teal-700",       icon: <Archive className="w-4 h-4" /> },
};
const COMM_LABELS: Record<string, string> = {
  FINANCE: "Finance", OPERATIONS_TERRAIN: "Opérations", AUDIT: "Audit & Contrôle", OPTIMISATION: "Optimisation",
};

// gate = rôle requis (CDC) pour afficher l'action : Président émettrice, Président
// réceptrice, ou analyse réceptrice (Rapporteurs + Président).
type Gate = "EMETTRICE_PRESIDENT" | "RECEPTRICE_PRESIDENT" | "RECEPTRICE_ANALYSE";
type ActionDef = { action: string; label: string; gate: Gate; needsComment?: boolean; isApprouver?: boolean; isDanger?: boolean };
const ACTIONS_PAR_STATUT: Record<string, ActionDef[]> = {
  EN_PREPARATION: [{ action: "TRANSMETTRE", label: "Transmettre au Président", gate: "EMETTRICE_PRESIDENT" }],
  TRANSMIS: [{ action: "VALIDER_RECEPTION", label: "Valider la réception", gate: "RECEPTRICE_ANALYSE" }],
  RECU: [{ action: "METTRE_EN_ANALYSE", label: "Mettre en analyse", gate: "RECEPTRICE_ANALYSE" }],
  EN_ANALYSE: [
    { action: "METTRE_EN_ATTENTE", label: "Mettre en attente de décision", gate: "RECEPTRICE_ANALYSE" },
    { action: "APPROUVER", label: "Approuver", isApprouver: true, gate: "RECEPTRICE_PRESIDENT" },
    { action: "DEMANDER_AJUSTEMENT", label: "Demander un ajustement", needsComment: true, gate: "RECEPTRICE_PRESIDENT" },
    { action: "REJETER", label: "Rejeter", needsComment: true, isDanger: true, gate: "RECEPTRICE_PRESIDENT" },
  ],
  EN_ATTENTE_DECISION: [
    { action: "APPROUVER", label: "Approuver", isApprouver: true, gate: "RECEPTRICE_PRESIDENT" },
    { action: "DEMANDER_AJUSTEMENT", label: "Demander un ajustement", needsComment: true, gate: "RECEPTRICE_PRESIDENT" },
    { action: "REJETER", label: "Rejeter", needsComment: true, isDanger: true, gate: "RECEPTRICE_PRESIDENT" },
  ],
  APPROUVE: [{ action: "EXECUTER", label: "Décaisser & affecter les clients", gate: "RECEPTRICE_PRESIDENT" }],
  EN_COURS_EXECUTION: [{ action: "CLOTURER", label: "Clôturer le dossier", gate: "RECEPTRICE_PRESIDENT" }],
};
const ROLES_ANALYSE_UI = ["PRESIDENT", "RAPPORTEUR_1", "RAPPORTEUR_2"];
// L'appelant peut-il déclencher cette action (selon son rôle de siège) ?
function peutAgir(def: ActionDef, ctx: { superviseur: boolean; monRoleEmettrice: string | null; monRoleReceptrice: string | null }): boolean {
  if (ctx.superviseur) return true;
  if (def.gate === "EMETTRICE_PRESIDENT") return ctx.monRoleEmettrice === "PRESIDENT";
  if (def.gate === "RECEPTRICE_PRESIDENT") return ctx.monRoleReceptrice === "PRESIDENT";
  return ROLES_ANALYSE_UI.includes(ctx.monRoleReceptrice ?? "");
}

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("fr-FR");
}

/* ─── Modale d'action (commentaire / approbation) ─── */
function ActionModal({ def, dossier, onClose, onSubmit }: {
  def: ActionDef; dossier: DossierDetail; onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [commentaire, setCommentaire] = useState("");
  const [montantApprouve, setMontantApprouve] = useState(String(dossier.montantDemande ?? ""));
  const [portefeuilleExecutionId, setPortefeuilleExecutionId] = useState(
    dossier.portefeuilleExecutionId ? String(dossier.portefeuilleExecutionId) : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const body: Record<string, unknown> = { action: def.action };
    if (commentaire) body.commentaire = commentaire;
    if (def.isApprouver) {
      if (!portefeuilleExecutionId) { toast.error("Sélectionnez le portefeuille d'exécution"); setSubmitting(false); return; }
      body.montantApprouve = Number(montantApprouve);
      body.portefeuilleExecutionId = Number(portefeuilleExecutionId);
    }
    await onSubmit(body);
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{def.label}</h2>
        </div>
        <div className="p-6 space-y-4">
          {def.isApprouver && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Montant approuvé (FCFA)</label>
                <input type="number" value={montantApprouve} onChange={e => setMontantApprouve(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Portefeuille d&apos;exécution</label>
                <PortefeuilleSelect apiBase="/api/membreCommission/portefeuilles" value={portefeuilleExecutionId}
                  onChange={setPortefeuilleExecutionId} montantRequis={Number(montantApprouve) || undefined} />
              </div>
            </>
          )}
          {(def.needsComment || def.isApprouver) && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {def.needsComment ? "Observation *" : "Commentaire (optionnel)"}
              </label>
              <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                placeholder={def.action === "DEMANDER_AJUSTEMENT" ? "Ex: Réduire le financement à 40 000 000 FCFA, exclure les clients sous 60% de solvabilité..." : ""} />
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button
            onClick={submit}
            disabled={submitting || (def.needsComment && !commentaire)}
            className={`px-5 py-2 text-sm font-medium rounded-lg disabled:opacity-50 ${def.isDanger ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"}`}>
            {submitting ? "Envoi..." : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Formulaire structuré Demande de Financement ─── */
function FormulaireFinancement({ dossier, editable, onSaved }: { dossier: DossierDetail; editable: boolean; onSaved: () => void }) {
  const versionCourante = dossier.versions.find(v => v.version === dossier.versionCourante);
  const [contenu, setContenu] = useState<ContenuDF>(versionCourante?.contenu ?? {});
  const [dirty, setDirty] = useState(false);
  const [versionChargee, setVersionChargee] = useState(versionCourante?.id);
  const { mutate, loading } = useMutation(`/api/membreCommission/dossiers/${dossier.id}`, "PATCH");

  // Resynchronise le formulaire quand une nouvelle version arrive (ex: après refetch post-sauvegarde)
  if (versionCourante?.id !== versionChargee) {
    setVersionChargee(versionCourante?.id);
    setContenu(versionCourante?.contenu ?? {});
    setDirty(false);
  }

  function handleChange(v: ContenuDF) {
    setContenu(v);
    setDirty(true);
  }

  async function save() {
    const montantDemande = (contenu.clients ?? []).reduce((s, c) => s + Number(c.montant || 0), 0);
    const res = await mutate({ contenuRevise: contenu, motifRevision: "Mise à jour du formulaire", montantDemande });
    if (res) { toast.success(`Nouvelle version créée (v${(dossier.versionCourante ?? 1) + 1})`); setDirty(false); onSaved(); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Demande de financement</h3>
        {editable && dirty && (
          <button onClick={save} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {loading ? "Enregistrement..." : "Enregistrer (nouvelle version)"}
          </button>
        )}
      </div>

      <DemandeFinancementEditor value={contenu} onChange={handleChange} disabled={!editable} {...MEMBRE_API} />
    </div>
  );
}


/* ─── Panneau d'analyse automatique (Scénario 2) ─── */
function AnalysePanel({ analyse }: { analyse: Analyse }) {
  const items = [
    { label: "ROI estimé", value: `${analyse.roiEstime.toFixed(1)}%`, icon: <TrendingUp className="w-4 h-4" />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Taux de risque", value: `${analyse.tauxRisque.toFixed(1)}%`, icon: <AlertTriangle className="w-4 h-4" />, color: analyse.tauxRisque > 50 ? "text-rose-600 bg-rose-50" : "text-amber-600 bg-amber-50" },
    { label: "Probabilité de remboursement", value: `${analyse.probabiliteRemboursement.toFixed(1)}%`, icon: <Percent className="w-4 h-4" />, color: "text-blue-600 bg-blue-50" },
    { label: "Impact trésorerie", value: analyse.impactTresorerie !== null ? `${analyse.impactTresorerie.toFixed(1)}%` : "—", icon: <Wallet className="w-4 h-4" />, color: "text-violet-600 bg-violet-50" },
    { label: "Rentabilité attendue", value: `${fmt(analyse.rentabiliteAttendue)} FCFA`, icon: <TrendingUp className="w-4 h-4" />, color: "text-teal-600 bg-teal-50" },
  ];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Analyse automatique</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {items.map(it => (
          <div key={it.label} className={`rounded-lg p-3 ${it.color}`}>
            <div className="flex items-center gap-1.5 mb-1">{it.icon}<span className="text-[11px] font-medium">{it.label}</span></div>
            <p className="text-base font-bold">{it.value}</p>
          </div>
        ))}
      </div>
      {analyse.scoreMoyenSolvabilite === null && (
        <p className="text-xs text-slate-400 mt-2">Aucun score de solvabilité disponible pour les clients listés — valeurs neutres utilisées.</p>
      )}
    </div>
  );
}

/* ─── Aides à la consultation (Scénario 2) ─── */
function ConsultationPanel({ consultation }: { consultation: Consultation }) {
  const { portefeuilles, clients } = consultation;
  if (portefeuilles.length === 0 && clients.length === 0) return null;
  const fondsTotal = portefeuilles.reduce((s, p) => s + p.capitalDisponible, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Wallet className="w-4 h-4" /> Aide à la décision
      </h3>

      {portefeuilles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-slate-500">Portefeuilles investisseurs ciblés</p>
            <p className="text-xs text-slate-500">Fonds disponibles : <span className="font-semibold text-emerald-600">{fmt(fondsTotal)} FCFA</span></p>
          </div>
          <div className="space-y-2">
            {portefeuilles.map(p => (
              <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700">{p.reference}{p.nom ? ` · ${p.nom}` : ""}</p>
                  {p.investisseur && <p className="text-slate-400">{p.investisseur}</p>}
                </div>
                <div className="flex gap-4 shrink-0 text-right">
                  <div><p className="text-slate-400">Disponible</p><p className="font-semibold text-emerald-600">{fmt(p.capitalDisponible)}</p></div>
                  <div><p className="text-slate-400">Engagé</p><p className="font-medium text-slate-600">{fmt(p.capitalEngage)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {clients.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Historique de financement des clients</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-100">
                  <th className="py-1.5 pr-2 font-medium">Client</th>
                  <th className="py-1.5 px-2 font-medium">Solvabilité</th>
                  <th className="py-1.5 px-2 font-medium text-right">Financements</th>
                  <th className="py-1.5 px-2 font-medium text-right">Financé (cumul)</th>
                  <th className="py-1.5 pl-2 font-medium text-right">Encours</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.clientId} className="border-b border-slate-50">
                    <td className="py-1.5 pr-2 text-slate-700">{c.nom}</td>
                    <td className="py-1.5 px-2">
                      {c.scoreSolvabilite != null ? (
                        <span className={`px-1.5 py-0.5 rounded ${c.scoreSolvabilite >= 60 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                          {c.scoreSolvabilite}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{c.nbFinancements}</td>
                    <td className="py-1.5 px-2 text-right text-slate-600">{fmt(c.montantFinanceTotal)}</td>
                    <td className="py-1.5 pl-2 text-right font-medium text-slate-700">{fmt(c.encoursTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DossierDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: dossier, loading, refetch } = useApi<DossierDetail>(`/api/membreCommission/dossiers/${id}`);
  const { mutate: mutatePatch } = useMutation(`/api/membreCommission/dossiers/${id}`, "PATCH");
  const { mutate: mutateEchange } = useMutation(`/api/membreCommission/dossiers/${id}/echanges`, "POST");
  const [modalAction, setModalAction] = useState<ActionDef | null>(null);
  const [nouvelEchange, setNouvelEchange] = useState("");

  async function runAction(body: Record<string, unknown>) {
    const res = await mutatePatch(body);
    if (res) { toast.success("Action effectuée"); setModalAction(null); refetch(); }
  }

  async function envoyerEchange() {
    if (!nouvelEchange.trim() || !dossier) return;
    const res = await mutateEchange({ commission: dossier.commissionReceptrice, type: "OBSERVATION", contenu: nouvelEchange });
    if (res) { setNouvelEchange(""); refetch(); }
  }

  if (loading || !dossier) {
    return (
      <div className="p-6 flex items-center justify-center h-60">
        <div className="w-8 h-8 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meta = STATUT_META[dossier.statut] || { label: dossier.statut, color: "bg-slate-100 text-slate-600", icon: null };
  const actions = (ACTIONS_PAR_STATUT[dossier.statut] ?? []).filter(def => peutAgir(def, dossier));
  const isFinancement = dossier.type === "DEMANDE_FINANCEMENT";
  const peutDecaisser = actions.some(d => d.action === "EXECUTER");

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <button onClick={() => router.push("/dashboard/user/gouvernance/dossiers")}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ChevronLeft className="w-4 h-4" /> Retour aux dossiers
      </button>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-slate-400">{dossier.reference}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                {meta.icon}{meta.label}
              </span>
            </div>
            <h1 className="text-lg font-bold text-slate-800">{dossier.titre}</h1>
            {dossier.description && <p className="text-sm text-slate-500 mt-1">{dossier.description}</p>}
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
              <span>{COMM_LABELS[dossier.commissionEmettrice] || dossier.commissionEmettrice}</span>
              <span>→</span>
              <span>{COMM_LABELS[dossier.commissionReceptrice] || dossier.commissionReceptrice}</span>
              <span>· {dossier.creePar.prenom} {dossier.creePar.nom}</span>
            </div>
          </div>
          {(dossier.montantDemande || dossier.montantApprouve) && (
            <div className="text-right">
              {dossier.montantDemande && <p className="text-xs text-slate-400">Demandé: <span className="font-medium text-slate-600">{fmt(dossier.montantDemande)} FCFA</span></p>}
              {dossier.montantApprouve && <p className="text-xs text-slate-400">Approuvé: <span className="font-medium text-emerald-600">{fmt(dossier.montantApprouve)} FCFA</span></p>}
              {dossier.portefeuilleExecution && <p className="text-xs text-slate-400">Portefeuille: {dossier.portefeuilleExecution.reference}</p>}
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {actions.map(def => (
              <button key={def.action} onClick={() => def.needsComment || def.isApprouver ? setModalAction(def) : runAction({ action: def.action })}
                className={`px-4 py-2 text-sm font-medium rounded-lg ${def.isDanger ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-violet-600 text-white hover:bg-violet-700"}`}>
                {def.label}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Seules les actions autorisées par votre rôle dans la commission sont affichées
          (analyse : Rapporteurs &amp; Président ; transmission / décision : Président).
        </p>
      </div>

      {/* Bandeau : financement autorisé mais pas encore décaissé */}
      {isFinancement && dossier.statut === "APPROUVE" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 flex items-start gap-3">
          <Wallet className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">Financement autorisé — il reste à décaisser</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              L&apos;approbation ne crée pas encore les financements. Lancez le décaissement pour créer les opérations de
              financement, débiter le portefeuille{dossier.portefeuilleExecution ? ` ${dossier.portefeuilleExecution.reference}` : ""} et
              affecter les clients — ils apparaîtront alors dans « Financements ».
            </p>
          </div>
          {peutDecaisser ? (
            <button onClick={() => runAction({ action: "EXECUTER" })}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
              <Wallet className="w-4 h-4" /> Décaisser maintenant
            </button>
          ) : (
            <span className="shrink-0 self-center text-xs text-emerald-700 italic">Réservé au Président de la commission réceptrice</span>
          )}
        </div>
      )}

      {dossier.analyse && <AnalysePanel analyse={dossier.analyse} />}

      {dossier.consultation && <ConsultationPanel consultation={dossier.consultation} />}

      {isFinancement && (
        <FormulaireFinancement dossier={dossier} editable={dossier.statut === "EN_PREPARATION"} onSaved={refetch} />
      )}

      {/* Historique des versions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Versions ({dossier.versions.length})</h3>
        <div className="space-y-2">
          {dossier.versions.map(v => (
            <div key={v.id} className="flex items-center justify-between text-xs border border-slate-100 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-600">v{v.version}{v.version === dossier.versionCourante && <span className="ml-1.5 text-violet-500">(courante)</span>}</span>
              <span className="text-slate-400">{v.motif}</span>
              <span className="text-slate-400">{v.modifiePar.prenom} {v.modifiePar.nom} · {new Date(v.createdAt).toLocaleDateString("fr-FR")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Échanges */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Échanges ({dossier.echanges.length})</h3>
        <div className="space-y-3 mb-4">
          {dossier.echanges.map(e => (
            <div key={e.id} className="border border-slate-100 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-medium text-slate-600">{e.auteur.prenom} {e.auteur.nom} · {COMM_LABELS[e.commission] || e.commission} · {e.type}</span>
                <span>{new Date(e.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <p className="text-sm text-slate-700">{e.contenu}</p>
            </div>
          ))}
          {dossier.echanges.length === 0 && <p className="text-xs text-slate-400">Aucun échange pour ce dossier</p>}
        </div>
        <div className="flex gap-2">
          <input value={nouvelEchange} onChange={e => setNouvelEchange(e.target.value)}
            placeholder="Ajouter une observation..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          <button onClick={envoyerEchange} className="px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700">Envoyer</button>
        </div>
      </div>

      {modalAction && (
        <ActionModal def={modalAction} dossier={dossier} onClose={() => setModalAction(null)} onSubmit={runAction} />
      )}
    </div>
  );
}
