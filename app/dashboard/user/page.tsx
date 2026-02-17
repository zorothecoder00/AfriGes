"use client";

import { useState } from 'react';
import {
  Wallet, CreditCard as CreditCardIcon, LucideIcon, Users, TrendingUp,
  ShoppingBag, Calendar, ArrowUpRight, ArrowDownRight, Eye, Download,
  ChevronRight, Clock, CheckCircle, AlertCircle, Menu, X, Receipt, History
} from 'lucide-react';
import Link from "next/link";
import SignOutButton from '@/components/SignOutButton';
import { useApi, useMutation } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/format';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardResponse {
  success: boolean;
  data: {
    soldeGeneral: number | string;
    soldeTontine: number | string;
    soldeCredit: number | string;
    tontinesActives: number;
  };
}

interface Credit {
  id: number;
  montant: string;
  montantRestant: string;
  dateDemande: string;
  statut: string;
  scoreRisque: string | null;
}

interface CreditsResponse {
  data: Credit[];
  stats: { totalEmprunte: number; totalRestant: number; creditsActifs: number };
}

interface Tontine {
  id: number;
  nom: string;
  description: string | null;
  montantCycle: string;
  frequence: string;
  statut: string;
  dateDebut: string;
}

interface TontinesResponse {
  data: Tontine[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface WalletTransaction {
  id: number;
  type: string;
  montant: string;
  description: string | null;
  reference: string;
  createdAt: string;
}

interface TransactionsResponse {
  data: WalletTransaction[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreditAlimentaire {
  id: number;
  plafond: string;
  montantUtilise: string;
  montantRestant: string;
  dateExpiration: string | null;
}

interface CreditAlimResponse {
  data: CreditAlimentaire[];
}

type TransactionType = 'DEPOT' | 'RETRAIT' | 'COTISATION' | 'TONTINE' | 'CREDIT' | 'REMBOURSEMENT_CREDIT' | 'ACHAT';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, bgColor }: {
  title: string; value: string; icon: LucideIcon; trend?: 'up' | 'down'; trendValue?: string; color: string; bgColor: string;
}) => (
  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6">
    <div className="flex items-start justify-between mb-4">
      <div className={`${bgColor} rounded-lg p-3`}>
        <Icon className={`${color} w-6 h-6`} />
      </div>
      {trend && (
        <span className={`flex items-center text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
          {trendValue}
        </span>
      )}
    </div>
    <p className="text-gray-600 text-sm mb-1">{title}</p>
    <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
  </div>
);

const TransactionItem = ({ type, description, amount, date, reference }: {
  type: TransactionType; description: string; amount: number; date: string; reference: string;
}) => {
  const configs: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
    DEPOT: { icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
    RETRAIT: { icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
    COTISATION: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    TONTINE: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    CREDIT: { icon: CreditCardIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
    REMBOURSEMENT_CREDIT: { icon: CreditCardIcon, color: 'text-teal-600', bg: 'bg-teal-50' },
    ACHAT: { icon: ShoppingBag, color: 'text-pink-600', bg: 'bg-pink-50' },
  };
  const { icon: TxIcon, color, bg } = configs[type] || { icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50' };
  const isPositive = ['DEPOT', 'CREDIT'].includes(type);

  return (
    <div className="flex items-center py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150 px-4 -mx-4 rounded-lg">
      <div className={`${bg} rounded-lg p-2.5 mr-4 flex-shrink-0`}>
        <TxIcon className={`${color} w-5 h-5`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{description}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {reference} &bull; {new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className={`text-right font-bold text-sm flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : '-'}{formatCurrency(amount)}
      </div>
    </div>
  );
};

const TontineCard = ({ tontine }: { tontine: Tontine }) => {
  const statutConfig: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: 'bg-green-100 text-green-800', label: 'Actif' },
    TERMINEE: { color: 'bg-gray-100 text-gray-800', label: 'Termine' },
    SUSPENDUE: { color: 'bg-yellow-100 text-yellow-800', label: 'Suspendu' },
  };
  const config = statutConfig[tontine.statut] || { color: 'bg-gray-100 text-gray-800', label: tontine.statut };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{tontine.nom}</h3>
          {tontine.description && <p className="text-sm text-gray-500 line-clamp-2">{tontine.description}</p>}
        </div>
        <span className={`${config.color} text-xs font-semibold px-3 py-1 rounded-full ml-2 flex-shrink-0`}>
          {config.label}
        </span>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant du cycle</span>
          <span className="font-bold text-gray-900">{formatCurrency(tontine.montantCycle)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Frequence</span>
          <span className="font-semibold text-gray-700">{tontine.frequence === 'MENSUEL' ? 'Mensuel' : 'Hebdomadaire'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Date de debut</span>
          <span className="font-semibold text-gray-700">{new Date(tontine.dateDebut).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
      <Link href={`/dashboard/user/tontines/${tontine.id}`} className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center">
        <Eye className="w-4 h-4 mr-2" />
        Voir les details
      </Link>
    </div>
  );
};

const CreditCardItem = ({ credit }: { credit: Credit }) => {
  const montant = Number(credit.montant);
  const montantRestant = Number(credit.montantRestant);
  const pourcentageRembourse = montant > 0 ? Math.round(((montant - montantRestant) / montant) * 100) : 0;

  const statutConfig: Record<string, { color: string; icon: LucideIcon; label: string }> = {
    EN_ATTENTE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'En attente' },
    APPROUVE: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approuve' },
    REJETE: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Rejete' },
    REMBOURSE_PARTIEL: { color: 'bg-blue-100 text-blue-800', icon: TrendingUp, label: 'En cours' },
    REMBOURSE_TOTAL: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Rembourse' },
  };
  const config = statutConfig[credit.statut] || { color: 'bg-gray-100 text-gray-800', icon: AlertCircle, label: credit.statut };
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Credit</h3>
          <p className="text-xs text-gray-500 mt-1">Demande le {new Date(credit.dateDemande).toLocaleDateString('fr-FR')}</p>
        </div>
        <span className={`${config.color} text-xs font-semibold px-3 py-1 rounded-full flex items-center`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {config.label}
        </span>
      </div>
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant initial</span>
          <span className="font-bold text-gray-900">{formatCurrency(montant)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Reste a payer</span>
          <span className="font-bold text-red-600">{formatCurrency(montantRestant)}</span>
        </div>
        {credit.statut !== 'REJETE' && credit.statut !== 'EN_ATTENTE' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600">Progression</span>
              <span className="text-xs font-bold text-gray-900">{pourcentageRembourse}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${pourcentageRembourse}%` }} />
            </div>
          </div>
        )}
      </div>
      {credit.statut !== 'REJETE' && credit.statut !== 'REMBOURSE_TOTAL' && (
        <button className="w-full bg-green-50 hover:bg-green-100 text-green-600 font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center">
          <CreditCardIcon className="w-4 h-4 mr-2" />
          Rembourser
        </button>
      )}
    </div>
  );
};

const CreditAlimentaireCard = ({ credit }: { credit: CreditAlimentaire }) => {
  const plafond = Number(credit.plafond);
  const montantUtilise = Number(credit.montantUtilise);
  const montantRestant = Number(credit.montantRestant);
  const pourcentageUtilise = plafond > 0 ? Math.round((montantUtilise / plafond) * 100) : 0;

  return (
    <Link href="/dashboard/user/creditsalimentaires" className="block">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-purple-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2 text-purple-600" />
              Credit Alimentaire
            </h3>
            {credit.dateExpiration && (
              <p className="text-xs text-gray-600 mt-1">Expire le {new Date(credit.dateExpiration).toLocaleDateString('fr-FR')}</p>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Plafond</span>
            <span className="font-bold text-gray-900">{formatCurrency(plafond)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Utilise</span>
            <span className="font-bold text-purple-600">{formatCurrency(montantUtilise)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Disponible</span>
            <span className="font-bold text-green-600">{formatCurrency(montantRestant)}</span>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600">Utilisation</span>
              <span className="text-xs font-bold text-gray-900">{pourcentageUtilise}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2.5">
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pourcentageUtilise}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function UserDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditMontant, setCreditMontant] = useState('');

  const { mutate: requestCredit, loading: requesting, error: requestError } = useMutation('/api/user/credits', 'POST', { successMessage: 'Demande de crédit soumise avec succès' });

  // Fetch all data
  const { data: dashResponse, loading: dashLoading } = useApi<DashboardResponse>('/api/user/dashboard');
  const { data: creditsResponse, refetch: refetchCredits } = useApi<CreditsResponse>('/api/user/credits');
  const { data: tontinesResponse } = useApi<TontinesResponse>('/api/user/tontines');
  const { data: txResponse } = useApi<TransactionsResponse>('/api/user/transactions?limit=5');
  const { data: creditAlimResponse } = useApi<CreditAlimResponse>('/api/user/creditsAlimentaires');

  const dashData = dashResponse?.data;

  const handleCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await requestCredit({ montant: Number(creditMontant) });
    if (result) {
      setCreditModalOpen(false);
      setCreditMontant('');
      refetchCredits();
    }
  };
  const credits = creditsResponse?.data ?? [];
  const tontines = tontinesResponse?.data ?? [];
  const transactions = txResponse?.data ?? [];
  const creditAlimentaire = (creditAlimResponse?.data ?? [])[0] ?? null;

  if (dashLoading && !dashResponse) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AfriGes</h1>
            </div>
            <div className="hidden md:flex items-center space-x-2">
              <Link href="/dashboard/user/credits" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <CreditCardIcon className="w-4 h-4" />
                Credits
              </Link>
              <Link href="/dashboard/user/creditsalimentaires" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <ShoppingBag className="w-4 h-4" />
                Credit Alimentaire
              </Link>
              <Link href="/dashboard/user/transactions" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <History className="w-4 h-4" />
                Transactions
              </Link>
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800 px-2">
                <span role="img" aria-label="notifications">&#x1F514;</span>
              </Link>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold cursor-pointer hover:shadow-lg transition-shadow">U</div>
              <SignOutButton redirectTo="/auth/login?logout=success" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200 space-y-1">
              <Link href="/dashboard/user/credits" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <CreditCardIcon className="w-4 h-4" />
                Mes Credits
              </Link>
              <Link href="/dashboard/user/creditsalimentaires" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <ShoppingBag className="w-4 h-4" />
                Credit Alimentaire
              </Link>
              <Link href="/dashboard/user/transactions" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <History className="w-4 h-4" />
                Transactions
              </Link>
              <Link href="/dashboard/user/tontines" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Users className="w-4 h-4" />
                Tontines
              </Link>
              <Link href="/dashboard/user/notifications" className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <Receipt className="w-4 h-4" />
                Notifications
              </Link>
              <div className="pt-4 border-t border-gray-200">
                <SignOutButton redirectTo="/auth/login?logout=success" className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Modal Demander un credit */}
      {creditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-lg relative">
            <button onClick={() => setCreditModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold">X</button>
            <h2 className="text-xl font-bold mb-4">Demander un credit</h2>
            {requestError && <p className="text-red-500 mb-2 text-sm">{requestError}</p>}
            <form onSubmit={handleCreditSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Montant souhaite (EUR)</label>
                <input
                  type="number" placeholder="Ex: 500" required min="1" step="0.01"
                  value={creditMontant}
                  onChange={e => setCreditMontant(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl text-lg"
                />
              </div>
              <p className="text-sm text-slate-500">Votre demande sera examinee par un administrateur. Vous serez notifie de la decision.</p>
              <button type="submit" disabled={requesting} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl hover:from-emerald-700 hover:to-green-700 transition-all font-semibold">
                {requesting ? "Envoi en cours..." : "Soumettre la demande"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Mon Tableau de Bord</h2>
            <p className="text-gray-600 mt-1">Vue d&apos;ensemble de vos activites AfriGes</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-150 flex items-center justify-center shadow-sm hover:shadow">
            <Download className="w-5 h-5 mr-2" />
            Exporter
          </button>
        </div>

        {/* Stats Cards - Wallet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Solde General" value={formatCurrency(dashData?.soldeGeneral ?? 0)} icon={Wallet} color="text-indigo-600" bgColor="bg-indigo-50" />
          <StatCard title="Solde Tontine" value={formatCurrency(dashData?.soldeTontine ?? 0)} icon={Users} color="text-green-600" bgColor="bg-green-50" />
          <Link href="/dashboard/user/credits">
            <StatCard title="Solde Credit" value={formatCurrency(dashData?.soldeCredit ?? 0)} icon={CreditCardIcon} color="text-orange-600" bgColor="bg-orange-50" />
          </Link>
          <Link href="/dashboard/user/tontines">
            <StatCard title="Mes Tontines" value={String(dashData?.tontinesActives ?? 0)} icon={Users} color="text-purple-600" bgColor="bg-purple-50" />
          </Link>
        </div>

        {/* Credit Alimentaire */}
        {creditAlimentaire && (
          <div className="mb-8">
            <CreditAlimentaireCard credit={creditAlimentaire} />
          </div>
        )}

        {/* Mes Tontines Actives */}
        {tontines.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Mes Tontines Actives</h3>
              <span className="bg-indigo-100 text-indigo-800 text-sm font-semibold px-4 py-2 rounded-full">
                {tontines.length} Tontines
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tontines.slice(0, 3).map(tontine => (
                <TontineCard key={tontine.id} tontine={tontine} />
              ))}
            </div>
          </div>
        )}

        {/* Grid: Credits + Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Credits */}
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <h3 className="text-2xl font-bold text-gray-900">Mes Credits en Cours</h3>
              <button onClick={() => setCreditModalOpen(true)} className="bg-green-50 hover:bg-green-100 text-green-600 font-medium px-4 py-2 rounded-lg transition-colors duration-150 text-sm">
                Demander un credit
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {credits.slice(0, 4).map(credit => (
                <CreditCardItem key={credit.id} credit={credit} />
              ))}
            </div>
            {credits.length === 0 && (
              <p className="text-gray-500 text-center py-8">Aucun credit en cours.</p>
            )}
          </div>

          {/* Transactions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Transactions Recentes</h3>
                <Link href="/dashboard/user/transactions" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center">
                  Voir tout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-1">
                {transactions.map(tx => (
                  <TransactionItem
                    key={tx.id}
                    type={tx.type as TransactionType}
                    description={tx.description || tx.type}
                    amount={Number(tx.montant)}
                    date={tx.createdAt}
                    reference={tx.reference}
                  />
                ))}
                {transactions.length === 0 && (
                  <p className="text-gray-500 text-center py-4">Aucune transaction recente.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
