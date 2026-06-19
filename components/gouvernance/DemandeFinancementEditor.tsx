"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/useApi";
import { ClientSearchSelect } from "@/components/ClientSearchSelect";
import {
  Plus, Trash2, Search, Loader2, Paperclip, Users, Wallet, TrendingUp,
} from "lucide-react";

/* ── Types (miroir de ContenuDemandeFinancement, cf. lib/riaAnalyseDossier.ts) ── */
export interface ProduitFin { nom: string; quantite: number; coutAchat: number; prixRevente: number }
export interface ClientFin { clientId: number; nom?: string; montant: number; produits?: ProduitFin[] }
export interface ContenuDF {
  region?: string;
  agence?: string;
  responsableDemandeurId?: number;
  responsableDemandeurNom?: string;
  clients?: ClientFin[];
  dureeCycleJours?: number;
  risqueEstime?: "FAIBLE" | "MOYEN" | "ELEVE";
  investisseursConcernes?: number[];
  piecesJointesUrls?: string[];
}

interface PortefeuilleLite {
  id: number; reference: string; nom: string | null;
  profilRIA?: { gestionnaire?: { member?: { nom: string; prenom: string } | null } | null } | null;
}
interface GestionnaireLite { id: number; role: string; member: { id: number; nom: string; prenom: string } }

function pfLabel(p: PortefeuilleLite): string {
  const m = p.profilRIA?.gestionnaire?.member;
  const inv = m ? `${m.prenom} ${m.nom}` : "—";
  return `${p.reference}${p.nom ? ` · ${p.nom}` : ""} (${inv})`;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("fr-FR");

/* ── Recherche/sélection d'un responsable (gestionnaire) ── */
function ResponsableSearch({ value, nom, onSelect, disabled, apiBase }: {
  value?: number; nom?: string; onSelect: (g: { id: number; nom: string } | null) => void; disabled?: boolean; apiBase: string;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const show = !disabled && (editing || !value);
  const { data, loading } = useApi<{ data: GestionnaireLite[] }>(
    show && search.trim().length >= 2 ? `${apiBase}?search=${encodeURIComponent(search.trim())}&limit=8` : null
  );
  const results = data?.data ?? [];

  if (disabled) {
    return <div className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50 text-slate-700">{value ? `${nom ?? "Responsable"} (#${value})` : "—"}</div>;
  }
  if (!show) {
    return (
      <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5">
        <span className="text-sm text-slate-800 flex-1 truncate">{nom || `#${value}`}</span>
        <button type="button" onClick={() => { setEditing(true); setSearch(""); }} className="text-xs text-violet-600 hover:underline">Changer</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 text-slate-300 absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
        className="w-full border border-slate-200 rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        placeholder="Rechercher un responsable…" />
      {search.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto divide-y divide-slate-50">
          {loading ? <p className="px-3 py-2 text-xs text-slate-400">Recherche…</p>
            : results.length === 0 ? <p className="px-3 py-2 text-xs text-slate-400">Aucun résultat</p>
            : results.map(g => (
              <button type="button" key={g.id}
                onClick={() => { onSelect({ id: g.member.id, nom: `${g.member.prenom} ${g.member.nom}` }); setEditing(false); setSearch(""); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50">
                <p className="text-sm text-slate-800 truncate">{g.member.prenom} {g.member.nom}</p>
                <p className="text-xs text-slate-400 truncate">{g.role.replace(/_/g, " ")}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Éditeur structuré de la demande de financement (création + détail) ── */
export function DemandeFinancementEditor({
  value, onChange, disabled,
  clientsApiBase = "/api/admin/clients",
  portefeuillesApiBase = "/api/admin/ria/portefeuilles",
  investisseursApiBase = "/api/admin/ria/investisseurs",
  gestionnairesApiBase = "/api/admin/gestionnaires",
}: {
  value: ContenuDF;
  onChange: (v: ContenuDF) => void;
  disabled?: boolean;
  clientsApiBase?: string;
  portefeuillesApiBase?: string;
  investisseursApiBase?: string;
  gestionnairesApiBase?: string;
}) {
  const [pfRefresh, setPfRefresh] = useState(0);
  const { data: pfData } = useApi<{ data: PortefeuilleLite[] }>(`${portefeuillesApiBase}?limit=50&_r=${pfRefresh}`);
  const portefeuilles = pfData?.data ?? [];
  const [showCreerInv, setShowCreerInv] = useState(false);
  const [invForm, setInvForm] = useState({ prenom: "", nom: "", email: "", telephone: "" });
  const [invSaving, setInvSaving] = useState(false);

  const set = <K extends keyof ContenuDF>(k: K, v: ContenuDF[K]) => onChange({ ...value, [k]: v });
  const clients = value.clients ?? [];
  const setClients = (c: ClientFin[]) => set("clients", c);
  const updClient = (i: number, patch: Partial<ClientFin>) => setClients(clients.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  const pieces = value.piecesJointesUrls ?? [];
  const investisseurs = value.investisseursConcernes ?? [];

  // Synthèse (mêmes formules que calculerAnalyseFinancement)
  const synth = useMemo(() => {
    const montantTotal = clients.reduce((s, c) => s + Number(c.montant || 0), 0);
    const marge = clients.reduce((s, c) => s + (c.produits ?? []).reduce((m, p) => m + (Number(p.prixRevente) - Number(p.coutAchat)) * Number(p.quantite), 0), 0);
    const roi = montantTotal > 0 ? (marge / montantTotal) * 100 : 0;
    return { montantTotal, marge, roi, nbClients: clients.length };
  }, [clients]);

  async function creerInvestisseur() {
    if (!invForm.prenom.trim() || !invForm.nom.trim() || !invForm.email.trim()) { toast.error("Prénom, nom et email requis"); return; }
    setInvSaving(true);
    try {
      const r = await fetch(investisseursApiBase, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...invForm, avecPortefeuille: true }),
      });
      const j = await r.json();
      const pfId = j?.data?.portefeuille?.id;
      if (r.ok && pfId) {
        set("investisseursConcernes", [...investisseurs, pfId]);
        setPfRefresh(x => x + 1);
        setShowCreerInv(false);
        setInvForm({ prenom: "", nom: "", email: "", telephone: "" });
        toast.success("Investisseur créé et ajouté");
      } else {
        toast.error(j?.error ?? "Erreur lors de la création");
      }
    } catch { toast.error("Erreur réseau"); }
    finally { setInvSaving(false); }
  }

  function toggleInvestisseur(id: number) {
    set("investisseursConcernes", investisseurs.includes(id) ? investisseurs.filter(x => x !== id) : [...investisseurs, id]);
  }

  return (
    <div className="space-y-4">
      {/* Région / Agence / Durée / Risque */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Région</span>
          <input value={value.region ?? ""} disabled={disabled} onChange={e => set("region", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Agence</span>
          <input value={value.agence ?? ""} disabled={disabled} onChange={e => set("agence", e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Durée cycle (jours)</span>
          <input type="number" value={value.dureeCycleJours ?? ""} disabled={disabled}
            onChange={e => set("dureeCycleJours", e.target.value ? Number(e.target.value) : undefined)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Risque estimé</span>
          <select value={value.risqueEstime ?? "MOYEN"} disabled={disabled} onChange={e => set("risqueEstime", e.target.value as ContenuDF["risqueEstime"])}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50">
            <option value="FAIBLE">Faible</option><option value="MOYEN">Moyen</option><option value="ELEVE">Élevé</option>
          </select>
        </label>
      </div>

      {/* Responsable demandeur */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Responsable demandeur</label>
        <ResponsableSearch value={value.responsableDemandeurId} nom={value.responsableDemandeurNom} disabled={disabled}
          apiBase={gestionnairesApiBase}
          onSelect={g => onChange({ ...value, responsableDemandeurId: g?.id, responsableDemandeurNom: g?.nom })} />
      </div>

      {/* Investisseurs concernés (portefeuilles) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-500">Investisseurs concernés (portefeuilles)</label>
          {!disabled && (
            <button type="button" onClick={() => setShowCreerInv(s => !s)} className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Nouvel investisseur
            </button>
          )}
        </div>
        {showCreerInv && !disabled && (
          <div className="border border-violet-200 rounded-lg p-2 mb-2 space-y-1.5 bg-violet-50/40">
            <div className="grid grid-cols-2 gap-1.5">
              <input value={invForm.prenom} onChange={e => setInvForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" className="border border-slate-200 rounded px-2 py-1 text-xs" />
              <input value={invForm.nom} onChange={e => setInvForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" className="border border-slate-200 rounded px-2 py-1 text-xs" />
              <input value={invForm.email} onChange={e => setInvForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="border border-slate-200 rounded px-2 py-1 text-xs" />
              <input value={invForm.telephone} onChange={e => setInvForm(f => ({ ...f, telephone: e.target.value }))} placeholder="Téléphone" className="border border-slate-200 rounded px-2 py-1 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={creerInvestisseur} disabled={invSaving}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50">
                {invSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Créer (avec portefeuille)
              </button>
              <button type="button" onClick={() => setShowCreerInv(false)} className="text-xs text-slate-500 hover:text-slate-700">Annuler</button>
            </div>
          </div>
        )}
        {disabled ? (
          <p className="text-sm text-slate-700">{investisseurs.length ? investisseurs.map(id => `#${id}`).join(", ") : "—"}</p>
        ) : (
          <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
            {portefeuilles.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Aucun portefeuille</p>}
            {portefeuilles.map(p => (
              <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" checked={investisseurs.includes(p.id)} onChange={() => toggleInvestisseur(p.id)} className="accent-violet-600" />
                <span className="text-sm text-slate-700 truncate">{pfLabel(p)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Pièces jointes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Pièces jointes ({pieces.length})</p>
          {!disabled && (
            <button type="button" onClick={() => set("piecesJointesUrls", [...pieces, ""])} className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Ajouter un lien
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {pieces.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={url} disabled={disabled} onChange={e => set("piecesJointesUrls", pieces.map((u, idx) => idx === i ? e.target.value : u))}
                placeholder="https://… (lien du document)"
                className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-slate-50" />
              {!disabled && <button type="button" onClick={() => set("piecesJointesUrls", pieces.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
          {pieces.length === 0 && <p className="text-xs text-slate-400">Aucune pièce jointe</p>}
        </div>
      </div>

      {/* Clients + produits */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-slate-500">Clients ({clients.length})</p>
          {!disabled && (
            <button type="button" onClick={() => setClients([...clients, { clientId: 0, nom: "", montant: 0, produits: [] }])}
              className="flex items-center gap-1 text-xs text-violet-600 hover:underline">
              <Plus className="w-3.5 h-3.5" /> Ajouter un client
            </button>
          )}
        </div>
        <div className="space-y-3">
          {clients.map((c, ci) => (
            <div key={ci} className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <ClientSearchSelect apiBase={clientsApiBase} clientId={c.clientId} nom={c.nom ?? ""} disabled={disabled} allowCreate
                  onSelect={cl => updClient(ci, { clientId: cl.id, nom: cl.nom })} />
                <input type="number" placeholder="Montant" value={c.montant || ""} disabled={disabled}
                  onChange={e => updClient(ci, { montant: Number(e.target.value) || 0 })}
                  className="w-32 border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50" />
                {!disabled && <button type="button" onClick={() => setClients(clients.filter((_, idx) => idx !== ci))} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4" /></button>}
              </div>
              <div className="pl-4 space-y-1.5">
                {(c.produits ?? []).map((p, pi) => (
                  <div key={pi} className="flex items-center gap-2 text-xs">
                    <input placeholder="Produit" value={p.nom} disabled={disabled}
                      onChange={e => updClient(ci, { produits: (c.produits ?? []).map((x, j) => j === pi ? { ...x, nom: e.target.value } : x) })}
                      className="flex-1 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Qté" value={p.quantite} disabled={disabled}
                      onChange={e => updClient(ci, { produits: (c.produits ?? []).map((x, j) => j === pi ? { ...x, quantite: Number(e.target.value) || 0 } : x) })}
                      className="w-16 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Coût achat" value={p.coutAchat} disabled={disabled}
                      onChange={e => updClient(ci, { produits: (c.produits ?? []).map((x, j) => j === pi ? { ...x, coutAchat: Number(e.target.value) || 0 } : x) })}
                      className="w-24 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    <input type="number" placeholder="Prix revente" value={p.prixRevente} disabled={disabled}
                      onChange={e => updClient(ci, { produits: (c.produits ?? []).map((x, j) => j === pi ? { ...x, prixRevente: Number(e.target.value) || 0 } : x) })}
                      className="w-24 border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                    {!disabled && <button type="button" onClick={() => updClient(ci, { produits: (c.produits ?? []).filter((_, j) => j !== pi) })} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
                {!disabled && (
                  <button type="button" onClick={() => updClient(ci, { produits: [...(c.produits ?? []), { nom: "", quantite: 1, coutAchat: 0, prixRevente: 0 }] })}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-violet-600">
                    <Plus className="w-3 h-3" /> Produit
                  </button>
                )}
              </div>
            </div>
          ))}
          {clients.length === 0 && <p className="text-xs text-slate-400">Aucun client renseigné</p>}
        </div>
      </div>

      {/* Synthèse live */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" /> Nb clients</p><p className="text-sm font-bold text-slate-800">{synth.nbClients}</p></div>
        <div className="rounded-lg bg-blue-50 px-3 py-2"><p className="text-xs text-blue-500 flex items-center gap-1"><Wallet className="w-3 h-3" /> Montant total</p><p className="text-sm font-bold text-blue-700">{fmt(synth.montantTotal)} FCFA</p></div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2"><p className="text-xs text-emerald-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Marge prévis.</p><p className="text-sm font-bold text-emerald-700">{fmt(synth.marge)} FCFA</p></div>
        <div className="rounded-lg bg-teal-50 px-3 py-2"><p className="text-xs text-teal-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> ROI estimé</p><p className="text-sm font-bold text-teal-700">{synth.roi.toFixed(1)} %</p></div>
      </div>
    </div>
  );
}
