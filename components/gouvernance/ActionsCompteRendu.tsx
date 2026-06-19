"use client";

import { Plus, Trash2, User, Calendar, ListChecks } from "lucide-react";
import type { ActionCR } from "@/lib/commissionsRIA";

type MembreLite = { id: number; nom: string; prenom: string };

const PRIORITES = ["CRITIQUE", "HAUTE", "MOYENNE", "BASSE"] as const;
const PRIORITE_COLOR: Record<string, string> = {
  CRITIQUE: "text-rose-600", HAUTE: "text-amber-600", MOYENNE: "text-blue-600", BASSE: "text-slate-400",
};

/**
 * Éditeur structuré des « Actions définies » du compte rendu.
 * Chaque ligne = une future tâche (titre + responsable + échéance + priorité),
 * matérialisée en plan d'action à la validation du compte rendu (CDC).
 */
export function ActionsCREditor({
  actions, onChange, membres, disabled,
}: {
  actions: ActionCR[];
  onChange: (a: ActionCR[]) => void;
  membres: MembreLite[];
  disabled?: boolean;
}) {
  function maj(i: number, patch: Partial<ActionCR>) {
    onChange(actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function ajouter() {
    onChange([...actions, { titre: "", responsableId: null, responsableNom: null, dateEcheance: null, priorite: "MOYENNE" }]);
  }
  function retirer(i: number) {
    onChange(actions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 && (
        <p className="text-xs text-slate-400">Aucune action définie. Ajoutez les tâches décidées en réunion.</p>
      )}
      {actions.map((a, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/50">
          <div className="flex items-start gap-2">
            <input
              value={a.titre}
              onChange={(e) => maj(i, { titre: e.target.value })}
              disabled={disabled}
              placeholder="Ex. Réduire les impayés de 15 %"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:bg-slate-100"
            />
            {!disabled && (
              <button type="button" onClick={() => retirer(i)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Retirer">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={a.responsableId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const m = membres.find((x) => x.id === id);
                maj(i, { responsableId: id, responsableNom: m ? `${m.prenom} ${m.nom}` : null });
              }}
              disabled={disabled}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none disabled:bg-slate-100"
            >
              <option value="">— Responsable —</option>
              {membres.map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
            </select>
            <input
              type="date"
              value={a.dateEcheance ?? ""}
              onChange={(e) => maj(i, { dateEcheance: e.target.value || null })}
              disabled={disabled}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none disabled:bg-slate-100"
            />
            <select
              value={a.priorite ?? "MOYENNE"}
              onChange={(e) => maj(i, { priorite: e.target.value })}
              disabled={disabled}
              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none disabled:bg-slate-100"
            >
              {PRIORITES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={ajouter}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-50">
          <Plus className="w-3.5 h-3.5" /> Ajouter une action
        </button>
      )}
    </div>
  );
}

/** Affichage en lecture seule des actions définies (structurées ou texte hérité). */
export function ActionsCRView({ actions }: { actions: ActionCR[] }) {
  if (actions.length === 0) return <p className="text-sm text-slate-400">—</p>;
  return (
    <ul className="space-y-2">
      {actions.map((a, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
          <ListChecks className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">{a.titre}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-0.5">
              {a.responsableNom && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {a.responsableNom}</span>}
              {a.dateEcheance && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(a.dateEcheance).toLocaleDateString("fr-FR")}
                </span>
              )}
              {a.priorite && <span className={PRIORITE_COLOR[a.priorite] ?? "text-slate-400"}>{a.priorite}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
