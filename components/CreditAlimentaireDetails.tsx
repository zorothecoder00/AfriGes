'use client'

import { useState } from 'react';
import { X, User, Calendar, CheckCircle, AlertTriangle, XCircle, Phone, ShoppingCart, ArrowDownLeft, RefreshCw, Wallet, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format';

interface ClientInfo {
  id: number;
  prenom: string;
  nom: string;
  telephone: string;
}

interface Produit {
  id: number;
  nom: string;
  description?: string;
}

interface CreditAlimentaireTransaction {
  id: number;
  type: string;
  montant: number;
  description?: string;
  createdAt: string;
}

interface VenteCreditAlimentaire {
  id: number;
  quantite: number;
  prixUnitaire: number;
  createdAt: string;
}

interface CreditAlimentaireWithRelations {
  id: number;
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  statut: string;
  source: string;
  sourceId: number;
  dateAttribution: string;
  dateExpiration?: string | null;
  client: ClientInfo | null;
  transactions: CreditAlimentaireTransaction[];
  ventes: (VenteCreditAlimentaire & { produit: Produit })[];
}

interface CreditAlimentaireDetailsProps {
  credit?: CreditAlimentaireWithRelations;
  onClose: () => void;
  onEdit?: () => void;
}

const statutConfig: Record<string, { label: string; Icon: React.ElementType; badge: string; dot: string }> = {
  ACTIF:  { label: 'Actif',   Icon: CheckCircle,  badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  EPUISE: { label: 'Épuisé',  Icon: AlertTriangle, badge: 'bg-orange-100  text-orange-700  border border-orange-200',  dot: 'bg-orange-400'  },
  EXPIRE: { label: 'Expiré',  Icon: XCircle,       badge: 'bg-slate-100   text-slate-600   border border-slate-200',   dot: 'bg-slate-400'   },
};

const txConfig: Record<string, { label: string; Icon: React.ElementType; iconBg: string; iconColor: string; amountColor: string; sign: string }> = {
  UTILISATION: { label: 'Utilisation', Icon: ArrowDownLeft, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', amountColor: 'text-orange-600', sign: '-' },
  ANNULATION:  { label: 'Annulation',  Icon: RefreshCw,     iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', amountColor: 'text-emerald-600', sign: '+' },
  AJUSTEMENT:  { label: 'Ajustement',  Icon: RefreshCw,     iconBg: 'bg-blue-100',    iconColor: 'text-blue-600',    amountColor: 'text-blue-600',    sign: '±' },
};

export default function CreditAlimentaireDetails({ credit, onClose, onEdit }: CreditAlimentaireDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'transactions' | 'ventes'>('info');

  if (!credit) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const usagePct = credit.plafond > 0 ? Math.min(100, Math.round((credit.montantUtilise / credit.plafond) * 100)) : 0;
  const sc = statutConfig[credit.statut] ?? statutConfig.EXPIRE;
  const { Icon: StatutIcon } = sc;

  const TABS = [
    { key: 'info' as const,         label: 'Informations' },
    { key: 'transactions' as const,  label: `Transactions (${credit.transactions.length})` },
    { key: 'ventes' as const,        label: `Achats (${credit.ventes.length})` },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 rounded-t-2xl flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Wallet size={19} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Crédit alimentaire #{credit.id}</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {credit.client ? `${credit.client.prenom} ${credit.client.nom}` : 'Bénéficiaire inconnu'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                Modifier
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
          <div className="grid grid-cols-4 gap-3">
            {/* Plafond */}
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet size={13} className="text-blue-500" />
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Plafond</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatCurrency(credit.plafond)}</p>
            </div>
            {/* Utilisé */}
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown size={13} className="text-orange-500" />
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Utilisé</span>
              </div>
              <p className="text-base font-bold text-orange-600">{formatCurrency(credit.montantUtilise)}</p>
            </div>
            {/* Disponible */}
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={13} className="text-emerald-500" />
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Disponible</span>
              </div>
              <p className="text-base font-bold text-emerald-600">{formatCurrency(credit.montantRestant)}</p>
            </div>
            {/* Progression */}
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Usage</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.badge}`}>
                  <StatutIcon size={9} />
                  {sc.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700">{usagePct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3.5 px-1 mr-6 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto flex-1 px-6 py-5">

          {/* ── Informations ── */}
          {activeTab === 'info' && (
            <div className="space-y-5">
              {/* Client */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <User size={11} /> Bénéficiaire
                </p>
                {credit.client ? (
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
                      {credit.client.prenom?.[0]}{credit.client.nom?.[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{credit.client.prenom} {credit.client.nom}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {credit.client.telephone}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Bénéficiaire introuvable</p>
                )}
              </div>

              {/* Source + Dates */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Calendar size={11} /> Informations
                </p>
                <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <span className="text-sm text-slate-500">Source</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {credit.source === 'COTISATION' ? 'Cotisation' : 'Tontine'} #{credit.sourceId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <span className="text-sm text-slate-500">Date d&apos;attribution</span>
                    <span className="text-sm font-semibold text-slate-800">{formatDate(credit.dateAttribution)}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3 bg-white">
                    <span className="text-sm text-slate-500">Date d&apos;expiration</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {credit.dateExpiration ? formatDate(credit.dateExpiration) : <span className="text-slate-400 italic">Non définie</span>}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Transactions ── */}
          {activeTab === 'transactions' && (
            <div className="space-y-2">
              {credit.transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <RefreshCw size={24} />
                  </div>
                  <p className="text-sm font-medium">Aucune transaction</p>
                </div>
              ) : (
                credit.transactions.map(tx => {
                  const cfg = txConfig[tx.type] ?? txConfig.AJUSTEMENT;
                  const { Icon: TxIcon } = cfg;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-3 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                          <TxIcon size={16} className={cfg.iconColor} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{cfg.label}</p>
                          {tx.description && <p className="text-xs text-slate-500">{tx.description}</p>}
                          <p className="text-xs text-slate-400">{formatDateTime(tx.createdAt)}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${cfg.amountColor}`}>
                        {cfg.sign}{formatCurrency(tx.montant)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Ventes ── */}
          {activeTab === 'ventes' && (
            <div>
              {credit.ventes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <ShoppingCart size={24} />
                  </div>
                  <p className="text-sm font-medium">Aucun achat enregistré</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Produit', 'Qté', 'Prix unitaire', 'Total', 'Date'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {credit.ventes.map(vente => (
                        <tr key={vente.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-slate-800">{vente.produit.nom}</p>
                            {vente.produit.description && (
                              <p className="text-xs text-slate-400">{vente.produit.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-700">{vente.quantite}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(vente.prixUnitaire)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-slate-800">
                            {formatCurrency(Number(vente.prixUnitaire) * vente.quantite)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatDate(vente.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
