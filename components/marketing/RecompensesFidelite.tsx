"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Gift, Plus, Loader2, X, Power, PowerOff, Search, CheckCircle2 } from "lucide-react";

/**
 * Récompenses fidélité (CDC §36) — catalogue RecompenseFidelite (réutilisé,
 * jusqu'ici orphelin) + rachat branché sur CompteFidelite. Déclenché côté
 * staff sur la fiche d'un client (pas d'auto-service client).
 */

const TYPE_LABEL: Record<string, string> = { REDUCTION: "Réduction", PRODUIT_GRATUIT: "Produit gratuit", CASHBACK: "Cashback" };

interface Recompense {
  id: number; nom: string; description: string | null; type: string;
  coutPoints: number; valeur: number | null; actif: boolean; dateExpiration: string | null;
  produit: { id: number; nom: string } | null;
  _count: { echanges: number };
}
interface Echange {
  id: number; pointsUtilises: number; statut: "DISPONIBLE" | "UTILISEE" | "EXPIREE"; createdAt: string;
  recompense: { nom: string; type: string };
  compteFidelite: { client: { id: number; nom: string; prenom: string } };
}
interface ClientSuggestion { id: number; label: string }

function ClientSearch({ value, valueLabel, onPick }: { value: number | null; valueLabel: string | null; onPick: (id: number | null, label: string | null) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ClientSuggestion[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!open || q.trim().length < 1) { setItems([]); return; }
      try {
        const r = await fetch(`/api/admin/clients?search=${encodeURIComponent(q.trim())}&limit=8`);
        const j = await r.json();
        setItems((j.data ?? []).map((c: { id: number; nom: string; prenom: string; telephone: string }) => ({ id: c.id, label: `${c.prenom} ${c.nom} · ${c.telephone}` })));
      } catch { setItems([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  if (value && valueLabel) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm">
        <span className="truncate text-gray-800">{valueLabel}</span>
        <button type="button" onClick={() => onPick(null, null)} className="text-gray-400 hover:text-rose-500 shrink-0"><X className="w-4 h-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input value={q} placeholder="Rechercher un client…" onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
      {open && q.trim().length >= 1 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {items.length === 0 ? <div className="px-3 py-2 text-xs text-gray-400">Aucun résultat</div> :
            items.map((it) => (
              <button type="button" key={it.id} onClick={() => { onPick(it.id, it.label); setQ(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-fuchsia-50 text-gray-700">{it.label}</button>
            ))}
        </div>
      )}
    </div>
  );
}

function NouvelleRecompenseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nom, setNom] = useState("");
  const [type, setType] = useState("REDUCTION");
  const [coutPoints, setCoutPoints] = useState("");
  const [valeur, setValeur] = useState("");
  const [dateExpiration, setDateExpiration] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim() || !coutPoints) { toast.error("Nom et coût en points sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/recompenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom.trim(), type, coutPoints: Number(coutPoints), valeur: valeur || null, dateExpiration: dateExpiration || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Récompense créée ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Gift className="w-5 h-5 text-fuchsia-600" /> Nouvelle récompense</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Réduction 5000 FCFA" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Type *</span>
              <select value={type} onChange={(e) => setType(e.target.value)} className={field}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className={lbl}>Coût en points *</span>
              <input type="number" min={1} value={coutPoints} onChange={(e) => setCoutPoints(e.target.value)} className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Valeur (XOF, optionnel)</span>
              <input type="number" min={0} value={valeur} onChange={(e) => setValeur(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Expiration (optionnel)</span>
              <input type="date" value={dateExpiration} onChange={(e) => setDateExpiration(e.target.value)} className={field} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function Echanger({ recompenses, onEchange }: { recompenses: Recompense[]; onEchange: () => void }) {
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientLabel, setClientLabel] = useState<string | null>(null);
  const [solde, setSolde] = useState<number | null>(null);
  const [recompenseId, setRecompenseId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) { setSolde(null); return; }
    fetch(`/api/admin/marketing/recompenses/echanger?clientId=${clientId}`).then((r) => r.json()).then((j) => setSolde(j.data?.soldePoints ?? 0)).catch(() => setSolde(0));
  }, [clientId]);

  const recompense = recompenses.find((r) => r.id === recompenseId) ?? null;
  const insuffisant = recompense && solde !== null && solde < recompense.coutPoints;

  const submit = async () => {
    if (!clientId || !recompenseId) { toast.error("Sélectionnez un client et une récompense"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/recompenses/echanger", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, recompenseId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Récompense échangée ✓");
      setClientId(null); setClientLabel(null); setRecompenseId(null);
      onEchange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-semibold text-slate-800">Échanger une récompense</h3>
      <label className="block"><span className={lbl}>Client</span>
        <div className="mt-1"><ClientSearch value={clientId} valueLabel={clientLabel} onPick={(id, l) => { setClientId(id); setClientLabel(l); }} /></div>
      </label>
      {clientId && (
        <p className="text-sm text-slate-600">Solde : <span className="font-bold text-fuchsia-700">{solde ?? "…"}</span> point(s)</p>
      )}
      <label className="block"><span className={lbl}>Récompense</span>
        <select value={recompenseId ?? ""} onChange={(e) => setRecompenseId(e.target.value ? Number(e.target.value) : null)}
          className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
          <option value="">— choisir —</option>
          {recompenses.filter((r) => r.actif).map((r) => <option key={r.id} value={r.id}>{r.nom} ({r.coutPoints} pts)</option>)}
        </select>
      </label>
      {insuffisant && <p className="text-xs text-rose-600">Solde insuffisant pour cette récompense.</p>}
      <button onClick={submit} disabled={saving || !clientId || !recompenseId || !!insuffisant}
        className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />} Échanger
      </button>
    </div>
  );
}

export default function RecompensesFidelite() {
  const [recompenses, setRecompenses] = useState<Recompense[]>([]);
  const [echanges, setEchanges] = useState<Echange[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/admin/marketing/recompenses"), fetch("/api/admin/marketing/recompenses/echanges"),
      ]);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      if (!r1.ok) throw new Error(j1.error ?? "Erreur"); if (!r2.ok) throw new Error(j2.error ?? "Erreur");
      setRecompenses(j1.data); setEchanges(j2.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActif = async (r: Recompense) => {
    const res = await fetch(`/api/admin/marketing/recompenses/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !r.actif }),
    });
    const j = await res.json();
    if (!res.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(r.actif ? "Récompense désactivée" : "Récompense activée"); load();
  };

  const marquerUtilisee = async (e: Echange) => {
    const res = await fetch(`/api/admin/marketing/recompenses/echanges/${e.id}`, { method: "PATCH" });
    const j = await res.json();
    if (!res.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success("Marqué comme utilisé ✓"); load();
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Gift className="w-5 h-5 text-fuchsia-600" /> Catalogue de récompenses</h2>
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
            <Plus className="w-4 h-4" /> Nouvelle récompense
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
          {recompenses.length === 0 ? <p className="text-center text-slate-400 py-16">Aucune récompense pour l&apos;instant</p> : recompenses.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-800">{r.nom}</p>
                <p className="text-xs text-slate-400">{TYPE_LABEL[r.type]} · {r.coutPoints} pts{r.valeur ? ` · ${r.valeur.toLocaleString("fr-FR")} FCFA` : ""} · {r._count.echanges} échange(s)</p>
              </div>
              <button onClick={() => toggleActif(r)} title={r.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                {r.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>

        <h3 className="font-semibold text-slate-800">Historique des échanges</h3>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
          {echanges.length === 0 ? <p className="text-center text-slate-400 py-10">Aucun échange pour l&apos;instant</p> : echanges.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{e.compteFidelite.client.prenom} {e.compteFidelite.client.nom} — {e.recompense.nom}</p>
                <p className="text-xs text-slate-400">{e.pointsUtilises} pts · {new Date(e.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              {e.statut === "DISPONIBLE" ? (
                <button onClick={() => marquerUtilisee(e)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Marquer utilisé
                </button>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Utilisée</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div><Echanger recompenses={recompenses} onEchange={load} /></div>

      {modalOpen && <NouvelleRecompenseModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
