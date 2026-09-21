"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { X, Loader2, Plus, Search, Printer, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import SortieCaissePicker from "@/components/SortieCaissePicker";

/**
 * Création d'une fiche de décaissement (CDC §3.6).
 * - Cas nominal : DEMANDE de sortie de fonds (objet, type, montant) suivie du circuit d'approbation ;
 *   le Caissier/Comptable exécute ensuite le décaissement.
 * - Variante : justificatif d'une sortie de caisse déjà effectuée (montant, motif et mode repris) ;
 *   `operationInitiale` fourni → sortie déjà choisie (bouton « Créer la fiche » d'une ligne).
 * Une fois la fiche créée, l'écran de succès propose PDF et impression immédiats.
 */

export interface OperationCaisseDispo {
  source: "CAISSE" | "CAISSE_PDV";
  id: number;
  reference: string;
  montant: number;
  motif: string;
  categorie: string | null;
  mode?: string | null;
  date: string;
  operateurNom: string;
  pointDeVente: { nom: string } | null;
  /** Membre bénéficiaire désigné à la sortie de caisse (salaire, avance, carburant…) */
  beneficiaire?: { id: number; nom: string; prenom: string; telephone: string | null } | null;
}

const TYPE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISES: "Achat marchandises", FOURNITURES: "Fournitures", PAIEMENT_FOURNISSEUR: "Paiement fournisseur",
  AVANCE_CAISSE: "Avance de caisse", FRAIS_FONCTIONNEMENT: "Frais de fonctionnement", TRANSPORT: "Transport",
  SALAIRE: "Salaire", CARBURANT: "Carburant", AUTRES: "Autres",
};
const CATEGORIE_LABEL: Record<string, string> = { SALAIRE: "Salaire", AVANCE: "Avance", FOURNISSEUR: "Fournisseur", CARBURANT: "Carburant", AUTRE: "Autre" };
/** Type de dépense suggéré à partir de la catégorie de la sortie de caisse (modifiable). */
const TYPE_SUGGERE: Record<string, string> = { SALAIRE: "SALAIRE", AVANCE: "AVANCE_CAISSE", FOURNISSEUR: "PAIEMENT_FOURNISSEUR", CARBURANT: "CARBURANT", AUTRE: "AUTRES" };

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-300";

interface FournisseurOption { id: number; nom: string; code: string }

export default function FicheDecaissementModal({ operationInitiale, onClose, onDone }: {
  operationInitiale?: OperationCaisseDispo | null;
  onClose: () => void;
  /** Appelé à la fermeture après une création réussie (pour rafraîchir la liste appelante). */
  onDone: (fiche: { id: number; reference: string }) => void;
}) {
  const [operation, setOperation] = useState<OperationCaisseDispo | null>(operationInitiale ?? null);
  const [modeJustificatif, setModeJustificatif] = useState(!!operationInitiale);
  const [montantDemande, setMontantDemande] = useState("");
  const [motif, setMotif] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");

  // Bénéficiaire désigné à la sortie de caisse → repris automatiquement et non modifiable ici
  // (le serveur fait foi). Sinon saisie manuelle.
  const membre = (modeJustificatif ? operation?.beneficiaire : null) ?? null;
  const [beneficiaireNomSaisi, setBeneficiaireNom] = useState("");
  const [beneficiaireContactSaisi, setBeneficiaireContact] = useState("");
  const beneficiaireNom = membre ? `${membre.prenom} ${membre.nom}` : beneficiaireNomSaisi;
  const beneficiaireContact = membre ? (membre.telephone ?? "") : beneficiaireContactSaisi;
  const [typeDepense, setTypeDepense] = useState(
    operationInitiale?.categorie ? (TYPE_SUGGERE[operationInitiale.categorie] ?? "AUTRES") : "AUTRES"
  );
  const [fournisseurQuery, setFournisseurQuery] = useState("");
  const [fournisseurOptions, setFournisseurOptions] = useState<FournisseurOption[]>([]);
  const [fournisseur, setFournisseur] = useState<FournisseurOption | null>(null);
  const [piecesJustificatives, setPiecesJustificatives] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [creee, setCreee] = useState<{ id: number; reference: string } | null>(null);
  // Justificatifs manquants d'une fiche payée précédente : bloque une NOUVELLE demande (pas la justification d'une sortie de caisse)
  const { data: manquantesRes } = useApi<{ data: { id: number; reference: string; beneficiaireNom: string; montantDemande: number | string; montantApprouve: number | string | null }[] }>("/api/decaissements/justificatifs-manquants");
  const manquantes = manquantesRes?.data ?? [];
  const bloque = !modeJustificatif && manquantes.length > 0;

  const requiertPieces = typeDepense === "ACHAT_MARCHANDISES" || typeDepense === "PAIEMENT_FOURNISSEUR";

  async function rechercherFournisseur(q: string) {
    setFournisseurQuery(q);
    if (q.trim().length < 2) { setFournisseurOptions([]); return; }
    const r = await fetch(`/api/logistique/fournisseurs?search=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setFournisseurOptions(j.data);
  }

  async function submit() {
    if (modeJustificatif && !operation) { toast.error("Sélectionnez la sortie de caisse à justifier"); return; }
    if (!modeJustificatif) {
      if (!(Number(montantDemande) > 0)) { toast.error("Montant demandé obligatoire"); return; }
      if (motif.trim().length < 10) { toast.error("Motif : 10 caractères minimum"); return; }
    }
    if (!beneficiaireNom.trim()) { toast.error("Bénéficiaire obligatoire"); return; }
    const pieces = piecesJustificatives.split(",").map((s) => s.trim()).filter(Boolean);
    if (requiertPieces && pieces.length === 0) { toast.error("Au moins une pièce justificative est requise pour ce type de dépense"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/decaissements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(modeJustificatif && operation
            ? (operation.source === "CAISSE" ? { operationCaisseId: operation.id } : { operationCaissePDVId: operation.id })
            : { montantDemande: Number(montantDemande), modePaiement }),
          motif: motif.trim() || undefined,
          beneficiaireNom, beneficiaireContact: beneficiaireContact || undefined, typeDepense,
          fournisseurId: fournisseur?.id, piecesJustificatives: pieces,
        }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Fiche ${j.data.reference} créée`);
      setCreee({ id: j.data.id, reference: j.data.reference });
    } catch { toast.error("Erreur réseau"); }
    finally { setSubmitting(false); }
  }

  function fermer() {
    if (creee) onDone(creee);
    else onClose();
  }

  const pdfUrl = creee ? `/api/decaissements/${creee.id}/pdf` : "";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800">{creee ? "Fiche créée" : "Nouvelle fiche de décaissement"}</h3>
          <button onClick={fermer}><X size={18} className="text-slate-400" /></button>
        </div>

        {creee ? (
          <>
            <div className="px-6 py-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="font-mono font-bold text-slate-800">{creee.reference}</p>
              <p className="text-sm text-slate-500">{modeJustificatif ? "La fiche est enregistrée et soumise au contrôle." : "La demande est enregistrée : elle suit le circuit d'approbation avant le décaissement."} Vous pouvez l&apos;imprimer maintenant.</p>
              <div className="flex items-center justify-center pt-2">
                <a href={pdfUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                  <Printer size={15} /> Ouvrir le PDF / Imprimer
                </a>
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={fermer} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Fermer</button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {bloque && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-800"><AlertTriangle size={16} /> Justificatifs manquants</p>
                  <p className="text-sm text-amber-800">Avant de créer une nouvelle fiche, joignez les pièces justificatives (reçus, factures…) de votre demande précédente :</p>
                  <ul className="space-y-1">
                    {manquantes.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700"><b className="font-mono">{m.reference}</b> — {m.beneficiaireNom} · {formatCurrency(Number(m.montantApprouve ?? m.montantDemande))}</span>
                        <Link href={`/dashboard/user/decaissements?detail=${m.id}`} onClick={onClose} className="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium">Joindre les pièces</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!operationInitiale && (
                <div className="flex gap-2 text-xs">
                  {[{ v: false, l: "Nouvelle demande" }, { v: true, l: "Justifier une sortie déjà faite" }].map((o) => (
                    <button key={String(o.v)} type="button" onClick={() => setModeJustificatif(o.v)}
                      className={`flex-1 px-3 py-2 rounded-lg border font-medium ${modeJustificatif === o.v ? "bg-primary-600 text-white border-primary-600" : "bg-white text-slate-600 border-slate-200"}`}>{o.l}</button>
                  ))}
                </div>
              )}
              {modeJustificatif ? (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Sortie de caisse à justifier *</label>
                  {operationInitiale ? (
                    <div className="px-3 py-2 rounded-lg border border-primary-200 bg-primary-50 text-xs">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-slate-700">{operationInitiale.reference}</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(operationInitiale.montant)}</span>
                      </span>
                      <span className="block text-slate-500 mt-0.5">
                        {operationInitiale.categorie ? `${CATEGORIE_LABEL[operationInitiale.categorie] ?? operationInitiale.categorie} · ` : ""}{operationInitiale.motif}
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-slate-400 mb-1.5">La fiche vient après la sortie de caisse : le montant, le motif et le mode de paiement en sont repris.</p>
                      <SortieCaissePicker
                        value={operation}
                        onChange={(o) => { setOperation(o); if (o.categorie) setTypeDepense(TYPE_SUGGERE[o.categorie] ?? "AUTRES"); }}
                        vide="Aucune sortie de caisse sans fiche. Enregistrez d'abord la sortie dans la caisse (salaire, carburant, fournisseur…), puis revenez créer la fiche."
                      />
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Montant demandé (FCFA) *</label>
                      <input type="number" min="0" value={montantDemande} onChange={(e) => setMontantDemande(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Mode de paiement souhaité</label>
                      <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value)} className={inputCls}>
                        <option value="ESPECES">Espèces</option><option value="MOBILE_MONEY">Mobile Money</option>
                        <option value="CHEQUE">Chèque</option><option value="VIREMENT">Virement</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Motif / description détaillée * <span className="text-slate-400 font-normal">(10 caractères minimum)</span></label>
                    <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} className={inputCls} />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Bénéficiaire * {membre && <span className="text-emerald-600 font-normal">(membre désigné à la sortie de caisse)</span>}
                </label>
                <input value={beneficiaireNom} onChange={(e) => setBeneficiaireNom(e.target.value)} readOnly={!!membre}
                  className={`${inputCls} ${membre ? "bg-slate-50 text-slate-600" : ""}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Contact bénéficiaire</label>
                <input value={beneficiaireContact} onChange={(e) => setBeneficiaireContact(e.target.value)} readOnly={!!membre}
                  className={`${inputCls} ${membre ? "bg-slate-50 text-slate-600" : ""}`} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Type de dépense *</label>
                <select value={typeDepense} onChange={(e) => setTypeDepense(e.target.value)} className={inputCls}>
                  {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              {(typeDepense === "PAIEMENT_FOURNISSEUR" || typeDepense === "ACHAT_MARCHANDISES") && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Fournisseur</label>
                  {fournisseur ? (
                    <div className="flex items-center justify-between px-3 py-2 border border-emerald-200 bg-emerald-50 rounded-lg text-sm">
                      <span>{fournisseur.nom}</span><button onClick={() => setFournisseur(null)}><X size={14} className="text-slate-400" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={fournisseurQuery} onChange={(e) => rechercherFournisseur(e.target.value)} placeholder="Nom ou code…" className={`${inputCls} pl-8`} />
                      {fournisseurOptions.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {fournisseurOptions.map((f) => (
                            <button key={f.id} onClick={() => { setFournisseur(f); setFournisseurOptions([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{f.nom} ({f.code})</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">
                  Pièces justificatives {requiertPieces && "*"} <span className="text-slate-400 font-normal">(séparées par des virgules)</span>
                </label>
                <input value={piecesJustificatives} onChange={(e) => setPiecesJustificatives(e.target.value)} className={inputCls} placeholder="Facture, Bon de commande…" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={submit} disabled={submitting || bloque || (modeJustificatif && !operation)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la fiche
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
