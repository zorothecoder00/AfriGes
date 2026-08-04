"use client";

// Fiche fournisseur comptable (CDC Comptabilité §17 — "même logique" que la
// fiche client, §16) : identité, solde, grand livre auxiliaire (compte
// 401xxx, solde progressif = montant dû), avoirs, avances. Complète
// /dashboard/user/comptables/auxiliaire (recherche + balance âgée + lettrage).
// Les litiges fournisseurs sont déjà couverts ailleurs (module Logistique/
// Approvisionnement, LitigeFournisseur) — non dupliqués ici.

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Phone, MapPin, Wallet, Printer, PlusCircle, Scale } from "lucide-react";
import { useApi, useMutation } from "@/hooks/useApi";
import { formatCurrency, formatDateShort } from "@/lib/format";

interface FournisseurInfo { id: number; nom: string; code: string | null; telephone: string | null; adresse: string | null }
interface LigneGrandLivre { id: number; date: string; reference: string; journal: string; libelle: string; debit: number; credit: number; lettrage: string | null; solde: number }
interface GrandLivreResponse { data: { compte: { numero: string; libelle: string } | null; soldeOuverture: number; lignes: LigneGrandLivre[]; soldeFinal: number } }
interface AvoirEntry { id: number; reference: string; montant: number; motif: string; dateEmission: string }
interface AvanceEntry { id: number; reference: string; montant: number; montantImpute: number; statut: string; dateVersement: string }

export default function FicheFournisseurComptablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fournisseurId = Number(id);

  const { data: fournisseurData } = useApi<{ data: FournisseurInfo }>(`/api/comptable/fournisseurs/${fournisseurId}`);
  const fournisseur = fournisseurData?.data;

  const { data: grandLivreData, loading: grandLivreLoading } = useApi<GrandLivreResponse>(`/api/comptable/fournisseurs/${fournisseurId}/grand-livre`);
  const { data: avoirsData, refetch: refetchAvoirs } = useApi<{ data: AvoirEntry[] }>(`/api/comptable/fournisseurs/${fournisseurId}/avoirs`);
  const { data: avancesData, refetch: refetchAvances } = useApi<{ data: AvanceEntry[] }>(`/api/comptable/fournisseurs/${fournisseurId}/avances`);

  const [showAvoirForm, setShowAvoirForm] = useState(false);
  const [avoirMontant, setAvoirMontant] = useState("");
  const [avoirMotif, setAvoirMotif] = useState("");
  const { mutate: creerAvoir, loading: creatingAvoir } = useMutation<unknown, object>(
    `/api/comptable/fournisseurs/${fournisseurId}/avoirs`, "POST", { successMessage: "Avoir enregistré" }
  );
  async function handleCreerAvoir() {
    const res = await creerAvoir({ montant: Number(avoirMontant), motif: avoirMotif });
    if (res) { refetchAvoirs(); setShowAvoirForm(false); setAvoirMontant(""); setAvoirMotif(""); }
  }

  const [showAvanceForm, setShowAvanceForm] = useState(false);
  const [avanceMontant, setAvanceMontant] = useState("");
  const [avanceMode, setAvanceMode] = useState("ESPECES");
  const { mutate: creerAvance, loading: creatingAvance } = useMutation<unknown, object>(
    `/api/comptable/fournisseurs/${fournisseurId}/avances`, "POST", { successMessage: "Avance versée" }
  );
  async function handleCreerAvance() {
    const res = await creerAvance({ montant: Number(avanceMontant), modePaiement: avanceMode });
    if (res) { refetchAvances(); setShowAvanceForm(false); setAvanceMontant(""); }
  }

  const gl = grandLivreData?.data;

  return (
    <main className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/user/comptables/auxiliaire" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="text-violet-600" size={22} />
            {fournisseur?.nom ?? "Fiche fournisseur comptable"}
          </h1>
        </div>
        <a href={`/dashboard/user/comptables/auxiliaire/fournisseurs/${fournisseurId}/releve`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          <Printer size={15} /> Relevé imprimable
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 mb-1">Code fournisseur</p>
          <p className="font-bold text-slate-800">{fournisseur?.code ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Phone size={13} />Téléphone</p>
          <p className="font-bold text-slate-800">{fournisseur?.telephone ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><MapPin size={13} />Adresse</p>
          <p className="font-bold text-slate-800 truncate">{fournisseur?.adresse ?? "—"}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/60">
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1"><Wallet size={13} />Solde dû ({gl?.compte?.numero ?? "—"})</p>
          <p className="font-bold text-slate-800">{formatCurrency(gl?.soldeFinal ?? 0)}</p>
        </div>
      </div>

      {/* Grand livre auxiliaire */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Scale size={16} className="text-violet-600" />
          <h3 className="font-bold text-slate-800 text-sm">Grand livre auxiliaire — factures &amp; paiements</h3>
        </div>
        {grandLivreLoading ? (
          <div className="flex items-center justify-center p-8"><div className="w-7 h-7 border-3 border-violet-200 border-t-violet-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold text-slate-500">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Référence</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500">Libellé</th>
                  <th className="text-right px-3 py-2 font-semibold text-blue-600">Débit</th>
                  <th className="text-right px-3 py-2 font-semibold text-emerald-600">Crédit</th>
                  <th className="text-right px-5 py-2 font-semibold text-slate-500">Solde dû</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(gl?.lignes ?? []).map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-5 py-1.5 text-slate-500">{formatDateShort(l.date)}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-500">{l.reference}</td>
                    <td className="px-3 py-1.5 text-slate-700">{l.libelle}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700">{l.debit > 0 ? formatCurrency(l.debit) : ""}</td>
                    <td className="px-3 py-1.5 text-right text-emerald-700">{l.credit > 0 ? formatCurrency(l.credit) : ""}</td>
                    <td className="px-5 py-1.5 text-right font-bold text-slate-800">{formatCurrency(l.solde)}</td>
                  </tr>
                ))}
                {(gl?.lignes ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">Aucun mouvement.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Avoirs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Avoirs reçus</h3>
          <button onClick={() => setShowAvoirForm(!showAvoirForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700">
            <PlusCircle size={13} /> Enregistrer un avoir
          </button>
        </div>
        {showAvoirForm && (
          <div className="p-4 bg-violet-50/50 border-b border-violet-100 flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant</label>
              <input type="number" value={avoirMontant} onChange={(e) => setAvoirMontant(e.target.value)}
                className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Motif</label>
              <input value={avoirMotif} onChange={(e) => setAvoirMotif(e.target.value)}
                placeholder="ex: Marchandise retournée"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <button onClick={handleCreerAvoir} disabled={creatingAvoir || !avoirMontant || !avoirMotif}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              Enregistrer
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            {(avoirsData?.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-2 font-mono text-xs text-violet-700">{a.reference}</td>
                <td className="px-3 py-2 text-slate-600">{a.motif}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDateShort(a.dateEmission)}</td>
                <td className="px-5 py-2 text-right font-bold text-slate-800">{formatCurrency(a.montant)}</td>
              </tr>
            ))}
            {(avoirsData?.data ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400 text-sm">Aucun avoir enregistré.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Avances */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">Avances / acomptes versés</h3>
          <button onClick={() => setShowAvanceForm(!showAvanceForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700">
            <PlusCircle size={13} /> Verser une avance
          </button>
        </div>
        {showAvanceForm && (
          <div className="p-4 bg-violet-50/50 border-b border-violet-100 flex gap-3 flex-wrap items-end">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Montant</label>
              <input type="number" value={avanceMontant} onChange={(e) => setAvanceMontant(e.target.value)}
                className="w-40 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Mode de paiement</label>
              <select value={avanceMode} onChange={(e) => setAvanceMode(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="ESPECES">Espèces</option>
                <option value="VIREMENT">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
              </select>
            </div>
            <button onClick={handleCreerAvance} disabled={creatingAvance || !avanceMontant}
              className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
              Verser
            </button>
          </div>
        )}
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-50">
            {(avancesData?.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="px-5 py-2 font-mono text-xs text-violet-700">{a.reference}</td>
                <td className="px-3 py-2 text-xs text-slate-400">{formatDateShort(a.dateVersement)}</td>
                <td className="px-3 py-2 text-slate-600">{a.statut === "VERSEE" ? "Versée" : a.statut === "IMPUTEE" ? "Imputée" : "Remboursée"}</td>
                <td className="px-3 py-2 text-right text-slate-500 text-xs">{a.montantImpute > 0 ? `imputé ${formatCurrency(a.montantImpute)}` : ""}</td>
                <td className="px-5 py-2 text-right font-bold text-slate-800">{formatCurrency(a.montant)}</td>
              </tr>
            ))}
            {(avancesData?.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400 text-sm">Aucune avance versée.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
