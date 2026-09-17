"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Printer, CheckCircle2, XCircle, Phone, MapPin, FileWarning,
  StickyNote, Handshake, ShieldAlert, Loader2, Clock,
} from "lucide-react";
import { useApi, invalidateApiCache } from "@/hooks/useApi";
import { LABEL_TYPE_ACTION } from "@/lib/recouvrementCredit";

/**
 * Panneau "Recouvrement" (CDC digitalisation §5.4, Phase 3) — journal
 * d'actions + impression Mise en demeure / Fiche de visite (PDF serveur,
 * lib/ficheActionRecouvrementHtml.ts), partagé entre les fiches crédit admin
 * et RVC (mêmes routes, mêmes rôles autorisés via getRVCSession).
 */

export interface ActionRecouvrement {
  id: number;
  type: string;
  statut: string;
  notes: string | null;
  resultat: string | null;
  delaiRegularisationJours: number | null;
  lieuVisite: string | null;
  personneRencontree: string | null;
  effectuePar: { nom: string; prenom: string } | null;
  dateAction: string;
  dateRelance: string | null;
}

const TYPE_ICON: Record<string, typeof Phone> = {
  APPEL_TELEPHONIQUE: Phone,
  VISITE_TERRAIN: MapPin,
  MISE_EN_DEMEURE: FileWarning,
  ACCORD_ECHEANCIER: Handshake,
  SAISIE_GARANTIE: ShieldAlert,
  NOTE_INTERNE: StickyNote,
};

const STATUT_BADGE: Record<string, string> = {
  EN_COURS: "bg-amber-100 text-amber-700",
  RESOLU: "bg-emerald-100 text-emerald-700",
  SANS_SUITE: "bg-slate-200 text-slate-600",
};
const STATUT_LABEL: Record<string, string> = { EN_COURS: "En cours", RESOLU: "Résolu", SANS_SUITE: "Sans suite" };

interface Props {
  creditId: number;
}

export default function RecouvrementCreditPanel({ creditId }: Props) {
  const apiUrl = `/api/admin/credits/${creditId}/recouvrement`;
  const { data, loading, refetch } = useApi<{ data: ActionRecouvrement[] }>(apiUrl);
  const actions = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const [type, setType] = useState<string>("APPEL_TELEPHONIQUE");
  const [notes, setNotes] = useState("");
  const [delaiJours, setDelaiJours] = useState("8");
  const [lieuVisite, setLieuVisite] = useState("");
  const [personneRencontree, setPersonneRencontree] = useState("");
  const [dateRelance, setDateRelance] = useState("");

  function resetForm() {
    setType("APPEL_TELEPHONIQUE"); setNotes(""); setDelaiJours("8");
    setLieuVisite(""); setPersonneRencontree(""); setDateRelance("");
  }

  async function creerAction() {
    if (type === "VISITE_TERRAIN" && !lieuVisite.trim()) {
      toast.error("Le lieu de la visite est obligatoire");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          notes: notes || undefined,
          delaiRegularisationJours: type === "MISE_EN_DEMEURE" ? Number(delaiJours) || 8 : undefined,
          lieuVisite: type === "VISITE_TERRAIN" ? lieuVisite : undefined,
          personneRencontree: type === "VISITE_TERRAIN" ? personneRencontree || undefined : undefined,
          dateRelance: dateRelance || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Erreur"); return; }
      toast.success("Action de recouvrement enregistrée");
      invalidateApiCache(apiUrl);
      refetch();
      setShowForm(false);
      resetForm();
      // Ouvre directement le PDF pour les documents formels du CDC.
      if (type === "MISE_EN_DEMEURE" || type === "VISITE_TERRAIN") {
        window.open(`/api/admin/credits/${creditId}/recouvrement/${json.data.id}/pdf`, "_blank");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  async function cloturer(actionId: number, statut: "RESOLU" | "SANS_SUITE") {
    setClosingId(actionId);
    try {
      const res = await fetch(`${apiUrl}/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || "Erreur"); return; }
      toast.success(statut === "RESOLU" ? "Action clôturée — résolue" : "Action clôturée — sans suite");
      invalidateApiCache(apiUrl);
      refetch();
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setClosingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Recouvrement</h4>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors">
          <Plus size={13} /> Nouvelle action
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-3 border border-slate-200 rounded-xl bg-slate-50 space-y-2.5">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Type d&apos;action</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {Object.entries(LABEL_TYPE_ACTION).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>

          {type === "MISE_EN_DEMEURE" && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Délai de régularisation (jours)</label>
              <input type="number" min={1} value={delaiJours} onChange={(e) => setDelaiJours(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          )}

          {type === "VISITE_TERRAIN" && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Lieu de la visite *</label>
                <input value={lieuVisite} onChange={(e) => setLieuVisite(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Domicile, commerce…" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Personne rencontrée</label>
                <input value={personneRencontree} onChange={(e) => setPersonneRencontree(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Notes / constat</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Prochaine relance (optionnel)</label>
            <input type="date" value={dateRelance} onChange={(e) => setDateRelance(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
            <button onClick={creerAction} disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Enregistrer
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-slate-400">Chargement…</p>}
      {!loading && actions.length === 0 && <p className="text-xs text-slate-400 italic">Aucune action de recouvrement enregistrée.</p>}

      <div className="space-y-2">
        {actions.map((a) => {
          const Icon = TYPE_ICON[a.type] ?? StickyNote;
          return (
            <div key={a.id} className="flex items-start gap-2.5 p-2.5 border border-slate-200 rounded-lg">
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500 shrink-0"><Icon size={14} /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-700">{LABEL_TYPE_ACTION[a.type as keyof typeof LABEL_TYPE_ACTION] ?? a.type}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUT_BADGE[a.statut] ?? "bg-slate-100 text-slate-500"}`}>{STATUT_LABEL[a.statut] ?? a.statut}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(a.dateAction).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {a.effectuePar && ` · ${a.effectuePar.prenom} ${a.effectuePar.nom}`}
                </p>
                {a.notes && <p className="text-xs text-slate-600 mt-1">{a.notes}</p>}
                {a.dateRelance && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><Clock size={11} /> Relance prévue le {new Date(a.dateRelance).toLocaleDateString("fr-FR")}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={`/api/admin/credits/${creditId}/recouvrement/${a.id}/pdf`} target="_blank" rel="noreferrer" title="Imprimer" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                  <Printer size={14} />
                </a>
                {a.statut === "EN_COURS" && (
                  <>
                    <button onClick={() => cloturer(a.id, "RESOLU")} disabled={closingId === a.id} title="Marquer résolu"
                      className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg disabled:opacity-50">
                      <CheckCircle2 size={14} />
                    </button>
                    <button onClick={() => cloturer(a.id, "SANS_SUITE")} disabled={closingId === a.id} title="Sans suite"
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-50">
                      <XCircle size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
