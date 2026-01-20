'use client';   

import { useState, useEffect } from 'react';  
import { 
  Wallet,    
  CreditCard as CreditCardIcon,     
  LucideIcon,     
  Users,   
  TrendingUp,  
  ShoppingBag,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Download,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import Link from "next/link";
import SignOutButton from '@/components/SignOutButton';

type TrendType = 'up' | 'down';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: TrendType;
  trendValue?: string;
  color: string;
  bgColor: string;
}

type TransactionType =
  | 'DEPOT'
  | 'RETRAIT'
  | 'COTISATION'
  | 'TONTINE'
  | 'CREDIT'
  | 'REMBOURSEMENT_CREDIT'
  | 'ACHAT';

interface TransactionItemProps {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  reference: string;
}

type TontineStatus = 'ACTIVE' | 'TERMINEE' | 'SUSPENDUE';

interface TontineCardProps {
  nom: string;
  description?: string;
  montantCycle: number;
  frequence: string;
  statut: TontineStatus;
  dateDebut: string;
  ordreTirage?: number | null;
}

type CreditStatus =
  | 'EN_ATTENTE'
  | 'APPROUVE'
  | 'REJETE'
  | 'REMBOURSE_PARTIEL'
  | 'REMBOURSE_TOTAL';

interface CreditCardProps {
  montant: number;
  montantRestant: number;
  dateDemande: string;
  statut: CreditStatus;
  scoreRisque: number;
}

interface CreditAlimentaireProps {
  plafond: number;
  montantUtilise: number;
  montantRestant: number;
  dateExpiration?: string;
}

interface Tontine extends TontineCardProps {
  id: number;
}

interface Credit extends CreditCardProps {
  id: number;
}

interface Transaction extends TransactionItemProps {
  id: number;
}

// ============================================================================
// COMPOSANTS RÉUTILISABLES
// ============================================================================

/**
 * Composant Card de statistique pour le wallet
 */
const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color,
  bgColor,
}: StatCardProps) => {
  return (
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
};

/**
 * Composant pour afficher une transaction individuelle
 */
const TransactionItem = ({
  type,
  description,
  amount,
  date,
  reference,
}: TransactionItemProps) => {
  const getTypeConfig = (type: TransactionType) => {
    const configs = {
      DEPOT: { icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
      RETRAIT: { icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
      COTISATION: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
      TONTINE: { icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
      CREDIT: { icon: CreditCardIcon, color: 'text-orange-600', bg: 'bg-orange-50' },
      REMBOURSEMENT_CREDIT: { icon: CreditCardIcon, color: 'text-teal-600', bg: 'bg-teal-50' },
      ACHAT: { icon: ShoppingBag, color: 'text-pink-600', bg: 'bg-pink-50' },
    };
    return configs[type] || { icon: Wallet, color: 'text-gray-600', bg: 'bg-gray-50' };
  };

  const { icon: Icon, color, bg } = getTypeConfig(type);

  return (
    <div className="flex items-center py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors duration-150 px-4 -mx-4 rounded-lg">
      <div className={`${bg} rounded-lg p-2.5 mr-4 flex-shrink-0`}>
        <Icon className={`${color} w-5 h-5`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{description}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {reference} • {new Date(date).toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
      <div className={`text-right font-bold text-sm flex-shrink-0 ${amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {amount >= 0 ? '+' : ''}{amount.toFixed(2)} €
      </div>
    </div>
  );
};

/**
 * Composant pour afficher une carte de tontine
 */
const TontineCard = ({
  nom,
  description,
  montantCycle,
  frequence,
  statut,
  dateDebut,
  ordreTirage,
}: TontineCardProps) => {
  const statutConfig = {
    ACTIVE: { color: 'bg-green-100 text-green-800', label: 'Actif' },
    TERMINEE: { color: 'bg-gray-100 text-gray-800', label: 'Terminé' },
    SUSPENDUE: { color: 'bg-yellow-100 text-yellow-800', label: 'Suspendu' }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{nom}</h3>
          {description && <p className="text-sm text-gray-500 line-clamp-2">{description}</p>}
        </div>
        <span className={`${statutConfig[statut].color} text-xs font-semibold px-3 py-1 rounded-full ml-2 flex-shrink-0`}>
          {statutConfig[statut].label}
        </span>
      </div>
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant du cycle</span>
          <span className="font-bold text-gray-900">{montantCycle.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Fréquence</span>
          <span className="font-semibold text-gray-700">{frequence}</span>
        </div>
        {ordreTirage && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Ordre de tirage</span>
            <span className="font-semibold text-purple-600">#{ordreTirage}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Date de début</span>
          <span className="font-semibold text-gray-700">
            {new Date(dateDebut).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </div>

      <Link href="/dashboard/user/tontines/id" className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center">
        <Eye className="w-4 h-4 mr-2" />
        Voir les détails
      </Link>
    </div>
  );
};

/**
 * Composant pour afficher une carte de crédit
 */
const CreditCardItem = ({
  montant,
  montantRestant,
  dateDemande,
  statut,
  scoreRisque,
}: CreditCardProps) => {
  const pourcentageRembourse = ((montant - montantRestant) / montant * 100).toFixed(0);
  
  const statutConfig = {
    EN_ATTENTE: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'En attente' },
    APPROUVE: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approuvé' },
    REJETE: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Rejeté' },
    REMBOURSE_PARTIEL: { color: 'bg-blue-100 text-blue-800', icon: TrendingUp, label: 'En cours' },
    REMBOURSE_TOTAL: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Remboursé' }
  };

  const StatusIcon = statutConfig[statut].icon;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Crédit</h3>
          <p className="text-xs text-gray-500 mt-1">
            Demandé le {new Date(dateDemande).toLocaleDateString('fr-FR')}
          </p>
        </div>
        <span className={`${statutConfig[statut].color} text-xs font-semibold px-3 py-1 rounded-full flex items-center`}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {statutConfig[statut].label}
        </span>
      </div>
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Montant initial</span>
          <span className="font-bold text-gray-900">{montant.toFixed(2)} €</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Reste à payer</span>
          <span className="font-bold text-red-600">{montantRestant.toFixed(2)} €</span>
        </div>
        
        {statut !== 'REJETE' && statut !== 'EN_ATTENTE' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600">Progression</span>
              <span className="text-xs font-bold text-gray-900">{pourcentageRembourse}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${pourcentageRembourse}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {statut !== 'REJETE' && statut !== 'REMBOURSE_TOTAL' && (
        <button className="w-full bg-green-50 hover:bg-green-100 text-green-600 font-medium py-2.5 px-4 rounded-lg transition-colors duration-150 flex items-center justify-center">
          <CreditCardIcon className="w-4 h-4 mr-2" />
          Rembourser
        </button>
      )}
    </div>
  );
};

/**
 * Composant pour afficher la carte de crédit alimentaire
 */
const CreditAlimentaireCard = ({
  plafond,
  montantUtilise,
  montantRestant,
  dateExpiration,
}: CreditAlimentaireProps) => {
  const pourcentageUtilise = ((montantUtilise / plafond) * 100).toFixed(0);

  return (
    <Link href="/dashboard/user/creditsalimentaires" className="block">
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-6 border border-purple-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2 text-purple-600" />
              Crédit Alimentaire
            </h3>
            {dateExpiration && (
              <p className="text-xs text-gray-600 mt-1">
                Expire le {new Date(dateExpiration).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Plafond</span>
            <span className="font-bold text-gray-900">{plafond.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Utilisé</span>
            <span className="font-bold text-purple-600">{montantUtilise.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Disponible</span>
            <span className="font-bold text-green-600">{montantRestant.toFixed(2)} €</span>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-600">Utilisation</span>
              <span className="text-xs font-bold text-gray-900">{pourcentageUtilise}%</span>
            </div>
            <div className="w-full bg-white rounded-full h-2.5">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${pourcentageUtilise}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

// ============================================================================
// COMPOSANT PRINCIPAL DU DASHBOARD
// ============================================================================

export default function UserDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);   
  
  // Données mockées - À remplacer par un appel API réel
  const [userData] = useState<{
    user: {
      nom: string;
      prenom: string;
      email: string;
      photo: string | null;
    };
    wallet: {
      soldeGeneral: number;
      soldeTontine: number;
      soldeCredit: number;
    };
    stats: {
      totalCotisations: number;
      totalTontines: number;
      totalCredits: number;
    };
    recentTransactions: Transaction[];
    tontines: Tontine[];
    credits: Credit[];
    creditAlimentaire: CreditAlimentaireProps;
  }>({
    user: {
      nom: 'Doe',
      prenom: 'John',
      email: 'john.doe@example.com',
      photo: null
    },
    wallet: {
      soldeGeneral: 15750.50,
      soldeTontine: 8500.00,
      soldeCredit: 3250.75
    },
    stats: {
      totalCotisations: 12,
      totalTontines: 3,
      totalCredits: 2
    },
    recentTransactions: [
      {
        id: 1,
        type: 'DEPOT',
        description: 'Dépôt sur compte général',
        amount: 500.00,
        date: '2025-01-05T10:30:00',
        reference: 'TXN-20250105-001'
      },
      {
        id: 2,
        type: 'COTISATION',
        description: 'Cotisation mensuelle janvier',
        amount: -50.00,
        date: '2025-01-04T14:20:00',
        reference: 'TXN-20250104-045'
      },
      {
        id: 3,
        type: 'TONTINE',
        description: 'Contribution Tontine Solidarité',
        amount: -100.00,
        date: '2025-01-03T09:15:00',
        reference: 'TXN-20250103-023'
      },
      {
        id: 4,
        type: 'REMBOURSEMENT_CREDIT',
        description: 'Remboursement crédit #2',
        amount: -150.00,
        date: '2025-01-02T16:45:00',
        reference: 'TXN-20250102-067'
      },
      {
        id: 5,
        type: 'RETRAIT',
        description: 'Retrait compte tontine',
        amount: -200.00,
        date: '2025-01-01T11:30:00',
        reference: 'TXN-20250101-012'
      }
    ],
    tontines: [
      {
        id: 1,
        nom: 'Tontine Solidarité',
        description: 'Entraide communautaire',
        montantCycle: 1000,
        frequence: 'MENSUEL',
        statut: 'ACTIVE',
        dateDebut: '2024-06-01',
        ordreTirage: 5
      },
      {
        id: 2,
        nom: 'Tontine Entrepreneuriat',
        description: 'Soutien aux entrepreneurs',
        montantCycle: 2000,
        frequence: 'MENSUEL',
        statut: 'ACTIVE',
        dateDebut: '2024-08-15',
        ordreTirage: 3
      },
      {
        id: 3,
        nom: 'Tontine Éducation',
        description: 'Financement de la scolarité',
        montantCycle: 500,
        frequence: 'HEBDOMADAIRE',
        statut: 'ACTIVE',
        dateDebut: '2024-09-01',
        ordreTirage: null
      }
    ],
    credits: [
      {
        id: 1,
        montant: 5000,
        montantRestant: 2500,
        dateDemande: '2024-10-15',
        statut: 'REMBOURSE_PARTIEL',
        scoreRisque: 0.75
      },
      {
        id: 2,
        montant: 1500,
        montantRestant: 750,
        dateDemande: '2024-12-01',
        statut: 'APPROUVE',
        scoreRisque: 0.85
      }
    ],
    creditAlimentaire: {
      plafond: 1000,
      montantUtilise: 350,
      montantRestant: 650,
      dateExpiration: '2025-06-30'
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ============= NAVBAR ============= */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                AfriGes
              </h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Salut, <span className="font-semibold">{userData.user.prenom} {userData.user.nom}</span>
              </span>
              <Link href="/dashboard/user/notifications" className="text-slate-600 hover:text-slate-800">
                🔔
              </Link>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold cursor-pointer hover:shadow-lg transition-shadow">
                {userData.user.prenom[0]}{userData.user.nom[0]}
              </div>
              {/* Bouton de déconnexion */}
              <SignOutButton 
                redirectTo="/auth/login?logout=success"
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              />
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {userData.user.prenom[0]}{userData.user.nom[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{userData.user.prenom} {userData.user.nom}</p>
                    <p className="text-sm text-gray-500">{userData.user.email}</p>
                  </div>
                </div>
              </div>
              {/* Bouton de déconnexion mobile */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <SignOutButton 
                  redirectTo="/auth/login?logout=success"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ============= MAIN CONTENT ============= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Mon Tableau de Bord</h2>
            <p className="text-gray-600 mt-1">Vue d&apos;ensemble de vos activités AfriSime</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors duration-150 flex items-center justify-center shadow-sm hover:shadow">
            <Download className="w-5 h-5 mr-2" />
            Exporter
          </button>
        </div>

        {/* Stats Cards - Wallet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Solde Général" 
            value={`${userData.wallet.soldeGeneral.toFixed(2)} €`}
            icon={Wallet}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
            trend="up"
            trendValue="+12%"
          />
          <StatCard 
            title="Solde Tontine" 
            value={`${userData.wallet.soldeTontine.toFixed(2)} €`}
            icon={Users}
            color="text-green-600"
            bgColor="bg-green-50"
            trend="up"
            trendValue="+8%"
          />

          <Link href="/dashboard/user/credits">
            <div className="cursor-pointer">
            <StatCard 
              title="Solde Crédit" 
              value={`${userData.wallet.soldeCredit.toFixed(2)} €`}
              icon={CreditCardIcon}
              color="text-orange-600"
              bgColor="bg-orange-50"
              trend="down"
              trendValue="-5%"
            />
            </div>
          </Link>

          <Link href="/dashboard/user/tontines">
            <div className="cursor-pointer">
            <StatCard 
              title="Mes Tontines" 
              value={userData.stats.totalTontines.toString()}
              icon={Users}
              color="text-purple-600"
              bgColor="bg-purple-50"
            />
            </div>
          </Link>

        </div>

        {/* Crédit Alimentaire */}
        {userData.creditAlimentaire && (
          <div className="mb-8">
            <CreditAlimentaireCard {...userData.creditAlimentaire} />
          </div>
        )}
 
        {/* Mes Tontines Actives */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Mes Tontines Actives</h3>
            <span className="bg-indigo-100 text-indigo-800 text-sm font-semibold px-4 py-2 rounded-full">
              {userData.tontines.length} Tontines
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userData.tontines.map(tontine => (
              <TontineCard key={tontine.id} {...tontine} />
            ))}
          </div>
        </div>

        {/* Grid 2 colonnes pour Crédits et Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mes Crédits en Cours */}
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
              <h3 className="text-2xl font-bold text-gray-900">Mes Crédits en Cours</h3>
              <button className="bg-green-50 hover:bg-green-100 text-green-600 font-medium px-4 py-2 rounded-lg transition-colors duration-150 text-sm">
                Demander un crédit
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {userData.credits.map(credit => (
                <CreditCardItem key={credit.id} {...credit} />
              ))}
            </div>
          </div>

          {/* Transactions Récentes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Transactions Récentes</h3>
                <Link
                  href="/dashboard/user/transactions"
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center"
                >
                  Voir tout
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="space-y-1">
                {userData.recentTransactions.map(transaction => (
                  <TransactionItem key={transaction.id} {...transaction} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>  
  );
}      