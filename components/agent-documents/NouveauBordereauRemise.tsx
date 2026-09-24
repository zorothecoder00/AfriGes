"use client";

import { useEffect, useState } from "react";
import { PiecesUploader, type PieceBordereauUploadee } from "./PiecesBordereau";
import SignaturePad from "@/components/SignaturePad";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import { X, Send, AlertTriangle } from "lucide-react";

export const DENOMINATIONS = [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10];
const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";
const titreCls = "text-xs font-semibold text-slate-500 uppercase mb-2";

interface Profil { data: { nom: string; prenom: string; telephone: string | null; adresse: string | null; zone: string | null } }

/** Date du jour au format des champs `<input type="date">` (heure locale). */
function aujourdhui(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Saisie du Bordereau de Remise de Fonds, dans l'ordre du formulaire papier AfriSime
 * (lib/bordereauRemiseHtml.ts) : en-tête (date, agence, compte à créditer), I identité du
 * déposant (pré-remplie, modifiable pour une saisie au nom d'un tiers), II récapitulatif,
 * III billetage, IV références, V pièces jointes, VI déclaration + signature tracée.
 */
export default function NouveauBordereauRemise({ onClose, onCreated, pdvsDisponibles }: {
  onClose: () => void;
  onCreated: (id: number) => void;
  /** Agences proposées (ex. toutes pour l'admin) ; par défaut, les affectations du compte connecté. */
  pdvsDisponibles?: { id: number; nom: string; code: string }[];
}) {
  const [dateRemise, setDateRemise] = useState(aujourdhui());
  const [compte, setCompte] = useState({ titulaire: "", numero: "", banque: "", guichet: "" });
  const [deposant, setDeposant] = useState({ nom: "", prenom: "", zone: "", telephone: "", adresse: "" });
  const [cotisationsEspeces, setCotisationsEspeces] = useState("");
  const [cotisationsMobileMoney, setCotisationsMobileMoney] = useState("");
  const [mobileMoneyReference, setMobileMoneyReference] = useState("");
  const [mobileMoneyOperateur, setMobileMoneyOperateur] = useState("");
  const [remboursements, setRemboursements] = useState("");
  const [ventes, setVentes] = useState("");
  const [venteCarnet, setVenteCarnet] = useState("");
  const [fraisLivraison, setFraisLivraison] = useState("");
  const [montantVirement, setMontantVirement] = useState("");
  const [virementReference, setVirementReference] = useState("");
  const [billetage, setBilletage] = useState<Record<number, string>>({});
  const [motifEcart, setMotifEcart] = useState("");
  const [papier, setPapier] = useState({ carnets: false, fichesDe: "", fichesA: "", recusDe: "", recusA: "" });
  const [declaration, setDeclaration] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pieces, setPieces] = useState<PieceBordereauUploadee[]>([]);
  const { data: aff } = useApi<{ pdv: { id: number; nom: string; code: string } | null; pdvs: { id: number; nom: string; code: string }[] }>("/api/me/affectation");
  const { data: profil } = useApi<Profil>("/api/me/profile");
  const [pdvChoisi, setPdvChoisi] = useState("");
  const pdvs = pdvsDisponibles ?? aff?.pdvs ?? [];
  const pdvId = pdvChoisi || (pdvs[0] ? String(pdvs[0].id) : "");

  // Identité pré-remplie avec le compte connecté (une seule fois), modifiable ensuite.
  useEffect(() => {
    if (!profil?.data) return;
    const p = profil.data;
    setDeposant((d) => (d.nom || d.prenom ? d : {
      nom: p.nom ?? "", prenom: p.prenom ?? "", zone: p.zone ?? "", telephone: p.telephone ?? "", adresse: p.adresse ?? "",
    }));
  }, [profil]);

  const totalEspecesAttendu = (Number(cotisationsEspeces) || 0) + (Number(remboursements) || 0) + (Number(ventes) || 0) + (Number(venteCarnet) || 0) + (Number(fraisLivraison) || 0);
  const totalBilletage = DENOMINATIONS.reduce((s, d) => s + d * (Number(billetage[d]) || 0), 0);
  const ecart = totalBilletage - totalEspecesAttendu;
  const nomDeposant = [deposant.prenom, deposant.nom].filter(Boolean).join(" ") || "…";

  const handleSubmit = async () => {
    if (!deposant.nom.trim() || !deposant.prenom.trim()) { toast.error("Nom et prénom du déposant obligatoires"); return; }
    if (Math.abs(ecart) > 0.01 && !motifEcart.trim()) { toast.error("Motif de l'écart obligatoire"); return; }
    if (Number(cotisationsMobileMoney) > 0 && !mobileMoneyReference.trim()) { toast.error("Référence Mobile Money obligatoire"); return; }
    if (Number(montantVirement) > 0 && !virementReference.trim()) { toast.error("Référence de virement obligatoire"); return; }
    if (!pdvId) { toast.error("Agence / point de dépôt obligatoire"); return; }
    if (Number(montantVirement) > 0 && !pieces.some((p) => p.nature === "RELEVE_BANCAIRE")) { toast.error("Avis de virement obligatoire en pièce jointe"); return; }
    if (!declaration) { toast.error("Cochez la déclaration du collecteur"); return; }
    if (!signature) { toast.error("Signature du collecteur obligatoire"); return; }

    setSaving(true);
    try {
      const r = await fetch("/api/tresorerie/bordereaux-remise", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointDeVenteId: Number(pdvId),
          dateRemise: dateRemise || undefined,
          compteTitulaire: compte.titulaire, compteNumero: compte.numero, compteBanque: compte.banque, compteGuichet: compte.guichet,
          deposantNom: deposant.nom, deposantPrenom: deposant.prenom, deposantZone: deposant.zone,
          deposantTelephone: deposant.telephone, deposantAdresse: deposant.adresse,
          pieces,
          cotisationsEspeces: Number(cotisationsEspeces) || 0,
          cotisationsMobileMoney: Number(cotisationsMobileMoney) || 0,
          mobileMoneyReference: mobileMoneyReference || undefined,
          mobileMoneyOperateur: mobileMoneyOperateur || undefined,
          remboursements: Number(remboursements) || 0,
          ventes: Number(ventes) || 0,
          venteCarnet: Number(venteCarnet) || 0,
          fraisLivraison: Number(fraisLivraison) || 0,
          montantVirement: Number(montantVirement) || 0,
          virementReference: virementReference || undefined,
          lignesBilletage: DENOMINATIONS.filter((d) => Number(billetage[d]) > 0).map((d) => ({ denomination: d, nombre: Number(billetage[d]) })),
          motifEcartSoumission: motifEcart || undefined,
          carnetsAnnexes: papier.carnets,
          fichesPagesDe: papier.fichesDe, fichesPagesA: papier.fichesA, recusNumDe: papier.recusDe, recusNumA: papier.recusA,
          declarationAcceptee: declaration,
          signatureCollecteur: signature,
          notes: notes || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { toast.success("Bordereau soumis"); onCreated(j.data.id); }
      else toast.error(j.error ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Nouveau bordereau de remise de fonds</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* ── En-tête ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Date du bordereau *</label>
              <input type="date" value={dateRemise} onChange={(e) => setDateRemise(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Agence / point de dépôt *</label>
              <select value={pdvId} onChange={(e) => setPdvChoisi(e.target.value)} className={inputCls}>
                {pdvs.length === 0 && <option value="">Aucune affectation</option>}
                {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
              </select>
            </div>
          </div>
          <div>
            <p className={titreCls}>Compte à créditer <span className="normal-case font-normal">(facultatif)</span></p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Titulaire" value={compte.titulaire} onChange={(e) => setCompte({ ...compte, titulaire: e.target.value })} className={inputCls} />
              <input placeholder="N° de compte" value={compte.numero} onChange={(e) => setCompte({ ...compte, numero: e.target.value })} className={inputCls} />
              <input placeholder="Banque" value={compte.banque} onChange={(e) => setCompte({ ...compte, banque: e.target.value })} className={inputCls} />
              <input placeholder="Guichet / Branche" value={compte.guichet} onChange={(e) => setCompte({ ...compte, guichet: e.target.value })} className={inputCls} />
            </div>
          </div>

          {/* ── I — Identification ── */}
          <div>
            <p className={titreCls}>I — Identification du déposant / collecteur</p>
            <p className="text-xs text-slate-400 mb-2">Pré-rempli avec votre identité — modifiez-la si vous saisissez pour le compte d&apos;une autre personne.</p>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Nom *" value={deposant.nom} onChange={(e) => setDeposant({ ...deposant, nom: e.target.value })} className={inputCls} />
              <input placeholder="Prénom *" value={deposant.prenom} onChange={(e) => setDeposant({ ...deposant, prenom: e.target.value })} className={inputCls} />
              <input placeholder="Zone / Secteur" value={deposant.zone} onChange={(e) => setDeposant({ ...deposant, zone: e.target.value })} className={inputCls} />
              <input placeholder="Téléphone" value={deposant.telephone} onChange={(e) => setDeposant({ ...deposant, telephone: e.target.value })} className={inputCls} />
              <input placeholder="Adresse" value={deposant.adresse} onChange={(e) => setDeposant({ ...deposant, adresse: e.target.value })} className={inputCls + " col-span-2"} />
            </div>
          </div>

          {/* ── II — Récapitulatif ── */}
          <div>
            <p className={titreCls}>II — Récapitulatif des fonds remis</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-500">Cotisations espèces</label><input type="number" min="0" value={cotisationsEspeces} onChange={(e) => setCotisationsEspeces(e.target.value)} className={inputCls} /></div>
              <div>
                <label className="text-xs text-slate-500">Cotisations mobile money</label>
                <input type="number" min="0" value={cotisationsMobileMoney} onChange={(e) => setCotisationsMobileMoney(e.target.value)} className={inputCls} />
                {Number(cotisationsMobileMoney) > 0 && (
                  <>
                    <input placeholder="Opérateur (T-Money, Flooz…)" value={mobileMoneyOperateur} onChange={(e) => setMobileMoneyOperateur(e.target.value)} className={inputCls + " mt-1"} />
                    <input placeholder="N° transaction" value={mobileMoneyReference} onChange={(e) => setMobileMoneyReference(e.target.value)} className={inputCls + " mt-1"} />
                    <PiecesUploader nature="RECU" label="Justificatif Mobile Money" pieces={pieces} onChange={setPieces} />
                  </>
                )}
              </div>
              <div><label className="text-xs text-slate-500">Remboursements</label><input type="number" min="0" value={remboursements} onChange={(e) => setRemboursements(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Ventes</label><input type="number" min="0" value={ventes} onChange={(e) => setVentes(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Vente de carnet</label><input type="number" min="0" value={venteCarnet} onChange={(e) => setVenteCarnet(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-slate-500">Frais de livraison</label><input type="number" min="0" value={fraisLivraison} onChange={(e) => setFraisLivraison(e.target.value)} className={inputCls} /></div>
              <div>
                <label className="text-xs text-slate-500">Virement / dépôt direct (hors billetage)</label>
                <input type="number" min="0" value={montantVirement} onChange={(e) => setMontantVirement(e.target.value)} className={inputCls} />
                {Number(montantVirement) > 0 && (
                  <>
                    <input placeholder="Référence virement" value={virementReference} onChange={(e) => setVirementReference(e.target.value)} className={inputCls + " mt-1"} />
                    <PiecesUploader nature="RELEVE_BANCAIRE" label="Avis de virement" obligatoire pieces={pieces} onChange={setPieces} />
                  </>
                )}
              </div>
            </div>
            <p className="text-right text-sm font-bold text-slate-800 mt-2">Total espèces attendu : {totalEspecesAttendu.toLocaleString("fr-FR")} FCFA</p>
          </div>

          {/* ── III — Billetage ── */}
          <div>
            <p className={titreCls}>III — Billetage</p>
            <div className="grid grid-cols-2 gap-2">
              {DENOMINATIONS.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-slate-500 flex-shrink-0">{d.toLocaleString("fr-FR")}</span>
                  <input type="number" min="0" placeholder="0" value={billetage[d] ?? ""} onChange={(e) => setBilletage((prev) => ({ ...prev, [d]: e.target.value }))} className={inputCls} />
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-bold text-slate-800 mt-2">Total billetage : {totalBilletage.toLocaleString("fr-FR")} FCFA</p>
            {Math.abs(ecart) > 0.01 && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Écart de {ecart.toLocaleString("fr-FR")} FCFA</p>
                <input placeholder="Motif de l'écart (obligatoire)" value={motifEcart} onChange={(e) => setMotifEcart(e.target.value)} className={inputCls + " mt-1"} />
              </div>
            )}
          </div>

          {/* ── V — Pièces jointes ── */}
          <div>
            <p className={titreCls}>V — Pièces jointes</p>
            <div className="space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={papier.carnets} onChange={(e) => setPapier({ ...papier, carnets: e.target.checked })} />
                Carnets individuels en annexe (listés)
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-[180px]">Fiches journalières de collecte — n° pages</span>
                <input placeholder="de" value={papier.fichesDe} onChange={(e) => setPapier({ ...papier, fichesDe: e.target.value })} className={inputCls + " !w-20"} />
                <span>à</span>
                <input placeholder="à" value={papier.fichesA} onChange={(e) => setPapier({ ...papier, fichesA: e.target.value })} className={inputCls + " !w-20"} />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex-1 min-w-[180px]">Copies des reçus numérotés — n°</span>
                <input placeholder="de" value={papier.recusDe} onChange={(e) => setPapier({ ...papier, recusDe: e.target.value })} className={inputCls + " !w-20"} />
                <span>à</span>
                <input placeholder="à" value={papier.recusA} onChange={(e) => setPapier({ ...papier, recusA: e.target.value })} className={inputCls + " !w-20"} />
              </div>
              <PiecesUploader nature="PIECE_CAISSE" label="Fiches journalières de collecte scannées" pieces={pieces} onChange={setPieces} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
          </div>

          {/* ── VI — Déclaration & signature ── */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <p className={titreCls + " !mb-0"}>VI — Déclaration &amp; signature du collecteur</p>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-1" />
              <span>
                Je soussigné(e) <b>{nomDeposant}</b> déclare avoir remis à AfriSime, ce jour, les fonds et documents mentionnés
                ci-dessus. J&apos;atteste de l&apos;exactitude des montants et du billetage indiqué.
              </span>
            </label>
            <SignaturePad label="Signature du collecteur *" onChange={setSignature} />
            <p className="text-xs text-slate-400">
              La soumission vaut signature électronique (nom, date et heure enregistrés). Le trésorier puis, au-delà du seuil,
              le Président signent à leur tour lors de leur validation.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Annuler</button>
          <button onClick={handleSubmit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">
            <Send className="w-4 h-4" /> Soumettre
          </button>
        </div>
      </div>
    </div>
  );
}
