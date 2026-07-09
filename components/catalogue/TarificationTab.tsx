"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calculator, Wand2, Building2, MapPin, Globe, ShieldCheck, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const TYPES: { v: string; l: string }[] = [
  { v: "ACHAT", l: "Prix d'achat" }, { v: "FOURNISSEUR", l: "Prix fournisseur" }, { v: "REVIENT", l: "Prix de revient" },
  { v: "GROS", l: "Prix de gros" }, { v: "DETAIL", l: "Prix détail (comptant)" }, { v: "COMMUNAUTE", l: "Prix Communauté" },
  { v: "VIP", l: "Prix VIP" }, { v: "PROMOTION", l: "Prix promotion" }, { v: "PERSONNEL", l: "Prix personnel" },
  { v: "PARTENAIRE", l: "Prix partenaire" }, { v: "REVENDEUR", l: "Prix revendeur" }, { v: "CREDIT", l: "Prix crédit" },
  { v: "NOUVEAU_CLIENT", l: "Prix nouveau client" }, { v: "FIDELE", l: "Prix fidèle" },
];
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.v, t.l]));
const PORTEE_ICON: Record<string, typeof Globe> = { GLOBAL: Globe, AGENCE: Building2, VILLE: MapPin, REGION: MapPin };
const PORTEE_LABEL: Record<string, string> = { GLOBAL: "Partout", AGENCE: "Agence", VILLE: "Ville", REGION: "Région" };

interface PrixRow {
  id: number; type: string; montant: number; portee: string; auto: boolean; actif: boolean;
  pointDeVenteId: number | null; ville: string | null; region: string | null;
  pointDeVente: { id: number; nom: string } | null;
}
interface PDV { id: number; nom: string }

export default function TarificationTab({ produitId }: { produitId: number }) {
  const [rows, setRows] = useState<PrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdvs, setPdvs] = useState<PDV[]>([]);

  // Formulaire d'ajout
  const [type, setType] = useState("DETAIL");
  const [montant, setMontant] = useState("");
  const [portee, setPortee] = useState("GLOBAL");
  const [pdvId, setPdvId] = useState("");
  const [ville, setVille] = useState("");
  const [region, setRegion] = useState("");
  const [adding, setAdding] = useState(false);

  // Moteur de prix auto
  const [autoParam, setAutoParam] = useState<{ actif: boolean; margeCiblePct: number; fraisLogistiquePct: number; arrondi: number; appliquerSurCredit: boolean; margeCreditPct: number; validationPrixObligatoire?: boolean } | null>(null);
  const [apercu, setApercu] = useState<{ prixRevient: number; prixVente: number; prixCredit: number | null } | null>(null);
  const [busyAuto, setBusyAuto] = useState(false);

  // Demande de changement de prix (validation)
  const [demandes, setDemandes] = useState<{ id: number; champ: string; ancienPrix: number | null; nouveauPrix: number; motif: string; statut: string; createdAt: string }[]>([]);
  const [dChamp, setDChamp] = useState<"VENTE" | "ACHAT">("VENTE");
  const [dPrix, setDPrix] = useState("");
  const [dMotif, setDMotif] = useState("");
  const [dBusy, setDBusy] = useState(false);

  const loadDemandes = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/demandes-prix`);
      const j = await r.json();
      if (r.ok) setDemandes(j.data);
    } catch { /* ignore */ }
  }, [produitId]);
  useEffect(() => { loadDemandes(); }, [loadDemandes]);

  const soumettreDemande = async () => {
    if (dPrix === "" || Number(dPrix) < 0) { toast.error("Prix invalide"); return; }
    if (!dMotif.trim()) { toast.error("Motif obligatoire"); return; }
    setDBusy(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/demandes-prix`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champ: dChamp, nouveauPrix: Number(dPrix), motif: dMotif.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Demande soumise à validation ✓");
      setDPrix(""); setDMotif(""); loadDemandes();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setDBusy(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setRows(j.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [produitId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/pdv?limit=100").then((r) => r.json()).then((j) => setPdvs(j.data ?? [])).catch(() => {});
    fetch("/api/admin/catalogue/prix-auto").then((r) => r.json()).then((j) => j?.data && setAutoParam({
      actif: j.data.actif, margeCiblePct: Number(j.data.margeCiblePct), fraisLogistiquePct: Number(j.data.fraisLogistiquePct),
      arrondi: j.data.arrondi, appliquerSurCredit: j.data.appliquerSurCredit, margeCreditPct: Number(j.data.margeCreditPct),
      validationPrixObligatoire: j.data.validationPrixObligatoire,
    })).catch(() => {});
  }, []);

  const ajouter = async () => {
    if (montant === "" || Number(montant) < 0) { toast.error("Montant invalide"); return; }
    setAdding(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, montant: Number(montant), portee, pointDeVenteId: pdvId || undefined, ville: ville || undefined, region: region || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Prix ajouté ✓");
      setMontant(""); setPdvId(""); setVille(""); setRegion(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setAdding(false); }
  };

  const supprimer = async (id: number) => {
    const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix/${id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { toast.error(j.message ?? "Erreur"); return; }
    toast.success("Supprimé"); load();
  };

  const toggleActif = async (row: PrixRow) => {
    const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !row.actif }),
    });
    if (!r.ok) { const j = await r.json(); toast.error(j.message ?? "Erreur"); return; }
    load();
  };

  const apercuAuto = async () => {
    setBusyAuto(true); setApercu(null);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix-auto`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      setApercu(j.data.calcul);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyAuto(false); }
  };
  const appliquerAuto = async () => {
    setBusyAuto(true);
    try {
      const r = await fetch(`/api/admin/catalogue/produits/${produitId}/prix-auto?apply=1`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Erreur");
      toast.success("Prix recalculés et appliqués ✓");
      setApercu(j.data.calcul); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusyAuto(false); }
  };

  return (
    <div className="space-y-5">
      {/* Moteur de prix auto */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-violet-700 flex items-center gap-2"><Wand2 className="w-4 h-4" /> Moteur de prix automatique</h4>
          <a href="/dashboard/admin/catalogue/prix-auto" className="text-[11px] text-violet-600 underline">Réglages</a>
        </div>
        {autoParam ? (
          <p className="text-[11px] text-gray-500 mb-3">
            Marge cible {autoParam.margeCiblePct}% · frais logistiques {autoParam.fraisLogistiquePct}%{autoParam.arrondi ? ` · arrondi ${autoParam.arrondi}` : ""}
            {autoParam.appliquerSurCredit ? ` · crédit +${autoParam.margeCreditPct}%` : ""}.
          </p>
        ) : <p className="text-[11px] text-gray-400 mb-3">Chargement des réglages…</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={apercuAuto} disabled={busyAuto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-200 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-50 disabled:opacity-50">
            {busyAuto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />} Simuler
          </button>
          <button onClick={appliquerAuto} disabled={busyAuto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            <Wand2 className="w-3.5 h-3.5" /> Recalculer &amp; appliquer
          </button>
          {apercu && (
            <span className="text-xs text-gray-600">
              Revient <b>{formatCurrency(apercu.prixRevient)}</b> · Vente <b className="text-violet-700">{formatCurrency(apercu.prixVente)}</b>
              {apercu.prixCredit != null ? <> · Crédit <b>{formatCurrency(apercu.prixCredit)}</b></> : null}
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Calculé depuis le prix d&apos;achat du produit. « Appliquer » met à jour le prix de vente + les lignes AUTO (revient, crédit).</p>
      </div>

      {/* Ajout d'une ligne de prix */}
      <div className="rounded-xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold text-gray-700 mb-3">Ajouter un prix</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <input type="number" min={0} value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Montant" className={inputCls} />
          <select value={portee} onChange={(e) => setPortee(e.target.value)} className={inputCls}>
            {Object.keys(PORTEE_LABEL).map((p) => <option key={p} value={p}>{PORTEE_LABEL[p]}</option>)}
          </select>
          {portee === "AGENCE" && (
            <select value={pdvId} onChange={(e) => setPdvId(e.target.value)} className={inputCls}>
              <option value="">— Agence —</option>
              {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          )}
          {portee === "VILLE" && <input value={ville} onChange={(e) => setVille(e.target.value)} placeholder="Ville" className={inputCls} />}
          {portee === "REGION" && <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Région" className={inputCls} />}
        </div>
        <button onClick={ajouter} disabled={adding}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Ajouter
        </button>
      </div>

      {/* Demande de changement de prix (validation §15) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
        <h4 className="text-sm font-bold text-emerald-700 mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Changement de prix (validation)</h4>
        <p className="text-[11px] text-gray-500 mb-3">
          {autoParam?.validationPrixObligatoire
            ? "La validation est obligatoire : le prix ne peut être modifié que via une demande approuvée."
            : "Soumettre un changement de prix de vente/achat à validation (Chef d'agence, Admin ou Resp. Marketing)."}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select value={dChamp} onChange={(e) => setDChamp(e.target.value as "VENTE" | "ACHAT")} className={inputCls}>
            <option value="VENTE">Prix de vente</option>
            <option value="ACHAT">Prix d&apos;achat</option>
          </select>
          <input type="number" min={0} value={dPrix} onChange={(e) => setDPrix(e.target.value)} placeholder="Nouveau prix" className={inputCls} />
          <input value={dMotif} onChange={(e) => setDMotif(e.target.value)} placeholder="Motif (obligatoire)" className={`${inputCls} sm:col-span-2`} />
        </div>
        <button onClick={soumettreDemande} disabled={dBusy}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {dBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Soumettre à validation
        </button>
        {demandes.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {demandes.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-xs bg-white rounded-lg border border-slate-100 px-3 py-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase">{d.champ === "VENTE" ? "Vente" : "Achat"}</span>
                <span className="text-gray-400">{d.ancienPrix != null ? formatCurrency(d.ancienPrix) : "—"}</span>
                <ArrowRight className="w-3 h-3 text-gray-300" />
                <span className="font-semibold text-gray-700">{formatCurrency(d.nouveauPrix)}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium ${d.statut === "EN_ATTENTE" ? "bg-amber-50 text-amber-700 border-amber-200" : d.statut === "APPROUVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                  {d.statut === "EN_ATTENTE" ? "En attente" : d.statut === "APPROUVE" ? "Approuvé" : "Rejeté"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Grille des prix */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">Aucun prix défini. Ajoutez au moins un prix de détail.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs border-b border-gray-100">
              <tr><th className="text-left py-2">Type</th><th className="text-left py-2">Portée</th><th className="text-right py-2">Montant</th><th className="text-center py-2">Statut</th><th></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => {
                const Icon = PORTEE_ICON[r.portee] ?? Globe;
                const cible = r.portee === "AGENCE" ? r.pointDeVente?.nom : r.portee === "VILLE" ? r.ville : r.portee === "REGION" ? r.region : null;
                return (
                  <tr key={r.id} className={r.actif ? "" : "opacity-50"}>
                    <td className="py-2 font-medium text-gray-800">
                      {TYPE_LABEL[r.type] ?? r.type}
                      {r.auto && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 uppercase">Auto</span>}
                    </td>
                    <td className="py-2 text-xs text-gray-500"><span className="inline-flex items-center gap-1"><Icon className="w-3 h-3" /> {PORTEE_LABEL[r.portee]}{cible ? ` · ${cible}` : ""}</span></td>
                    <td className="py-2 text-right font-semibold text-gray-900">{formatCurrency(r.montant)}</td>
                    <td className="py-2 text-center">
                      <button onClick={() => toggleActif(r)} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${r.actif ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {r.actif ? "Actif" : "Inactif"}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => supprimer(r.id)} className="text-gray-400 hover:text-rose-500" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500";
