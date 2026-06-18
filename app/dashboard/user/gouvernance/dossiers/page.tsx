"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useMutation } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  GitBranch, RefreshCw, ArrowRight, ArrowLeft, Plus, History, Lock, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { DOSSIER_ROUTAGE_FIXE } from "@/lib/commissionsRIA";

interface DossierIC {
  id: number;
  reference: string;
  titre: string;
  type: string;
  statut: string;
  commissionEmettrice: string;
  commissionReceptrice: string;
  creePar: { nom: string; prenom: string };
  createdAt: string;
  _count: { echanges: number };
}

interface Data { dossiers: DossierIC[] }

const STATUTS: Record<string, { label: string; color: string }> = {
  EN_PREPARATION:      { label: "En préparation",      color: "bg-slate-100 text-slate-600" },
  TRANSMIS:            { label: "Transmis",            color: "bg-blue-100 text-blue-700" },
  RECU:                { label: "Reçu",                color: "bg-indigo-100 text-indigo-700" },
  EN_ANALYSE:          { label: "En analyse",          color: "bg-amber-100 text-amber-700" },
  EN_ATTENTE_DECISION: { label: "En attente décision", color: "bg-orange-100 text-orange-700" },
  APPROUVE:            { label: "Financement autorisé", color: "bg-emerald-100 text-emerald-700" },
  REJETE:              { label: "Rejeté",              color: "bg-rose-100 text-rose-700" },
  EN_COURS_EXECUTION:  { label: "En cours d'exécution", color: "bg-cyan-100 text-cyan-700" },
  EXECUTE:             { label: "Clôturé",             color: "bg-teal-100 text-teal-700" },
};

const TYPE_LABELS: Record<string, string> = {
  DEMANDE_FINANCEMENT: "Demande de financement",
  RAPPORT_AUDIT:       "Rapport d'audit",
  RECOMMANDATION:      "Recommandation",
  PLAN_ACTION:         "Plan d'action",
  AUTRE:               "Autre",
};

const COMM_LABELS: Record<string, string> = {
  FINANCE:            "Finance",
  OPERATIONS_TERRAIN: "Opérations",
  AUDIT:               "Audit & Contrôle",
  OPTIMISATION:        "Optimisation",
};

const COMMISSIONS_LISTE: { value: string; label: string }[] = [
  { value: "FINANCE",            label: "Finance" },
  { value: "OPERATIONS_TERRAIN", label: "Opérations Terrain" },
  { value: "AUDIT",              label: "Audit & Contrôle" },
  { value: "OPTIMISATION",       label: "Optimisation" },
];

interface MaCommission { typeCommission: string; role: string }

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  // Commissions du membre connecté : l'émettrice doit en faire partie.
  const { data: mc, loading: loadingMc } = useApi<{ commissions: MaCommission[] }>("/api/membreCommission/ma-commission");
  const mesCommissions = mc?.commissions ?? [];
  const mesTypes = mesCommissions.map(c => c.typeCommission);

  const [form, setForm] = useState({
    titre: "", type: "DEMANDE_FINANCEMENT",
    commissionEmettrice: "", commissionReceptrice: "",
    description: "", montantDemande: "",
  });
  const { mutate, loading } = useMutation("/api/membreCommission/dossiers", "POST");

  // Routage imposé par le CDC pour le type sélectionné (ex. financement : Opérations → Finance).
  const routage = DOSSIER_ROUTAGE_FIXE[form.type as keyof typeof DOSSIER_ROUTAGE_FIXE];

  // Émettrice / réceptrice effectives : forcées si le type a un routage fixe,
  // sinon issues du formulaire (émettrice limitée aux commissions du membre).
  const emettrice = routage ? routage.emettrice : form.commissionEmettrice;
  const receptrice = routage ? routage.receptrice : form.commissionReceptrice;

  // Le membre doit appartenir à la commission émettrice (CDC).
  const estMembreEmettrice = !!emettrice && mesTypes.includes(emettrice);
  const receptricesPossibles = COMMISSIONS_LISTE.filter(c => c.value !== emettrice);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!emettrice || !receptrice) { toast.error("Renseignez les commissions émettrice et réceptrice"); return; }
    if (emettrice === receptrice) {
      toast.error("Les commissions émettrice et réceptrice doivent être différentes");
      return;
    }
    if (!estMembreEmettrice) {
      toast.error(`Vous n'êtes pas membre de ${COMM_LABELS[emettrice] || emettrice} — vous ne pouvez pas émettre ce dossier en son nom`);
      return;
    }
    const contenuInitial = form.type === "DEMANDE_FINANCEMENT"
      ? { clients: [], investisseursConcernes: [] }
      : undefined;
    const res = await mutate({
      titre: form.titre, type: form.type, description: form.description,
      commissionEmettrice: emettrice, commissionReceptrice: receptrice,
      montantDemande: form.montantDemande || undefined, contenuInitial,
    }) as { id?: number; reference?: string; error?: string } | null;
    if (res?.id) { toast.success(`Dossier ${res.reference} créé`); onDone(); }
    else toast.error(res?.error || "Erreur");
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-violet-500" /> Nouveau dossier inter-commission
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Objet du dossier" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, commissionEmettrice: "", commissionReceptrice: "" }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
              {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {/* Routage : verrouillé (CDC) ou choix limité aux commissions du membre */}
          {routage ? (
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-violet-700 mb-2">
                <Lock className="w-3.5 h-3.5" /> Circuit imposé par le cahier des charges
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{COMM_LABELS[routage.emettrice]}</span>
                <ArrowRight className="w-4 h-4 text-violet-400" />
                <span className="px-2 py-1 rounded-lg bg-white border border-slate-200">{COMM_LABELS[routage.receptrice]}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Commission émettrice *</label>
                <select value={form.commissionEmettrice} onChange={e => setForm(f => ({ ...f, commissionEmettrice: e.target.value, commissionReceptrice: "" }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">— Ma commission —</option>
                  {COMMISSIONS_LISTE.filter(c => mesTypes.includes(c.value)).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Commission réceptrice *</label>
                <select value={form.commissionReceptrice} onChange={e => setForm(f => ({ ...f, commissionReceptrice: e.target.value }))}
                  disabled={!emettrice}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50">
                  <option value="">— Destinataire —</option>
                  {receptricesPossibles.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Avertissement si le membre n'appartient pas à la commission émettrice */}
          {!loadingMc && emettrice && !estMembreEmettrice && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Vous n&apos;êtes pas membre de {COMM_LABELS[emettrice] || emettrice}. Seul un membre de cette
              commission peut émettre ce dossier en son nom.
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant demandé (FCFA)</label>
            <input type="number" value={form.montantDemande} onChange={e => setForm(f => ({ ...f, montantDemande: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder="Contexte et objectif..." />
          </div>
          {form.type === "DEMANDE_FINANCEMENT" && (
            <p className="text-xs text-slate-500 bg-violet-50/50 border border-violet-100 rounded-lg p-3">
              Les informations détaillées (région, agence, liste des clients, produits, quantités, coûts,
              durée du cycle, risque, investisseurs, pièces jointes) se complètent depuis le détail du dossier,
              avant transmission au Président pour validation.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || loadingMc || !estMembreEmettrice}
              className="px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 disabled:opacity-50">
              {loading ? "Création..." : "Créer le dossier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MesDossiersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [filterSens, setFilterSens] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [refresh, setRefresh] = useState(0);

  const params = new URLSearchParams();
  if (filterSens) params.set("sens", filterSens);
  if (filterStatut) params.set("statut", filterStatut);
  if (refresh > 0) params.set("_r", String(refresh));
  const { data, loading } = useApi<Data>(`/api/membreCommission/dossiers?${params.toString()}`);

  const dossiers = data?.dossiers || [];

  function done() { setShowCreate(false); setRefresh(r => r + 1); }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/user/gouvernance"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Gouvernance
          </Link>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-violet-600" /> Dossiers Inter-Commissions
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/user/gouvernance/dossiers/echanges"
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            <History className="w-4 h-4" /> Échanges
          </Link>
          <select value={filterSens} onChange={e => setFilterSens(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous les sens</option>
            <option value="emis">Émis par ma commission</option>
            <option value="recus">Reçus par ma commission</option>
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            {Object.entries(STATUTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <button onClick={() => setRefresh(r => r + 1)} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
            <Plus className="w-4 h-4" /> Nouveau
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dossiers.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucun dossier inter-commission</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dossiers.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-mono text-slate-400">{d.reference}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUTS[d.statut]?.color || "bg-slate-100 text-slate-600"}`}>
                      {STATUTS[d.statut]?.label || d.statut}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-50 text-slate-500">
                      {TYPE_LABELS[d.type] || d.type}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">{d.titre}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      {COMM_LABELS[d.commissionEmettrice] || d.commissionEmettrice}
                      <ArrowRight className="w-3 h-3 text-slate-300" />
                      {COMM_LABELS[d.commissionReceptrice] || d.commissionReceptrice}
                    </span>
                    <span>{d._count.echanges} échanges</span>
                  </div>
                </div>
                <a href={`/dashboard/user/gouvernance/dossiers/${d.id}`}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50">
                  Voir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onDone={done} />}
    </div>
  );
}
