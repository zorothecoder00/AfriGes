"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Ticket, Plus, Loader2, X, Power, PowerOff, ChevronDown, ChevronUp } from "lucide-react";

/** Coupons marketing (CDC §35) — codes saisis, remise sur le panier (vente admin). */

interface CouponRow {
  id: number; code: string; nom: string; description: string | null;
  typeRemise: "POURCENTAGE" | "MONTANT"; valeur: number;
  dateDebut: string; dateFin: string; utilisationMax: number | null; actif: boolean;
  campagne: { id: number; nom: string } | null;
  pointDeVente: { id: number; nom: string } | null;
  produit: { id: number; nom: string } | null;
  _count: { utilisations: number };
}

function statutCoupon(c: CouponRow, now = new Date()): "EN_COURS" | "PROGRAMMEE" | "EXPIREE" | "INACTIVE" {
  if (!c.actif) return "INACTIVE";
  const d = new Date(c.dateDebut), f = new Date(c.dateFin);
  if (now < d) return "PROGRAMMEE";
  if (now > f) return "EXPIREE";
  return "EN_COURS";
}
const STATUT_STYLE: Record<string, string> = {
  EN_COURS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PROGRAMMEE: "bg-blue-100 text-blue-700 border-blue-200",
  EXPIREE: "bg-slate-100 text-slate-400 border-slate-200",
  INACTIVE: "bg-slate-100 text-slate-500 border-slate-200",
};
const STATUT_LABEL: Record<string, string> = { EN_COURS: "En cours", PROGRAMMEE: "Programmée", EXPIREE: "Expiré", INACTIVE: "Inactif" };

interface Utilisation { id: number; client: { nom: string; prenom: string }; vente: { reference: string } | null; montantRemise: number; dateUtilisation: string }

function NouveauCouponModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [typeRemise, setTypeRemise] = useState<"POURCENTAGE" | "MONTANT">("POURCENTAGE");
  const [valeur, setValeur] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [utilisationMax, setUtilisationMax] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nom.trim() || !valeur || !dateDebut || !dateFin) { toast.error("Nom, valeur et période sont requis"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/admin/marketing/coupons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined, nom: nom.trim(), typeRemise, valeur: Number(valeur),
          dateDebut, dateFin, utilisationMax: utilisationMax ? Number(utilisationMax) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      toast.success(`Coupon créé (${j.data.code}) ✓`);
      onCreated();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setSaving(false); }
  };

  const field = "mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500";
  const lbl = "text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Ticket className="w-5 h-5 text-fuchsia-600" /> Nouveau coupon</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block"><span className={lbl}>Code (laisser vide pour générer)</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="AFRI10" className={field} />
          </label>
          <label className="block"><span className={lbl}>Nom *</span>
            <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Promo rentrée" className={field} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Type de remise *</span>
              <select value={typeRemise} onChange={(e) => setTypeRemise(e.target.value as "POURCENTAGE" | "MONTANT")} className={field}>
                <option value="POURCENTAGE">Pourcentage</option>
                <option value="MONTANT">Montant fixe</option>
              </select>
            </label>
            <label className="block"><span className={lbl}>Valeur *</span>
              <input type="number" min={0} value={valeur} onChange={(e) => setValeur(e.target.value)} className={field} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block"><span className={lbl}>Début *</span>
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={field} />
            </label>
            <label className="block"><span className={lbl}>Fin *</span>
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block"><span className={lbl}>Plafond d&apos;utilisation (vide = illimité)</span>
            <input type="number" min={1} value={utilisationMax} onChange={(e) => setUtilisationMax(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50">Annuler</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CouponsMarketing() {
  const [rows, setRows] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [utilisations, setUtilisations] = useState<Utilisation[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/marketing/coupons");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Chargement impossible"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActif = async (c: CouponRow) => {
    const r = await fetch(`/api/admin/marketing/coupons/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !c.actif }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Erreur"); return; }
    toast.success(c.actif ? "Coupon désactivé" : "Coupon activé"); load();
  };

  const ouvrirHistorique = async (c: CouponRow) => {
    if (ouvert === c.id) { setOuvert(null); return; }
    setOuvert(c.id); setLoadingHist(true);
    try {
      const r = await fetch(`/api/admin/marketing/coupons/${c.id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setUtilisations(j.data.utilisations);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoadingHist(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Ticket className="w-5 h-5 text-fuchsia-600" /> Coupons</h2>
          <p className="text-sm text-slate-400">{rows.length} coupon(s) — remise sur le panier, applicable à la vente admin.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-xl text-sm font-semibold">
          <Plus className="w-4 h-4" /> Nouveau coupon
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-slate-400 py-16">Aucun coupon pour l&apos;instant</p>
        ) : rows.map((c) => {
          const st = statutCoupon(c);
          return (
            <div key={c.id}>
              <button onClick={() => ouvrirHistorique(c)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 text-left">
                <div>
                  <p className="font-medium text-slate-800">{c.nom} <span className="text-xs font-mono text-slate-400">{c.code}</span></p>
                  <p className="text-xs text-slate-400">
                    {c.typeRemise === "POURCENTAGE" ? `-${c.valeur}%` : `-${c.valeur.toLocaleString("fr-FR")} FCFA`}
                    {" · "}{c._count.utilisations} utilisation(s){c.utilisationMax ? ` / ${c.utilisationMax}` : ""}
                    {c.campagne ? ` · ${c.campagne.nom}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[st]}`}>{STATUT_LABEL[st]}</span>
                  <button onClick={(e) => { e.stopPropagation(); toggleActif(c); }} title={c.actif ? "Désactiver" : "Activer"} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50">
                    {c.actif ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  {ouvert === c.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {ouvert === c.id && (
                <div className="px-4 pb-4 bg-slate-50/50">
                  {loadingHist ? (
                    <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>
                  ) : utilisations.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">Aucune utilisation pour l&apos;instant</p>
                  ) : (
                    <div className="space-y-1.5 pt-2">
                      {utilisations.map((u) => (
                        <div key={u.id} className="flex items-center justify-between text-xs text-slate-600">
                          <span>{u.client.prenom} {u.client.nom}{u.vente ? ` · ${u.vente.reference}` : ""}</span>
                          <span className="font-semibold text-fuchsia-700">-{u.montantRemise.toLocaleString("fr-FR")} FCFA</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modalOpen && <NouveauCouponModal onClose={() => setModalOpen(false)} onCreated={() => { setModalOpen(false); load(); }} />}
    </div>
  );
}
