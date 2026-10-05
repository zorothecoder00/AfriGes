"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, UserPlus, Loader2 } from "lucide-react";

export interface ClientRef { id: number; nom: string; prenom: string; telephone: string; adresse: string | null; etat?: string }

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

/**
 * Choix du client sur un document commercial de l'agent : recherche dans son agence, ou création rapide
 * sur place (nom, prénom, téléphone). Le client créé part en validation RVC (EN_ATTENTE_VALIDATION) sans
 * bloquer le document ; si le numéro existe déjà (client d'une autre agence), la fiche existante est reprise.
 */
export default function ChoixClientAgent({ client, onChange, accent = "emerald" }: {
  client: ClientRef | null;
  onChange: (c: ClientRef | null) => void;
  accent?: "emerald" | "indigo";
}) {
  const [search, setSearch] = useState("");
  const [creation, setCreation] = useState(false);
  const [form, setForm] = useState({ prenom: "", nom: "", telephone: "", quartier: "" });
  const [saving, setSaving] = useState(false);

  const { data } = useApi<{ data: ClientRef[] }>(!client && !creation && search.length >= 2 ? `/api/agentTerrain/clients?search=${encodeURIComponent(search)}&limit=8` : null);
  const clients = data?.data ?? [];

  const ouvrirCreation = () => {
    // Pré-remplit avec la saisie : chiffres → téléphone, sinon nom.
    const q = search.trim();
    const estTel = /^[+\d\s]{6,}$/.test(q);
    setForm({ prenom: "", nom: estTel ? "" : q, telephone: estTel ? q : "", quartier: "" });
    setCreation(true);
  };

  const creer = async () => {
    if (!form.prenom.trim() || !form.nom.trim() || !form.telephone.trim()) { toast.error("Nom, prénom et téléphone obligatoires"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/agentTerrain/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quartier: form.quartier || undefined, reprendreExistant: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
      toast.success(j.existant ? "Ce numéro existe déjà : fiche client existante reprise" : "Client créé (en attente de validation RVC)");
      onChange(j.data);
      setCreation(false); setSearch("");
    } finally { setSaving(false); }
  };

  const couleur = accent === "indigo" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  if (client) {
    return (
      <div className={`flex items-center justify-between px-3 py-2 border rounded-lg text-sm ${couleur}`}>
        <span className="text-slate-800">
          {client.prenom} {client.nom} — {client.telephone}
          {client.etat === "EN_ATTENTE_VALIDATION" && <span className="ml-2 text-[11px] text-amber-700">(nouveau — en attente de validation RVC)</span>}
        </span>
        <button onClick={() => { onChange(null); setSearch(""); }}><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (creation) {
    return (
      <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-amber-800">Nouveau client</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prénom *" className={inputCls} />
          <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom *" className={inputCls} />
          <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="Téléphone *" inputMode="tel" className={inputCls} />
          <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} placeholder="Quartier" className={inputCls} />
        </div>
        <p className="text-[11px] text-slate-500">La fiche sera complétée et validée par le Responsable Vente Crédit ; le document est enregistré tout de suite.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setCreation(false)} className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-white">Annuler</button>
          <button onClick={creer} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />} Créer et utiliser
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Téléphone ou nom…" className={inputCls} />
      <div className="mt-1 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
        {clients.map((c) => (
          <button key={c.id} onClick={() => onChange(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.prenom} {c.nom} — {c.telephone}</button>
        ))}
        <button onClick={ouvrirCreation} className="w-full text-left px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4" /> Nouveau client{search.trim().length >= 2 && clients.length === 0 ? " (aucun résultat)" : ""}
        </button>
      </div>
    </>
  );
}
