"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Star, Plus, Loader2, X, ChevronDown, ChevronUp, Link as LinkIcon, Copy } from "lucide-react";

/** Influenceurs & Affiliés (CDC §47-49). */

interface Partenaire {
  id: number; type: "INFLUENCEUR" | "AFFILIE"; nom: string; plateforme: string | null;
  tarif: number | null; commissionPct: number; actif: boolean; _count: { liens: number };
}
interface Lien { id: number; code: string; nbClics: number; actif: boolean; coupon: { id: number; code: string } | null; campagne: { id: number; nom: string } | null }
interface Stats { nbClics: number; nbVentes: number; caGenere: number; commission: number; coutTotal: number; roi: number | null }
interface Campagne { id: number; code: string; nom: string }

const TYPE_LABEL: Record<string, string> = { INFLUENCEUR: "Influenceur", AFFILIE: "Affilié" };
const fmt = (v: number) => v.toLocaleString("fr-FR");

function NouveauPartenaireModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<"INFLUENCEUR" | "AFFILIE">("INFLUENCEUR");
  const [nom, setNom] = useState("");
  const [contact, setContact] = useState("");
  const [plateforme, setPlateforme] = useState("");
  const [tarif, setTarif] = useState("");
  const [commissionPct, setCommissionPct] = useState("10");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim()) { toast.error("Le nom est requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/partenaires", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, nom: nom.trim(), contact: contact.trim() || null, plateforme: plateforme.trim() || null, tarif: tarif || null, commissionPct: Number(commissionPct) || 0 }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success("Partenaire créé ✓"); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Star className="w-5 h-5 text-fuchsia-600" /> Nouveau partenaire</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Type *</span>
            <select value={type} onChange={(e) => setType(e.target.value as "INFLUENCEUR" | "AFFILIE")} className={field}>
              <option value="INFLUENCEUR">Influenceur</option>
              <option value="AFFILIE">Affilié</option>
            </select>
          </label>
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Contact</span>
              <input value={contact} onChange={(e) => setContact(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Plateforme</span>
              <input value={plateforme} onChange={(e) => setPlateforme(e.target.value)} placeholder="Instagram, TikTok…" className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Tarif fixe (FCFA)</span>
              <input type="number" min={0} value={tarif} onChange={(e) => setTarif(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Commission (%)</span>
              <input type="number" min={0} max={100} value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} className={field} />
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function NouveauLienModal({ partenaireId, campagnes, onClose, onCreated }: { partenaireId: number; campagnes: Campagne[]; onClose: () => void; onCreated: () => void }) {
  const [campagneId, setCampagneId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [avecRemise, setAvecRemise] = useState(false);
  const [typeRemise, setTypeRemise] = useState<"POURCENTAGE" | "MONTANT">("POURCENTAGE");
  const [valeur, setValeur] = useState("10");
  const [dateFin, setDateFin] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { campagneId: campagneId ? Number(campagneId) : null, destinationUrl: destinationUrl.trim() || null };
      if (avecRemise) {
        if (!dateFin) { toast.error("Date de fin de la remise requise"); setSaving(false); return; }
        body.remise = { typeRemise, valeur: Number(valeur), dateDebut: new Date().toISOString(), dateFin };
      }
      const r = await fetch(`/api/admin/marketing/partenaires/${partenaireId}/liens`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Lien créé (${j.data.code}) ✓`); onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><LinkIcon className="w-5 h-5 text-fuchsia-600" /> Nouveau lien</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Campagne (optionnel)</span>
            <select value={campagneId} onChange={(e) => setCampagneId(e.target.value)} className={field}>
              <option value="">Aucune</option>
              {campagnes.map((c) => <option key={c.id} value={c.id}>{c.nom} ({c.code})</option>)}
            </select>
          </label>
          <label className="block"><span className={lbl}>URL de destination</span>
            <input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="/catalogue" className={field} />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={avecRemise} onChange={(e) => setAvecRemise(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-700">Utilisable aussi comme code de réduction à l&apos;achat</span>
          </label>
          {avecRemise && (
            <div className="grid grid-cols-3 gap-3">
              <select value={typeRemise} onChange={(e) => setTypeRemise(e.target.value as "POURCENTAGE" | "MONTANT")} className={field}>
                <option value="POURCENTAGE">%</option>
                <option value="MONTANT">FCFA</option>
              </select>
              <input type="number" min={0} value={valeur} onChange={(e) => setValeur(e.target.value)} className={field} />
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailPartenaire({ partenaireId, onLienCree }: { partenaireId: number; onLienCree: () => void }) {
  const [liens, setLiens] = useState<Lien[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/marketing/partenaires/${partenaireId}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setLiens(j.data.liens); setStats(j.stats);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [partenaireId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/admin/marketing/campagnes").then((r) => r.json()).then((j) => setCampagnes(j.data ?? [])).catch(() => {}); }, []);

  const copierLien = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/api/marketing/r/${code}`).then(() => toast.success("Lien copié"));
  };

  if (loading) return <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
          {[
            ["Clics", stats.nbClics], ["Ventes", stats.nbVentes], ["CA généré", `${fmt(stats.caGenere)} F`],
            ["Commission", `${fmt(Math.round(stats.commission))} F`], ["ROI", stats.roi === null ? "—" : `${stats.roi.toFixed(0)}%`],
          ].map(([label, val]) => (
            <div key={label as string} className="bg-white rounded-lg border border-slate-100 py-2">
              <p className="text-[10px] text-slate-400">{label}</p>
              <p className="text-sm font-bold text-slate-800">{val}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Liens</span>
        <button onClick={() => setModalOpen(true)} className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700">+ Nouveau lien</button>
      </div>
      {liens.length === 0 ? <p className="text-xs text-slate-400">Aucun lien pour l&apos;instant</p> : (
        <div className="space-y-1.5">
          {liens.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
              <span className="font-mono text-slate-700">{l.code}{l.coupon ? " (remise active)" : ""} · {l.nbClics} clic(s)</span>
              <button onClick={() => copierLien(l.code)} className="p-1 text-slate-400 hover:text-fuchsia-600"><Copy className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {modalOpen && <NouveauLienModal partenaireId={partenaireId} campagnes={campagnes} onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); onLienCree(); }} />}
    </div>
  );
}

export default function PartenairesMarketing() {
  const [rows, setRows] = useState<Partenaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/partenaires");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Star className="w-5 h-5 text-fuchsia-600" /> Influenceurs & Affiliés</h2>
          <p className="text-sm text-slate-400">{rows.length} partenaire(s).</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau partenaire
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun partenaire pour l&apos;instant</p>
        ) : rows.map((p) => (
          <div key={p.id}>
            <button onClick={() => setOuvert(ouvert === p.id ? null : p.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
              <div>
                <p className="font-medium text-slate-800">{p.nom}</p>
                <p className="text-xs text-slate-400">{TYPE_LABEL[p.type]} · {p.plateforme ?? "—"} · commission {p.commissionPct}% · {p._count.liens} lien(s)</p>
              </div>
              {ouvert === p.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {ouvert === p.id && (
              <div className="px-4 pb-4 bg-slate-50/50">
                <DetailPartenaire partenaireId={p.id} onLienCree={load} />
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && <NouveauPartenaireModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
