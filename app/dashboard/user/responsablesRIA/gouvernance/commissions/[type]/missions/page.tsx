"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useApi, useMutation } from "@/hooks/useApi";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw, Plus, ShieldAlert, ChevronDown, ChevronUp, Save,
  CheckCircle2, XCircle, FileSearch,
} from "lucide-react";

interface ChecklistItem { id: string; question: string; reponse: "OUI" | "NON" | null; commentaire: string }
interface Mission {
  id: number; reference: string; objet: string; statut: string;
  checklist: ChecklistItem[];
  resultat: string | null; niveauRisque: string | null; conclusion: string | null;
  auditeur: { id: number; nom: string; prenom: string };
  financement: { id: number; reference: string; montantFinance: number; client: { nom: string; prenom: string } } | null;
  dossierIC: { id: number; reference: string; titre: string } | null;
  createdAt: string; dateCloture: string | null;
}
interface Data { data: Mission[] }

const STATUT_STYLE: Record<string, string> = {
  OUVERTE:   "bg-blue-50 text-blue-700",
  EN_COURS:  "bg-amber-50 text-amber-700",
  CLOTUREE:  "bg-slate-100 text-slate-600",
};
const RESULTAT_LABELS: Record<string, { label: string; style: string }> = {
  CONFORME:     { label: "Conforme",      style: "bg-emerald-50 text-emerald-700" },
  NON_CONFORME: { label: "Non conforme",  style: "bg-rose-50 text-rose-700" },
};
const RISQUE_LABELS: Record<string, { label: string; style: string }> = {
  RISQUE_MINEUR:     { label: "Risque mineur",      style: "bg-amber-50 text-amber-700" },
  RISQUE_MAJEUR:     { label: "Risque majeur",      style: "bg-orange-50 text-orange-700" },
  FRAUDE_SUSPECTEE:  { label: "Fraude suspectée",   style: "bg-rose-100 text-rose-700" },
};

function CreateModal({ defaultFinancementId, defaultDossierICId, onClose, onDone }: {
  defaultFinancementId?: string; defaultDossierICId?: string; onClose: () => void; onDone: () => void;
}) {
  const [objet, setObjet] = useState("");
  const [financementId, setFinancementId] = useState(defaultFinancementId ?? "");
  const [dossierICId, setDossierICId] = useState(defaultDossierICId ?? "");
  const { mutate, loading } = useMutation("/api/membreCommission/missions-audit", "POST");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await mutate({
      objet,
      financementId: financementId || undefined,
      dossierICId: dossierICId || undefined,
    }) as { id?: number; reference?: string } | null;
    if (res?.id) { toast.success(`Mission ${res.reference} ouverte`); onDone(); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-amber-600" /> Ouvrir une mission d&apos;audit
          </h2>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Objet *</label>
            <input value={objet} onChange={e => setObjet(e.target.value)} required
              placeholder="Ex: Audit du financement FIN-..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID Financement (optionnel)</label>
              <input type="number" value={financementId} onChange={e => setFinancementId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">ID Dossier IC (optionnel)</label>
              <input type="number" value={dossierICId} onChange={e => setDossierICId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            La checklist standard (clients, livraison, prix, montants, recouvrements) est ajoutée automatiquement et reste modifiable.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button type="submit" disabled={loading || !objet}
              className="px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
              {loading ? "Création..." : "Ouvrir la mission"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MissionRow({ mission, expanded, onToggle, onSaved }: {
  mission: Mission; expanded: boolean; onToggle: () => void; onSaved: () => void;
}) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(mission.checklist);
  const [dirty, setDirty] = useState(false);
  const [resultat, setResultat] = useState(mission.resultat ?? "CONFORME");
  const [niveauRisque, setNiveauRisque] = useState(mission.niveauRisque ?? "RISQUE_MINEUR");
  const [conclusion, setConclusion] = useState(mission.conclusion ?? "");
  const { mutate, loading } = useMutation(`/api/membreCommission/missions-audit/${mission.id}`, "PATCH");

  function updateItem(i: number, patch: Partial<ChecklistItem>) {
    setChecklist(c => c.map((it, idx) => idx === i ? { ...it, ...patch } : it));
    setDirty(true);
  }

  async function saveChecklist() {
    const res = await mutate({ checklist, statut: mission.statut === "OUVERTE" ? "EN_COURS" : undefined });
    if (res) { toast.success("Checklist enregistrée"); setDirty(false); onSaved(); }
  }

  async function cloturer() {
    if (resultat === "NON_CONFORME" && !niveauRisque) { toast.error("Sélectionnez un niveau de risque"); return; }
    const res = await mutate({
      checklist, statut: "CLOTUREE", resultat,
      niveauRisque: resultat === "NON_CONFORME" ? niveauRisque : undefined,
      conclusion,
    });
    if (res) { toast.success("Mission clôturée"); onSaved(); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50">
        <div className="flex items-center gap-3 text-left">
          <span className="text-xs font-mono text-slate-400">{mission.reference}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[mission.statut]}`}>{mission.statut.replace("_", " ")}</span>
          {mission.resultat && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RESULTAT_LABELS[mission.resultat]?.style}`}>{RESULTAT_LABELS[mission.resultat]?.label}</span>
          )}
          {mission.niveauRisque && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${RISQUE_LABELS[mission.niveauRisque]?.style}`}>{RISQUE_LABELS[mission.niveauRisque]?.label}</span>
          )}
          <span className="text-sm text-slate-700">{mission.objet}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="text-xs text-slate-500 flex gap-4">
            <span>Auditeur: {mission.auditeur.prenom} {mission.auditeur.nom}</span>
            {mission.financement && <span>Financement: {mission.financement.reference} — {mission.financement.client.prenom} {mission.financement.client.nom}</span>}
            {mission.dossierIC && <span>Dossier: {mission.dossierIC.reference}</span>}
          </div>

          <div className="space-y-2">
            {checklist.map((item, i) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_2fr] gap-3 items-center">
                <span className="text-sm text-slate-700">{item.question}</span>
                <select value={item.reponse ?? ""} disabled={mission.statut === "CLOTUREE"}
                  onChange={e => updateItem(i, { reponse: (e.target.value || null) as ChecklistItem["reponse"] })}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50">
                  <option value="">—</option>
                  <option value="OUI">Oui</option>
                  <option value="NON">Non</option>
                </select>
                <input value={item.commentaire} disabled={mission.statut === "CLOTUREE"}
                  onChange={e => updateItem(i, { commentaire: e.target.value })}
                  placeholder="Commentaire..."
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50" />
              </div>
            ))}
          </div>

          {mission.statut !== "CLOTUREE" && (
            <>
              {dirty && (
                <button onClick={saveChecklist} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> Enregistrer la checklist
                </button>
              )}

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-medium text-slate-600">Clôturer la mission</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Résultat</label>
                    <select value={resultat} onChange={e => setResultat(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm">
                      <option value="CONFORME">Conforme</option>
                      <option value="NON_CONFORME">Non conforme</option>
                    </select>
                  </div>
                  {resultat === "NON_CONFORME" && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Niveau de risque</label>
                      <select value={niveauRisque} onChange={e => setNiveauRisque(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm">
                        <option value="RISQUE_MINEUR">Risque mineur</option>
                        <option value="RISQUE_MAJEUR">Risque majeur</option>
                        <option value="FRAUDE_SUSPECTEE">Fraude suspectée</option>
                      </select>
                    </div>
                  )}
                </div>
                <textarea value={conclusion} onChange={e => setConclusion(e.target.value)} rows={2}
                  placeholder="Conclusion de la mission..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm resize-none" />
                <button onClick={cloturer} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {resultat === "CONFORME" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  Clôturer la mission
                </button>
              </div>
            </>
          )}

          {mission.statut === "CLOTUREE" && mission.conclusion && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">{mission.conclusion}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MissionsAuditPage() {
  const { type } = useParams() as { type: string };
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatut, setFilterStatut] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (filterStatut) params.set("statut", filterStatut);
  const { data, loading, refetch } = useApi<Data>(`/api/membreCommission/missions-audit?${params.toString()}`);

  useEffect(() => {
    if (searchParams.get("financementId") || searchParams.get("dossierICId")) setShowCreate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  function done() { setShowCreate(false); refetch(); }

  const missions = data?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" /> Missions d&apos;audit
          </h1>
          <p className="text-sm text-slate-500">La Commission Audit ne valide pas, elle contrôle.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Tous statuts</option>
            <option value="OUVERTE">Ouverte</option>
            <option value="EN_COURS">En cours</option>
            <option value="CLOTUREE">Clôturée</option>
          </select>
          <button onClick={() => refetch()} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700">
            <Plus className="w-4 h-4" /> Ouvrir une mission
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : missions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-slate-400">
          <FileSearch className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aucune mission d&apos;audit</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map(m => (
            <MissionRow key={m.id} mission={m} expanded={expandedId === m.id}
              onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onSaved={() => { refetch(); }} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          defaultFinancementId={searchParams.get("financementId") ?? undefined}
          defaultDossierICId={searchParams.get("dossierICId") ?? undefined}
          onClose={() => setShowCreate(false)} onDone={done} />
      )}
    </div>
  );
}
