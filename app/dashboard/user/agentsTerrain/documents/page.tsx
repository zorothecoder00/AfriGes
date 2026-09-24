"use client";

import Link from "next/link";
import { ArrowLeft, FileText, ShoppingCart, Banknote, Wallet, PackageCheck, Plus, List, Printer, QrCode } from "lucide-react";
import { useApi } from "@/hooks/useApi";

/**
 * Documents commerciaux de l'agent terrain : tous les documents qu'il crée, remplit et soumet, au même
 * endroit. Chaque type a son QR « Modèle » (statique, sans donnée) : scanné, il ouvre directement le
 * formulaire vierge, après connexion (CDC digitalisation §4). Le QR « menu » ouvre cette page.
 */

interface QrModele { code: string; libelle: string; url: string; qr: string }

interface Doc {
  code: string; titre: string; description: string;
  nouveau: string; liste: string; icon: React.ReactNode;
}

const DOCS: Doc[] = [
  { code: "BCC", titre: "Bon de commande client", description: "Prise de commande terrain, signature du client, suivi jusqu'à la livraison (validation, bon de sortie, facture).", nouveau: "/dashboard/user/agentsTerrain/commandes-client?nouveau=1", liste: "/dashboard/user/agentsTerrain/commandes-client", icon: <ShoppingCart className="w-5 h-5" /> },
  { code: "DEV", titre: "Devis", description: "Offre de prix à un client, valable jusqu'à une date, convertible en proforma.", nouveau: "/dashboard/user/agentsTerrain/devis-proforma?nouveau=DEVIS", liste: "/dashboard/user/agentsTerrain/devis-proforma", icon: <FileText className="w-5 h-5" /> },
  { code: "PRO", titre: "Facture proforma", description: "Facture préalable à la commande, à faire valider par le client.", nouveau: "/dashboard/user/agentsTerrain/devis-proforma?nouveau=PROFORMA", liste: "/dashboard/user/agentsTerrain/devis-proforma", icon: <FileText className="w-5 h-5" /> },
  { code: "BRF", titre: "Bordereau de remise de fonds", description: "Remise des fonds collectés (espèces, mobile money, virement) avec billetage et pièces jointes.", nouveau: "/dashboard/user/agentsTerrain/bordereaux-remise?nouveau=1", liste: "/dashboard/user/agentsTerrain/bordereaux-remise", icon: <Banknote className="w-5 h-5" /> },
  { code: "FD", titre: "Fiche de décaissement", description: "Demande de sortie de fonds (achat, avance, frais) soumise aux approbations avant paiement.", nouveau: "/dashboard/user/decaissements?nouveau=1", liste: "/dashboard/user/decaissements", icon: <Wallet className="w-5 h-5" /> },
];

export default function DocumentsCommerciauxPage() {
  const { data } = useApi<{ data: QrModele[] }>("/api/agentTerrain/qr-modeles");
  const qrParCode = new Map((data?.data ?? []).map((m) => [m.code, m]));
  const menu = qrParCode.get("DOC");

  return (
    <div className="min-h-screen bg-[#dbe7f5]">
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="no-print flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/dashboard/user/agentsTerrain" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1"><ArrowLeft className="w-3 h-3" /> Retour</Link>
            <h1 className="text-2xl font-bold text-slate-900">Documents commerciaux</h1>
            <p className="text-sm text-slate-500 mt-0.5">Créez, remplissez et soumettez tous vos documents depuis un seul endroit — ou scannez le QR du document pour y accéder directement.</p>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Printer className="w-4 h-4" /> Imprimer les QR
          </button>
        </div>

        {menu && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={menu.qr} alt={menu.libelle} className="w-24 h-24 bg-white rounded-lg p-1 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900 flex items-center gap-1.5"><QrCode className="w-4 h-4" /> QR du menu Documents commerciaux</p>
              <p className="text-sm text-emerald-800 mt-0.5">Scanné, il ouvre cette page après connexion : vous choisissez ensuite le document à remplir.</p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {DOCS.map((d) => {
            const qr = qrParCode.get(d.code);
            return (
              <div key={d.code} className="bg-white border border-slate-200 rounded-2xl p-5 flex gap-4 break-inside-avoid">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-slate-800">
                    <span className="text-emerald-600">{d.icon}</span>
                    <h2 className="font-semibold">{d.titre}</h2>
                  </div>
                  <p className="text-sm text-slate-500 mt-1.5">{d.description}</p>
                  <div className="no-print flex items-center gap-2 mt-3 flex-wrap">
                    <Link href={d.nouveau} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"><Plus className="w-4 h-4" /> Nouveau</Link>
                    <Link href={d.liste} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"><List className="w-4 h-4" /> Mes documents</Link>
                  </div>
                </div>
                {qr && (
                  <div className="shrink-0 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qr.qr} alt={`QR ${d.titre}`} className="w-28 h-28" />
                    <p className="text-[10px] text-slate-400 mt-0.5">Scanner pour remplir</p>
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2 no-print">
            <div className="flex items-center gap-2 text-slate-800">
              <span className="text-emerald-600"><Banknote className="w-5 h-5" /></span>
              <h2 className="font-semibold">Mes fonds collectés</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1.5">Consultez ce que vous avez collecté sur une période (3 mois maximum), ce que vous avez déjà remis par bordereau et ce qui reste à remettre.</p>
            <Link href="/dashboard/user/agentsTerrain/fonds-collectes" className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"><List className="w-4 h-4" /> Voir mes fonds collectés</Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:col-span-2 no-print">
            <div className="flex items-center gap-2 text-slate-800">
              <span className="text-emerald-600"><PackageCheck className="w-5 h-5" /></span>
              <h2 className="font-semibold">Bon de réception client</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1.5">Généré automatiquement à l&apos;expédition d&apos;une commande. Le client l&apos;atteste avec son propre lien — suivez l&apos;état de vos réceptions depuis vos commandes.</p>
            <Link href="/dashboard/user/agentsTerrain/commandes-client" className="inline-flex items-center gap-1.5 mt-3 px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium"><List className="w-4 h-4" /> Voir mes commandes</Link>
          </div>
        </div>

        <p className="no-print text-xs text-slate-400">Ces QR ne contiennent aucune donnée : ils ne fonctionnent qu&apos;après connexion à votre compte AfriGes.</p>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
