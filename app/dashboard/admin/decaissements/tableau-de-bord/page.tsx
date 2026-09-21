"use client";

import { useState } from "react";
import { Wallet, Hourglass, XCircle, Stamp, Timer } from "lucide-react";
import RetourLien from "@/components/RetourLien";
import { useApi } from "@/hooks/useApi";
import Card from "@/components/ui/Card";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/format";

/** Tableau de bord Direction/Finance des décaissements (CDC §3.6) : par type, service, agence, période. */

const TYPE_LABEL: Record<string, string> = {
  ACHAT_MARCHANDISES: "Achat marchandises", FOURNITURES: "Fournitures", PAIEMENT_FOURNISSEUR: "Paiement fournisseur",
  AVANCE_CAISSE: "Avance de caisse", FRAIS_FONCTIONNEMENT: "Frais de fonctionnement", TRANSPORT: "Transport", SALAIRE: "Salaire", CARBURANT: "Carburant", AUTRES: "Autres",
};
const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

interface Ligne { libelle: string; montant: number; nombre: number }
interface Dashboard {
  seuilN2: number; nombreFiches: number; nbApprobationsDirection: number;
  totaux: { decaisse: number; enCircuit: number; rejete: number };
  compte: { decaisse: number; enCircuit: number; rejete: number };
  delaiMoyenApprobationH: number | null; delaiMoyenPaiementH: number | null;
  parType: Ligne[]; parService: Ligne[]; parAgence: Ligne[]; topBeneficiaires: Ligne[];
  parMois: { mois: string; montant: number; nombre: number }[];
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inputCls = "px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300";
const duree = (h: number | null) => h == null ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} j`;

function Repartition({ titre, lignes, libelle }: { titre: string; lignes: Ligne[]; libelle?: (l: string) => string }) {
  const max = Math.max(1, ...lignes.map((l) => l.montant));
  const total = lignes.reduce((s, l) => s + l.montant, 0) || 1;
  return (
    <Card>
      <h3 className="font-semibold text-slate-800 text-sm mb-3">{titre}</h3>
      {lignes.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Aucun décaissement sur la période.</p> : (
        <div className="space-y-2.5">
          {lignes.map((l) => (
            <div key={l.libelle}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-slate-700 truncate">{libelle ? libelle(l.libelle) : l.libelle} <span className="text-slate-400">· {l.nombre}</span></span>
                <span className="font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(l.montant)} <span className="text-slate-400 font-normal">({Math.round((l.montant / total) * 100)}%)</span></span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full mt-1"><div className="h-2 bg-primary-500 rounded-full" style={{ width: `${(l.montant / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function TableauBordDecaissementsPage() {
  const now = new Date();
  const [debut, setDebut] = useState(iso(new Date(now.getFullYear(), 0, 1)));
  const [fin, setFin] = useState(iso(now));

  const { data, loading } = useApi<{ data: Dashboard }>(`/api/decaissements/dashboard?dateDebut=${debut}&dateFin=${fin}`);
  const d = data?.data;

  function preset(p: "mois" | "trimestre" | "annee") {
    const n = new Date();
    const m = p === "mois" ? n.getMonth() : p === "trimestre" ? Math.floor(n.getMonth() / 3) * 3 : 0;
    setDebut(iso(new Date(n.getFullYear(), m, 1)));
    setFin(iso(n));
  }

  const maxMois = Math.max(1, ...(d?.parMois ?? []).map((m) => m.montant));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de bord des décaissements</h1>
        <p className="text-sm text-slate-500 mt-1">Vue Direction / Finance : par type de dépense, service, agence et période</p>
      </div>

      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => preset("mois")} className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Ce mois</button>
          <button onClick={() => preset("trimestre")} className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Ce trimestre</button>
          <button onClick={() => preset("annee")} className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Cette année</button>
          <span className="text-xs text-slate-400 ml-2">Du</span>
          <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputCls} />
          <span className="text-xs text-slate-400">au</span>
          <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputCls} />
        </div>
      </Card>

      {loading && !d && <p className="text-sm text-slate-400 text-center py-10">Chargement…</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label={`Décaissé (${d.compte.decaisse} fiche${d.compte.decaisse > 1 ? "s" : ""})`} value={d.totaux.decaisse} format={formatCurrency} icon={<Wallet size={18} />} accent="success" />
            <KpiCard label={`En circuit d'approbation (${d.compte.enCircuit})`} value={d.totaux.enCircuit} format={formatCurrency} icon={<Hourglass size={18} />} accent="warning" />
            <KpiCard label={`Rejeté (${d.compte.rejete})`} value={d.totaux.rejete} format={formatCurrency} icon={<XCircle size={18} />} accent="error" />
            <KpiCard label={`Visés par la Direction (seuil ${formatCurrency(d.seuilN2)})`} value={d.nbApprobationsDirection} icon={<Stamp size={18} />} accent="brand" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card><p className="text-xs text-slate-500 flex items-center gap-1.5"><Timer size={13} /> Délai moyen d&apos;approbation N1</p><p className="text-lg font-bold text-slate-800 mt-1">{duree(d.delaiMoyenApprobationH)}</p></Card>
            <Card><p className="text-xs text-slate-500 flex items-center gap-1.5"><Timer size={13} /> Délai moyen jusqu&apos;au paiement</p><p className="text-lg font-bold text-slate-800 mt-1">{duree(d.delaiMoyenPaiementH)}</p></Card>
          </div>

          <Card>
            <h3 className="font-semibold text-slate-800 text-sm mb-3">Décaissements par mois</h3>
            {d.parMois.length === 0 ? <p className="text-sm text-slate-400 py-4 text-center">Aucun décaissement sur la période.</p> : (
              <div className="flex items-end gap-2 h-40 overflow-x-auto">
                {d.parMois.map((m) => (
                  <div key={m.mois} className="flex flex-col items-center justify-end gap-1 min-w-[48px] h-full" title={`${formatCurrency(m.montant)} · ${m.nombre} fiche(s)`}>
                    <span className="text-[10px] text-slate-500">{formatCurrency(m.montant)}</span>
                    <div className="w-8 bg-primary-500 rounded-t" style={{ height: `${Math.max(4, (m.montant / maxMois) * 100)}px` }} />
                    <span className="text-[10px] text-slate-500">{MOIS[Number(m.mois.slice(5)) - 1]} {m.mois.slice(2, 4)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Repartition titre="Par type de dépense" lignes={d.parType} libelle={(l) => TYPE_LABEL[l] ?? l} />
            <Repartition titre="Par service du demandeur" lignes={d.parService} />
            <Repartition titre="Par agence" lignes={d.parAgence} />
            <Repartition titre="Principaux bénéficiaires" lignes={d.topBeneficiaires} />
          </div>
          <p className="text-[11px] text-slate-400">Montants décaissés : fiches payées, ou approuvées et rattachées à une sortie de caisse déjà effectuée. Période basée sur la date de création de la fiche.</p>
        </>
      )}
    </div>
  );
}
