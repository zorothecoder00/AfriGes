"use client";

import React, { useEffect, useState } from "react";
import { X, Printer, FileText, Plus, Trash2, Loader2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LigneFacture {
  designation: string;
  unite?: string | null;
  quantite: number;
  prixUnitaire: number;
  montant: number;
}

interface FactureData {
  id: number;
  numero: string;
  type: "COMPTANT" | "CREDIT" | "PRO_FORMA";
  statut: string;
  dateEmission: string;
  dateEcheance?: string | null;
  clientNom: string;
  clientTelephone?: string | null;
  clientAdresse?: string | null;
  emiseParNom: string;
  pdvNom?: string | null;
  pdvAdresse?: string | null;
  pdvTelephone?: string | null;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  montantPaye: number;
  modePaiement?: string | null;
  notes?: string | null;
  lignes: LigneFacture[];
  entreprise: { nom: string; adresse?: string; telephone?: string };
}

interface ProFormaLine {
  designation: string;
  unite: string;
  quantite: string;
  prixUnitaire: string;
}

export interface FactureModalProps {
  /** Source : vente directe (comptant ou crédit via vente) */
  venteDirecteId?: number;
  /** Source : crédit client autonome */
  creditClientId?: number;
  /** Source : livraison de pack (ReceptionProduitPack) */
  receptionPackId?: number;
  /** Mode pro-forma : affiche le formulaire de création */
  proFormaMode?: boolean;
  /** Pré-remplit le nom du client pour le pro-forma */
  proFormaClientNom?: string;
  onClose: () => void;
  onGenerated?: (factureId: number) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  COMPTANT:  { label: "AU COMPTANT",  bg: "bg-emerald-600", text: "text-white" },
  CREDIT:    { label: "À CRÉDIT",     bg: "bg-blue-600",    text: "text-white" },
  PRO_FORMA: { label: "PRO-FORMA",    bg: "bg-amber-500",   text: "text-white" },
};

const MODE_LABELS: Record<string, string> = {
  ESPECES:      "Espèces",
  VIREMENT:     "Virement bancaire",
  CHEQUE:       "Chèque",
  MOBILE_MONEY: "Mobile Money",
  WALLET:       "Wallet",
  CREDIT:       "Crédit",
};

// ─── Layout imprimable de la facture ─────────────────────────────────────────

function InvoiceLayout({ f }: { f: FactureData }) {
  const badge   = TYPE_BADGE[f.type] ?? TYPE_BADGE.COMPTANT;
  const hasTVA  = f.montantTVA > 0;
  const solde   = f.montantTTC - f.montantPaye;
  const isPaid  = f.montantPaye >= f.montantTTC && f.type !== "PRO_FORMA";

  return (
    <div className="bg-white text-slate-800 font-['DM_Sans',sans-serif]">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "#059669" }}>
            {f.entreprise.nom}
          </h1>
          {f.entreprise.adresse   && <p className="text-sm text-slate-500 mt-0.5">{f.entreprise.adresse}</p>}
          {f.entreprise.telephone && <p className="text-sm text-slate-500">{f.entreprise.telephone}</p>}
          {f.pdvNom && (
            <p className="text-sm font-semibold text-slate-600 mt-1">{f.pdvNom}</p>
          )}
          {f.pdvTelephone && <p className="text-xs text-slate-400">{f.pdvTelephone}</p>}
        </div>

        <div className="text-right space-y-1">
          <span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${badge.bg} ${badge.text}`}>
            FACTURE {badge.label}
          </span>
          <p className="text-xl font-black text-slate-800">{f.numero}</p>
          <p className="text-sm text-slate-500">
            Émise le {new Date(f.dateEmission).toLocaleDateString("fr-FR")}
          </p>
          {f.dateEcheance && (
            <p className="text-sm font-semibold text-red-600">
              Échéance : {new Date(f.dateEcheance).toLocaleDateString("fr-FR")}
            </p>
          )}
          {f.statut === "ANNULEE" && (
            <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded">
              ANNULÉE
            </span>
          )}
        </div>
      </div>

      {/* ── Parties ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Facturé à</p>
          <p className="font-bold text-slate-800 text-base">{f.clientNom}</p>
          {f.clientTelephone && <p className="text-sm text-slate-500 mt-0.5">{f.clientTelephone}</p>}
          {f.clientAdresse   && <p className="text-sm text-slate-500">{f.clientAdresse}</p>}
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Émis par</p>
          <p className="font-bold text-slate-800 text-base">{f.emiseParNom}</p>
          {f.pdvNom      && <p className="text-sm text-slate-500 mt-0.5">{f.pdvNom}</p>}
          {f.pdvAdresse  && <p className="text-sm text-slate-500">{f.pdvAdresse}</p>}
          {f.pdvTelephone && <p className="text-sm text-slate-500">{f.pdvTelephone}</p>}
        </div>
      </div>

      {/* ── Tableau des lignes ───────────────────────────────────────────────── */}
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-slate-200 text-xs uppercase tracking-wide">
            <th className="text-left pb-2 text-slate-400 w-8">N°</th>
            <th className="text-left pb-2 text-slate-400">Désignation</th>
            <th className="text-center pb-2 text-slate-400 w-16">Qté</th>
            <th className="text-right pb-2 text-slate-400 w-28">Prix unit.</th>
            <th className="text-right pb-2 text-slate-400 w-28">Montant</th>
          </tr>
        </thead>
        <tbody>
          {f.lignes.map((l, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2.5 text-slate-400 text-xs">{i + 1}</td>
              <td className="py-2.5 font-medium text-slate-800">
                {l.designation}
                {l.unite && (
                  <span className="text-slate-400 text-xs ml-1">({l.unite})</span>
                )}
              </td>
              <td className="py-2.5 text-center text-slate-700">{l.quantite}</td>
              <td className="py-2.5 text-right text-slate-600">{formatCurrency(l.prixUnitaire)}</td>
              <td className="py-2.5 text-right font-semibold text-slate-800">{formatCurrency(l.montant)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totaux ──────────────────────────────────────────────────────────── */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2 text-sm">
          {hasTVA && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-medium">{formatCurrency(f.montantHT)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TVA</span>
                <span className="font-medium">{formatCurrency(f.montantTVA)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t-2 border-slate-200 pt-2">
            <span className="font-bold text-slate-800 text-base">Total TTC</span>
            <span className="font-black text-lg" style={{ color: "#059669" }}>
              {formatCurrency(f.montantTTC)}
            </span>
          </div>

          {f.modePaiement && (
            <div className="flex justify-between text-slate-500">
              <span>Mode de paiement</span>
              <span>{MODE_LABELS[f.modePaiement] ?? f.modePaiement}</span>
            </div>
          )}

          {f.montantPaye > 0 && f.montantPaye < f.montantTTC && (
            <>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant payé</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(f.montantPaye)}</span>
              </div>
              <div className="flex justify-between font-bold text-red-600">
                <span>Reste à payer</span>
                <span>{formatCurrency(solde)}</span>
              </div>
            </>
          )}

          {isPaid && (
            <div className="text-center py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
              ✓ PAYÉ INTÉGRALEMENT
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ───────────────────────────────────────────────────────────── */}
      {f.notes && (
        <div className="bg-slate-50 rounded-xl p-4 mb-8 text-sm text-slate-600 italic">
          <span className="font-semibold not-italic">Note : </span>{f.notes}
        </div>
      )}

      {/* ── Signatures ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-16 mt-10 pt-8 border-t border-slate-200">
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-10">Signature & cachet du client</p>
          <div className="border-b border-slate-300" />
          <p className="text-xs text-slate-500 mt-1">{f.clientNom}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400 mb-10">Signature & cachet {f.entreprise.nom}</p>
          <div className="border-b border-slate-300" />
          <p className="text-xs text-slate-500 mt-1">{f.emiseParNom}</p>
        </div>
      </div>

      {/* ── Mention pro-forma ────────────────────────────────────────────────── */}
      {f.type === "PRO_FORMA" && (
        <p className="text-center text-xs text-slate-400 mt-6 italic">
          Ce document est une facture pro-forma — il ne constitue pas une facture définitive.
          Valide sous réserve de disponibilité des produits.
        </p>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FactureModal({
  venteDirecteId,
  creditClientId,
  receptionPackId,
  proFormaMode = false,
  proFormaClientNom = "",
  onClose,
  onGenerated,
}: FactureModalProps) {
  const [loading,  setLoading]  = useState(false);
  const [facture,  setFacture]  = useState<FactureData | null>(null);
  const [step,     setStep]     = useState<"loading" | "form" | "preview">(
    proFormaMode ? "form" : "loading"
  );

  // Pro-forma form state
  const [pfClient,   setPfClient]   = useState(proFormaClientNom);
  const [pfTel,      setPfTel]      = useState("");
  const [pfNotes,    setPfNotes]    = useState("");
  const [pfEcheance, setPfEcheance] = useState("");
  const [pfLignes,   setPfLignes]   = useState<ProFormaLine[]>([
    { designation: "", unite: "", quantite: "1", prixUnitaire: "" },
  ]);

  // Auto-génère si source connue
  useEffect(() => {
    if (!proFormaMode && (venteDirecteId || creditClientId || receptionPackId)) {
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate(body?: Record<string, unknown>) {
    setLoading(true);
    try {
      const payload = body ?? (
        venteDirecteId  ? { type: "COMPTANT", venteDirecteId }  :
        creditClientId  ? { type: "CREDIT",   creditClientId }  :
        receptionPackId ? { type: "COMPTANT", receptionPackId } :
        {}
      );

      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erreur lors de la génération");
        if (!body) onClose();
        return;
      }

      const data = await res.json();
      setFacture(data.data);
      setStep("preview");
      onGenerated?.(data.data.id);
    } finally {
      setLoading(false);
    }
  }

  async function generateProForma() {
    if (!pfClient.trim()) { toast.error("Nom du client requis"); return; }
    const valid = pfLignes.filter(
      l => l.designation.trim() && Number(l.quantite) > 0 && Number(l.prixUnitaire) > 0
    );
    if (!valid.length) { toast.error("Ajoutez au moins une ligne valide"); return; }

    await generate({
      type:            "PRO_FORMA",
      clientNom:       pfClient.trim(),
      clientTelephone: pfTel.trim() || undefined,
      notes:           pfNotes.trim() || undefined,
      dateEcheance:    pfEcheance || undefined,
      lignes: valid.map(l => ({
        designation:  l.designation.trim(),
        unite:        l.unite.trim() || undefined,
        quantite:     Number(l.quantite),
        prixUnitaire: Number(l.prixUnitaire),
      })),
    });
  }

  const updatePfLigne = (i: number, field: keyof ProFormaLine, val: string) =>
    setPfLignes(ls => ls.map((x, j) => j === i ? { ...x, [field]: val } : x));

  const pfTotal = pfLignes.reduce(
    (s, l) => s + Number(l.quantite || 0) * Number(l.prixUnitaire || 0),
    0
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3 shadow-2xl">
          <Loader2 className="animate-spin text-emerald-600" size={24} />
          <span className="text-slate-700 font-medium">Génération de la facture…</span>
        </div>
      </div>
    );
  }

  // ── Formulaire Pro-forma ───────────────────────────────────────────────────
  if (step === "form") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                <FileText size={16} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-slate-800">Nouvelle facture pro-forma</h3>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
            {/* Client */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nom client <span className="text-red-500">*</span>
                </label>
                <input
                  value={pfClient}
                  onChange={e => setPfClient(e.target.value)}
                  placeholder="Nom complet du client"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Téléphone</label>
                <input
                  value={pfTel}
                  onChange={e => setPfTel(e.target.value)}
                  placeholder="+225 …"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>

            {/* Lignes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Articles</label>
                <button
                  type="button"
                  onClick={() => setPfLignes(l => [...l, { designation: "", unite: "", quantite: "1", prixUnitaire: "" }])}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium">
                  <Plus size={12} /> Ajouter une ligne
                </button>
              </div>

              {/* Header colonnes */}
              <div className="grid grid-cols-12 gap-2 mb-1 text-xs text-slate-400 font-medium px-1">
                <span className="col-span-4">Désignation *</span>
                <span className="col-span-2">Unité</span>
                <span className="col-span-2">Qté *</span>
                <span className="col-span-3">Prix unit. *</span>
              </div>

              <div className="space-y-2">
                {pfLignes.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      value={l.designation}
                      onChange={e => updatePfLigne(i, "designation", e.target.value)}
                      placeholder="Ex: Riz 25kg"
                      className="col-span-4 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <input
                      value={l.unite}
                      onChange={e => updatePfLigne(i, "unite", e.target.value)}
                      placeholder="kg, L…"
                      className="col-span-2 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <input
                      type="number" min="1"
                      value={l.quantite}
                      onChange={e => updatePfLigne(i, "quantite", e.target.value)}
                      className="col-span-2 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <input
                      type="number" min="0"
                      value={l.prixUnitaire}
                      onChange={e => updatePfLigne(i, "prixUnitaire", e.target.value)}
                      placeholder="FCFA"
                      className="col-span-3 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <button
                      type="button"
                      onClick={() => setPfLignes(ls => ls.filter((_, j) => j !== i))}
                      disabled={pfLignes.length === 1}
                      className="col-span-1 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl disabled:opacity-30 transition-colors flex items-center justify-center">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="text-right mt-2">
                <span className="text-sm font-bold text-slate-800">
                  Total : {formatCurrency(pfTotal)}
                </span>
              </div>
            </div>

            {/* Date + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date d&apos;échéance</label>
                <input
                  type="date"
                  value={pfEcheance}
                  onChange={e => setPfEcheance(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <input
                  value={pfNotes}
                  onChange={e => setPfNotes(e.target.value)}
                  placeholder="Conditions, remarques…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Annuler
            </button>
            <button
              onClick={generateProForma}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Générer la pro-forma
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Aperçu de la facture ───────────────────────────────────────────────────
  if (!facture) return null;

  return (
    <>
      {/* Styles d'impression : seule la facture est imprimée */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #facture-print-zone {
            display: block !important;
            position: fixed; inset: 0;
            background: white; z-index: 99999;
            padding: 32px;
          }
        }
      `}</style>

      {/* Modal interactive (masquée à l'impression) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm print:hidden">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Receipt size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">
                  {facture.type === "PRO_FORMA" ? "Facture pro-forma" :
                   facture.type === "CREDIT" ? "Facture à crédit" : "Facture au comptant"}
                </h3>
                <p className="text-xs text-slate-400">{facture.numero}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
                <Printer size={14} /> Imprimer
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* Aperçu scrollable */}
          <div className="overflow-y-auto flex-1 p-8">
            <InvoiceLayout f={facture} />
          </div>
        </div>
      </div>

      {/* Zone dédiée impression — invisible en mode normal, visible uniquement lors de window.print() */}
      <div id="facture-print-zone" className="hidden">
        <InvoiceLayout f={facture} />
      </div>
    </>
  );
}
