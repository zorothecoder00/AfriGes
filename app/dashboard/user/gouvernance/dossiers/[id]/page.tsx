"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { ClientSearchSelect } from "@/components/ClientSearchSelect";
import { toast } from "sonner";
import {
  ChevronLeft, GitBranch, Send, Inbox, Clock, Hourglass,
  CheckCircle2, XCircle, Archive, MessageSquare, Plus, Trash2,
  Save, TrendingUp, AlertTriangle, Wallet, Percent, History,
} from "lucide-react";

/* ─── Types ─── */
interface ProduitFinancement { nom: string; quantite: number; coutAchat: number; prixRevente: number }
interface ClientFinancement { clientId: number; nom?: string; montant: number; produits?: ProduitFinancement[] }
interface ContenuDF {
  region?: string; agence?: string;
  clients?: ClientFinancement[];
  dureeCycleJours?: number;
  risqueEstime?: "FAIBLE" | "MOYEN" | "ELEVE";
  investisseursConcernes?: number[];
}
interface VersionIC { id: number; version: number; contenu: ContenuDF; motif: string | null; createdAt: string; modifiePar: { id: number; nom: string; prenom: string } }
interface EchangeIC { id: number; commission: string; type: string; contenu: string; createdAt: string; auteur: { id: number; nom: string; prenom: string } }
interface Analyse {
  montantTotal: number; margeTotale: number; roiEstime: number; tauxRisque: number;
  probabiliteRemboursement: number; impactTresorerie: number | null; rentabiliteAttendue: number;
  nbClients: number; scoreMoyenSolvabilite: number | null;
}
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

type ActionDef = { action: string; label: string; needsComment?: boolean; isApprouver?: boolean; isDanger?: boolean };
const ACTIONS_PAR_STATUT: Record<string, ActionDef[]> = {
  EN_PREPARATION: [{ action: "TRANSMETTRE", label: "Transmettre au Président" }],
  TRANSMIS: [{ action: "VALIDER_RECEPTION", label: "Valider la réception" }],
  RECU: [{ action: "METTRE_EN_ANALYSE", label: "Mettre en analyse" }],
  EN_ANALYSE: [
    { action: "METTRE_EN_ATTENTE", label: "Mettre en attente de décision" },
    { action: "APPROUVER", label: "Approuver", isApprouver: true },
    { action: "DEMANDER_AJUSTEMENT", label: "Demander un ajustement", needsComment: true },
    { action: "REJETER", label: "Rejeter", needsComment: true, isDanger: true },
  ],
  EN_ATTENTE_DECISION: [
    { action: "APPROUVER", label: "Approuver", isApprouver: true },
    { action: "DEMANDER_AJUSTEMENT", label: "Demander un ajustement", needsComment: true },
    { action: "REJETER", label: "Rejeter", needsComment: true, isDanger: true },
  ],
  APPROUVE: [{ action: "EXECUTER", label: "Décaisser & affecter les clients" }],
  EN_COURS_EXECUTION: [{ action: "CLOTURER", label: "Clôturer le dossier" }],
};

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

  const versionCourante = dossier.versions.find(v => v.version === dossier.versionCourante);
  const candidats = versionCourante?.contenu?.investisseursConcernes ?? [];

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
                {candidats.length === 0 ? (
                  <input value={portefeuilleExecutionId} onChange={e => setPortefeuilleExecutionId(e.target.value)}
                    placeholder="ID du portefeuille"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
                ) : (
                  <select value={portefeuilleExecutionId} onChange={e => setPortefeuilleExecutionId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                    <option value="">— Choisir —</option>
                    {candidats.map(id => <option key={id} value={id}>Portefeuille #{id}</option>)}
                  </select>
                )}
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

  function updateField<K extends keyof ContenuDF>(key: K, value: ContenuDF[K]) {
    setContenu(c => ({ ...c, [key]: value }));
    setDirty(true);
  }

  function addClient() {
    const clients = [...(contenu.clients ?? []), { clientId: 0, nom: "", montant: 0, produits: [] }];
    updateField("clients", clients);
  }
  function updateClient(i: number, patch: Partial<ClientFinancement>) {
    const clients = (contenu.clients ?? []).map((c, idx) => idx === i ? { ...c, ...patch } : c);
    updateField("clients", clients);
  }
  function removeClient(i: number) {
    updateField("clients", (contenu.clients ?? []).filter((_, idx) => idx !== i));
  }
  function addProduit(ci: number) {
    const clients = (contenu.clients ?? []).map((c, idx) => idx === ci
      ? { ...c, produits: [...(c.produits ?? []), { nom: "", quantite: 1, coutAchat: 0, prixRevente: 0 }] }
      : c);
    updateField("clients", clients);
  }
  function updateProduit(ci: number, pi: number, patch: Partial<ProduitFinancement>) {
    const clients = (contenu.clients ?? []).map((c, idx) => idx === ci
      ? { ...c, produits: (c.produits ?? []).map((p, j) => j === pi ? { ...p, ...patch } : p) }
      : c);
    updateField("clients", clients);
  }
  function removeProduit(ci: number, pi: number) {
    const clients = (contenu.clients ?? []).map((c, idx) => idx === ci
      ? { ...c, produits: (c.produits ?? []).filter((_, j) => j !== pi) }
      : c);
    updateField("clients", clients);
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Région" value={contenu.region ?? ""} editable={editable} onChange={v => updateField("region", v)} />
        <Field label="Agence" value={contenu.agence ?? ""} editable={editable} onChange={v => updateField("agence", v)} />
        <Field label="Durée cycle (jours)" type="number" value={String(contenu.dureeCycleJours ?? "")} editable={editable}
          onChange={v => updateField("dureeCycleJours", v ? Number(v) : undefined)} />
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Risque estimé</label>
          {editable ? (
            <select value={contenu.risqueEstime ?? "MOYEN"} onChange={e => updateField("risqueEstime", e.target.value as ContenuDF["risqueEstime"])}
              className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              <option value="FAIBLE">Faible</option>
              <option value="MOYEN">Moyen</option>
              <option value="ELEVE">Élevé</option>
            </select>
          ) : <p className="text-sm text-slate-700">{contenu.risqueEstime ?? "—"}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Investisseurs concernés (IDs de portefeuille, séparés par virgule)</label>
        {editable ? (
          <input
            value={(contenu.investisseursConcernes ?? []).join(", ")}
            onChange={e => updateField("investisseursConcernes", e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)))}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            placeholder="Ex: 1, 4, 7" />
        ) : (
          <p className="text-sm text-slate-700">{(contenu.investisseursConcernes ?? []).map(id => `#${id}`).join(", ") || "—"}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-500">Clients ({(contenu.clients ?? []).length})</p>
          {editable && (
            <button onClick={addClient} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800">
              <Plus className="w-3.5 h-3.5" /> Ajouter un client
            </button>
          )}
        </div>
        <div className="space-y-3">
          {(contenu.clients ?? []).map((c, ci) => (
            <div key={ci} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ClientSearchSelect
                  apiBase="/api/membreCommission/clients"
                  clientId={c.clientId}
                  nom={c.nom ?? ""}
                  disabled={!editable}
                  onSelect={cl => updateClient(ci, { clientId: cl.id, nom: cl.nom })} />
                <input type="number" placeholder="Montant" value={c.montant || ""} disabled={!editable}
                  onChange={e => updateClient(ci, { montant: Number(e.target.value) || 0 })}
                  className="w-32 border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50" />
                {editable && (
                  <button onClick={() => removeClient(ci)} className="text-rose-500 hover:text-rose-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="pl-4 space-y-1.5">
                {(c.produits ?? []).map((p, pi) => (
                  <div key={pi} className="flex items-center gap-2 text-xs">
                    <input placeholder="Produit" value={p.nom} disabled={!editable}
                      onChange={e => updateProduit(ci, pi, { nom: e.target.value })}
                      className="flex-1 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Qté" value={p.quantite} disabled={!editable}
                      onChange={e => updateProduit(ci, pi, { quantite: Number(e.target.value) || 0 })}
                      className="w-16 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Coût achat" value={p.coutAchat} disabled={!editable}
                      onChange={e => updateProduit(ci, pi, { coutAchat: Number(e.target.value) || 0 })}
                      className="w-24 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Prix revente" value={p.prixRevente} disabled={!editable}
                      onChange={e => updateProduit(ci, pi, { prixRevente: Number(e.target.value) || 0 })}
                      className="w-24 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    {editable && (
                      <button onClick={() => removeProduit(ci, pi)} className="text-rose-400 hover:text-rose-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {editable && (
                  <button onClick={() => addProduit(ci)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600">
                    <Plus className="w-3 h-3" /> Produit
                  </button>
                )}
              </div>
            </div>
          ))}
          {(contenu.clients ?? []).length === 0 && <p className="text-xs text-slate-400">Aucun client renseigné</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, editable, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; editable: boolean; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editable ? (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
      ) : <p className="text-sm text-slate-700">{value || "—"}</p>}
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
  const actions = ACTIONS_PAR_STATUT[dossier.statut] ?? [];
  const isFinancement = dossier.type === "DEMANDE_FINANCEMENT";

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
          Certaines actions sont réservées au Président de la commission concernée — le serveur refusera la demande si vous n&apos;avez pas ce rôle.
        </p>
      </div>

      {dossier.analyse && <AnalysePanel analyse={dossier.analyse} />}

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
