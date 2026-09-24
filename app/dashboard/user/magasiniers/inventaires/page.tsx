"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck, RefreshCw, Plus, ArrowLeft, Loader2, Save, Send, XCircle,
  Search, AlertTriangle, CheckCircle2, Clock, Copy, Printer,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDateTime } from "@/lib/format";

/**
 * Inventaire physique du PDV — le magasinier (ou RPV) démarre un inventaire (stock
 * système figé), saisit les quantités comptées puis le soumet à l'admin, seul
 * habilité à le valider (application des écarts au stock).
 */

type Statut = "EN_COURS" | "SOUMIS" | "VALIDE" | "ANNULE";
type Personne = { id: number; nom: string; prenom: string } | null;

interface InventaireRow {
  id: number; reference: string; statut: Statut; createdAt: string; dateInventaire: string;
  dateSoumission: string | null; dateValidation: string | null; commentaireValidation: string | null;
  pointDeVente: { nom: string };
  realisePar: Personne; validePar: Personne;
  _count: { lignes: number };
  lignes: { id: number }[];
}

interface LigneDetail {
  id: number; produitId: number; quantiteSysteme: number; quantiteConstatee: number; ecart: number;
  produit: { id: number; nom: string; reference: string | null; unite: string | null; prixUnitaire: string; prixAchat: string | null };
}

interface InventaireDetail extends Omit<InventaireRow, "_count" | "lignes"> {
  notes: string | null;
  lignes: LigneDetail[];
  stats: { nbLignes: number; nbEcarts: number; valeurEcart: number };
}

const STATUT_BADGE: Record<Statut, { cls: string; label: string }> = {
  EN_COURS: { cls: "bg-blue-100 text-blue-700",       label: "Comptage en cours" },
  SOUMIS:   { cls: "bg-amber-100 text-amber-700",     label: "En attente validation admin" },
  VALIDE:   { cls: "bg-emerald-100 text-emerald-700", label: "Validé" },
  ANNULE:   { cls: "bg-slate-100 text-slate-500",     label: "Annulé" },
};

export default function InventairesMagasinierPage() {
  return (
    <Suspense fallback={null}>
      <InventairesMagasinierInner />
    </Suspense>
  );
}

function InventairesMagasinierInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailId = Number(searchParams.get("detail") || 0) || null;

  const ouvrir = (id: number | null) =>
    router.replace(id ? `/dashboard/user/magasiniers/inventaires?detail=${id}` : "/dashboard/user/magasiniers/inventaires");

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {detailId
          ? <DetailInventaire id={detailId} onBack={() => ouvrir(null)} />
          : <ListeInventaires onOpen={ouvrir} />}
      </div>
    </div>
  );
}

// ─── Liste ─────────────────────────────────────────────────────────────────────

function ListeInventaires({ onOpen }: { onOpen: (id: number) => void }) {
  const { data, loading, error, refetch } = useApi<{ data: InventaireRow[] }>("/api/magasinier/inventaires?limit=50");
  const inventaires = data?.data ?? [];
  const ouvert = inventaires.find(i => i.statut === "EN_COURS" || i.statut === "SOUMIS");

  const [showStart, setShowStart] = useState(false);
  const [notes, setNotes] = useState("");
  const [starting, setStarting] = useState(false);

  async function demarrer() {
    setStarting(true);
    try {
      const r = await fetch("/api/magasinier/inventaires", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Inventaire ${j.data.reference} démarré`);
      setShowStart(false); setNotes("");
      onOpen(j.data.id);
    } catch { toast.error("Erreur réseau"); }
    finally { setStarting(false); }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <Link href="/dashboard/user/magasiniers" className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-1">
            <ArrowLeft size={13} /> Tableau de bord magasinier
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="text-orange-600" size={22} /> Inventaires physiques
          </h1>
          <p className="text-sm text-slate-500">Comptez le stock réel du point de vente puis soumettez l&apos;inventaire à la validation de l&apos;administrateur</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowStart(true)} disabled={!!ouvert}
            title={ouvert ? `L'inventaire ${ouvert.reference} est déjà ouvert` : undefined}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} /> Nouvel inventaire
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {loading && !data && <p className="text-sm text-slate-400">Chargement…</p>}
      {!loading && inventaires.length === 0 && !error && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400 text-sm">
          Aucun inventaire réalisé sur ce point de vente.
        </div>
      )}

      <div className="space-y-3">
        {inventaires.map(i => {
          const rejete = i.statut === "EN_COURS" && !!i.commentaireValidation;
          return (
            <button key={i.id} onClick={() => onOpen(i.id)}
              className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 font-mono text-sm">{i.reference}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_BADGE[i.statut].cls}`}>{STATUT_BADGE[i.statut].label}</span>
                    {rejete && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Renvoyé pour recomptage</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {i.pointDeVente.nom} — démarré le {formatDateTime(i.createdAt)}
                    {i.realisePar && ` par ${i.realisePar.prenom} ${i.realisePar.nom}`}
                  </p>
                  {i.validePar && i.statut === "VALIDE" && (
                    <p className="text-xs text-emerald-700 mt-0.5">Validé par {i.validePar.prenom} {i.validePar.nom} le {formatDateTime(i.dateValidation)}</p>
                  )}
                  {rejete && <p className="text-xs text-red-600 mt-0.5">Motif : {i.commentaireValidation}</p>}
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p><span className="font-semibold text-slate-700">{i._count.lignes}</span> produit(s)</p>
                  <p><span className={`font-semibold ${i.lignes.length ? "text-amber-600" : "text-slate-700"}`}>{i.lignes.length}</span> écart(s)</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {showStart && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowStart(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Démarrer un inventaire</h2>
            <p className="text-sm text-slate-500 mb-4">
              Le stock système actuel de chaque produit actif est figé comme référence. Vous saisirez ensuite les quantités réellement comptées.
            </p>
            <label className="text-xs font-medium text-slate-600">Notes (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Ex : inventaire mensuel de fin septembre"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowStart(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Annuler</button>
              <button onClick={demarrer} disabled={starting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {starting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Démarrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Détail / comptage ───────────────────────────────────────────────────────

function DetailInventaire({ id, onBack }: { id: number; onBack: () => void }) {
  const { data, loading, error, refetch } = useApi<{ data: InventaireDetail }>(`/api/magasinier/inventaires/${id}`);
  const inv = data?.data;
  const editable = inv?.statut === "EN_COURS";

  // Saisies locales (ligneId → quantité saisie, chaîne pour permettre le champ vide)
  const [saisies, setSaisies] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"TOUS" | "ECARTS" | "NON_SAISIS">("TOUS");
  const [busy, setBusy] = useState<null | "save" | "submit" | "cancel">(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (!inv) return;
    setSaisies(Object.fromEntries(inv.lignes.map(l => [l.id, String(l.quantiteConstatee)])));
  }, [inv]);

  const lignesCalc = useMemo(() => (inv?.lignes ?? []).map(l => {
    const raw = saisies[l.id];
    const qte = raw === undefined || raw === "" ? null : Number(raw);
    const ecart = qte === null || Number.isNaN(qte) ? null : qte - l.quantiteSysteme;
    return { ...l, qteSaisie: qte, ecartCalc: ecart, modifie: raw !== undefined && raw !== String(l.quantiteConstatee) };
  }), [inv, saisies]);

  const visibles = lignesCalc.filter(l => {
    if (search && !`${l.produit.nom} ${l.produit.reference ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtre === "ECARTS") return (l.ecartCalc ?? 0) !== 0;
    if (filtre === "NON_SAISIS") return l.qteSaisie === 0 && l.quantiteSysteme > 0;
    return true;
  });

  const nbModifies = lignesCalc.filter(l => l.modifie).length;
  const nbEcarts = lignesCalc.filter(l => (l.ecartCalc ?? 0) !== 0).length;
  const nbZeroSuspects = lignesCalc.filter(l => l.qteSaisie === 0 && l.quantiteSysteme > 0).length;
  const valeurEcart = lignesCalc.reduce((acc, l) => acc + (l.ecartCalc ?? 0) * Number(l.produit.prixAchat ?? l.produit.prixUnitaire), 0);
  const invalide = lignesCalc.some(l => l.qteSaisie === null || !Number.isInteger(l.qteSaisie) || l.qteSaisie < 0);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/magasinier/inventaires/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Erreur");
    return j;
  }

  async function enregistrer(silencieux = false) {
    if (invalide) { toast.error("Chaque quantité comptée doit être un entier positif ou nul"); return false; }
    const lignes = lignesCalc.filter(l => l.modifie).map(l => ({ ligneId: l.id, quantiteConstatee: l.qteSaisie }));
    if (!lignes.length) return true;
    setBusy("save");
    try {
      await patch({ lignes });
      if (!silencieux) toast.success(`${lignes.length} ligne(s) enregistrée(s)`);
      await refetch();
      return true;
    } catch (e) { toast.error((e as Error).message); return false; }
    finally { setBusy(null); }
  }

  async function soumettre() {
    if (!(await enregistrer(true))) return;
    setBusy("submit");
    try {
      await patch({ action: "SOUMETTRE" });
      toast.success("Inventaire soumis à la validation de l'administrateur");
      setConfirmSubmit(false);
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  async function annuler() {
    if (!confirm("Annuler cet inventaire ? Aucun écart ne sera appliqué au stock.")) return;
    setBusy("cancel");
    try {
      await patch({ action: "ANNULER" });
      toast.success("Inventaire annulé");
      refetch();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  }

  function preremplir() {
    // Recopie le stock système sur les lignes non encore comptées (qté 0) — le magasinier
    // ne corrige ensuite que les produits où il constate une différence.
    setSaisies(prev => {
      const next = { ...prev };
      for (const l of inv?.lignes ?? []) if (prev[l.id] === "0" || prev[l.id] === "") next[l.id] = String(l.quantiteSysteme);
      return next;
    });
  }

  function imprimerFeuille() {
    if (!inv) return;
    const rows = inv.lignes.map(l =>
      `<tr><td>${l.produit.nom}</td><td>${l.produit.reference ?? ""}</td><td>${l.produit.unite ?? ""}</td><td style="text-align:center">${l.quantiteSysteme}</td><td></td></tr>`,
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feuille de comptage ${inv.reference}</title>
      <style>body{font-family:sans-serif;padding:20px;color:#111}h1{font-size:18px;margin-bottom:4px}.meta{color:#555;font-size:13px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px;font-size:12px}th{background:#f3f4f6}td:last-child{width:110px}</style>
      </head><body><h1>Feuille de comptage — ${inv.reference}</h1>
      <div class="meta">${inv.pointDeVente.nom} — ${new Date().toLocaleDateString("fr-FR")} — ${inv.lignes.length} produit(s)</div>
      <table><thead><tr><th>Produit</th><th>Réf.</th><th>Unité</th><th>Stock système</th><th>Qté comptée</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:40px;font-size:12px">Compté par : ____________________ &nbsp;&nbsp; Signature : ____________________</p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  if (loading && !inv) return <p className="text-sm text-slate-400">Chargement…</p>;
  if (error || !inv) {
    return (
      <div>
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4"><ArrowLeft size={14} /> Retour</button>
        <p className="text-sm text-red-600">{error || "Inventaire introuvable"}</p>
      </div>
    );
  }

  const rejete = inv.statut === "EN_COURS" && !!inv.commentaireValidation;

  return (
    <>
      <button onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-2"><ArrowLeft size={13} /> Tous les inventaires</button>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{inv.reference}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUT_BADGE[inv.statut].cls}`}>{STATUT_BADGE[inv.statut].label}</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {inv.pointDeVente.nom} — démarré le {formatDateTime(inv.createdAt)}
            {inv.realisePar && ` par ${inv.realisePar.prenom} ${inv.realisePar.nom}`}
          </p>
          {inv.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{inv.notes}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={imprimerFeuille} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
            <Printer size={15} /> Feuille de comptage
          </button>
          {(inv.statut === "EN_COURS" || inv.statut === "SOUMIS") && (
            <button onClick={annuler} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-xl text-sm hover:bg-red-50 disabled:opacity-50">
              {busy === "cancel" ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />} Annuler
            </button>
          )}
        </div>
      </div>

      {rejete && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex gap-2">
          <AlertTriangle size={17} className="shrink-0 mt-0.5" />
          <div><p className="font-semibold">Inventaire renvoyé pour recomptage par l&apos;administrateur</p><p>Motif : {inv.commentaireValidation}</p></div>
        </div>
      )}
      {inv.statut === "SOUMIS" && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
          <Clock size={17} className="shrink-0 mt-0.5" />
          <p>Soumis le {formatDateTime(inv.dateSoumission)} — en attente de validation par l&apos;administrateur. Les écarts ne sont pas encore appliqués au stock.</p>
        </div>
      )}
      {inv.statut === "VALIDE" && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex gap-2">
          <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
          <p>
            Validé {inv.validePar && `par ${inv.validePar.prenom} ${inv.validePar.nom} `}le {formatDateTime(inv.dateValidation)} — écarts appliqués au stock.
            {inv.commentaireValidation && <> Commentaire : {inv.commentaireValidation}</>}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Stat label="Produits" value={String(inv.lignes.length)} />
        <Stat label="Écarts" value={String(nbEcarts)} tone={nbEcarts ? "amber" : undefined} />
        <Stat label="Valeur des écarts" value={formatCurrency(valeurEcart)} tone={valeurEcart < 0 ? "red" : valeurEcart > 0 ? "emerald" : undefined} />
        <Stat label="Comptés à 0 (stock > 0)" value={String(nbZeroSuspects)} tone={nbZeroSuspects ? "red" : undefined} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          <select value={filtre} onChange={e => setFiltre(e.target.value as typeof filtre)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="TOUS">Tous les produits</option>
            <option value="ECARTS">Avec écart</option>
            <option value="NON_SAISIS">Comptés à 0 (stock &gt; 0)</option>
          </select>
          {editable && (
            <button onClick={preremplir} title="Recopier le stock système sur les produits encore à 0"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
              <Copy size={14} /> Pré-remplir
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Produit</th>
                <th className="text-center px-3 py-2.5 font-medium">Stock système</th>
                <th className="text-center px-3 py-2.5 font-medium">Qté comptée</th>
                <th className="text-center px-3 py-2.5 font-medium">Écart</th>
                <th className="text-right px-4 py-2.5 font-medium">Valeur écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(l => {
                const cout = Number(l.produit.prixAchat ?? l.produit.prixUnitaire);
                const e = l.ecartCalc;
                return (
                  <tr key={l.id} className={l.modifie ? "bg-orange-50/50" : ""}>
                    <td className="px-4 py-2">
                      <p className="font-medium text-slate-800">{l.produit.nom}</p>
                      <p className="text-[11px] text-slate-400">{[l.produit.reference, l.produit.unite].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="text-center px-3 py-2 text-slate-600">{l.quantiteSysteme}</td>
                    <td className="text-center px-3 py-2">
                      {editable ? (
                        <input type="number" min={0} step={1} inputMode="numeric"
                          value={saisies[l.id] ?? ""} onChange={ev => setSaisies(s => ({ ...s, [l.id]: ev.target.value }))}
                          className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-300" />
                      ) : <span className="font-semibold text-slate-800">{l.quantiteConstatee}</span>}
                    </td>
                    <td className={`text-center px-3 py-2 font-semibold ${e === null ? "text-slate-300" : e > 0 ? "text-emerald-600" : e < 0 ? "text-red-600" : "text-slate-400"}`}>
                      {e === null ? "—" : e > 0 ? `+${e}` : e}
                    </td>
                    <td className={`text-right px-4 py-2 ${e && e < 0 ? "text-red-600" : e && e > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {e ? formatCurrency(e * cout) : "—"}
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Aucun produit ne correspond.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editable && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap sticky bottom-0 bg-white rounded-b-2xl">
            <p className="text-xs text-slate-500">
              {nbModifies ? `${nbModifies} ligne(s) modifiée(s) non enregistrée(s)` : "Toutes les saisies sont enregistrées"}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => enregistrer()} disabled={!!busy || !nbModifies}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {busy === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
              </button>
              <button onClick={() => setConfirmSubmit(true)} disabled={!!busy || invalide}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                <Send size={15} /> Soumettre à l&apos;admin
              </button>
            </div>
          </div>
        )}
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmSubmit(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Soumettre l&apos;inventaire ?</h2>
            <p className="text-sm text-slate-600">
              {nbEcarts} écart(s) pour une valeur de <strong>{formatCurrency(valeurEcart)}</strong>. Une fois soumis, le comptage n&apos;est plus modifiable
              sauf si l&apos;administrateur le renvoie pour recomptage.
            </p>
            {nbZeroSuspects > 0 && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5 flex gap-2">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                {nbZeroSuspects} produit(s) sont comptés à 0 alors que le système en indique en stock. Vérifiez qu&apos;ils ont bien été comptés.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setConfirmSubmit(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Retour</button>
              <button onClick={soumettre} disabled={!!busy}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Soumettre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "red" | "emerald" }) {
  const cls = tone === "amber" ? "text-amber-600" : tone === "red" ? "text-red-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-800";
  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
    </div>
  );
}
