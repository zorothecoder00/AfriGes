"use client";

import React, { useState } from 'react';
import { TrendingUp, Users, Coins, CreditCard, ShoppingCart, Package, MoreVertical, Download, Plus } from 'lucide-react';  
import Link from "next/link";

export default function AfriGesDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('30');

  // Données du dashboard  
  const stats = [    
    { 
      id: 1, 
      label: 'Membres actifs', 
      value: '1,847', 
      change: '+12%', 
      icon: Users, 
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50'
    },   
    { 
      id: 2, 
      label: 'Tontines actives', 
      value: '24', 
      change: '+8%', 
      icon: Coins, 
      color: 'bg-emerald-500',
      lightBg: 'bg-emerald-50'
    },
    { 
      id: 3, 
      label: 'Crédits en cours', 
      value: '€45,280', 
      change: '+23%', 
      icon: CreditCard, 
      color: 'bg-amber-500',
      lightBg: 'bg-amber-50'
    },
    { 
      id: 4, 
      label: 'Achats via crédit alimentaire', 
      value: '€128,450', 
      change: '+15%', 
      icon: ShoppingCart, 
      color: 'bg-purple-500',
      lightBg: 'bg-purple-50'
    },
  ];

  const tontinesDistribution = [
    { name: 'Solidarité', percentage: 33.3, color: '#10b981', angle: 120 },
    { name: 'Entrepreneuriat', percentage: 25, color: '#f59e0b', angle: 90 },
    { name: 'Éducation', percentage: 16.7, color: '#3b82f6', angle: 60 },
    { name: 'Autres', percentage: 25, color: '#a855f7', angle: 90 },
  ];

  // Données pour le graphique d'évolution des revenus (simulation)
  const revenueData = [
    { day: 0, value: 30 },
    { day: 5, value: 32 },
    { day: 10, value: 35 },
    { day: 15, value: 38 },
    { day: 20, value: 42 },
    { day: 25, value: 46 },
    { day: 30, value: 50 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-emerald-50/20 font-['DM_Sans',sans-serif]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
          
          {/* Logo + App name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              AfriGes
            </h1>  
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/notifications" className="text-slate-600 hover:text-slate-800">
              🔔
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
              <span className="text-sm font-medium text-slate-700">
                Admin
              </span>
            </div>
          </div>
        </div>   
      </header>

      <div className="max-w-[1600px] mx-auto px-8 py-8 flex gap-6">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden sticky top-28">
            {/* Principal Section */}
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Principal
              </h3>
              <nav className="space-y-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium transition-all shadow-md shadow-emerald-200">
                  <TrendingUp size={20} />
                  <span>Tableau de bord</span>
                </button>
                <Link href="/dashboard/admin/membres" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Users size={20} />
                  <span>Membres</span>
                </Link>
                <Link href="/dashboard/admin/gestionnaires" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Users size={20} />
                  <span>Gestionnaires</span>
                </Link>
              </nav>
            </div>

            {/* Communauté Section */}
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Communauté
              </h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/tontines" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Coins size={20} />
                  <span>Tontines</span>
                </Link>
                <Link href="/dashboard/admin/cotisations" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <CreditCard size={20} />
                  <span>Cotisations</span>
                </Link>
                <Link href="/dashboard/admin/creditsAlimentaires" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <CreditCard size={20} />
                  <span>Crédits alimentaires</span>
                </Link>
              </nav>
            </div>

            {/* Commerce Section */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Commerce
              </h3>
              <nav className="space-y-1">
                <Link href="/dashboard/admin/ventes" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <ShoppingCart size={20} />
                  <span>Ventes</span>
                </Link>
                <Link href="/dashboard/admin/stock" className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                  <Package size={20} />
                  <span>Gestion du stock</span>
                </Link>  
              </nav>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold text-slate-800 mb-2">Tableau de bord</h2>
              <p className="text-slate-500">Vue d&apos;ensemble des activités AfriSime</p>
            </div>
            <div className="flex gap-3">
              <button className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-medium">
                <Download size={18} />
                Exporter
              </button>
              <button className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 font-medium">
                <Plus size={18} />
                Nouvelle opération
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={stat.id} 
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`${stat.lightBg} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                      <Icon className={`${stat.color.replace('bg-', 'text-')} w-6 h-6`} />
                    </div>
                    <span className="text-emerald-600 text-sm font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg">
                      {stat.change}
                    </span>
                  </div>
                  <h3 className="text-slate-600 text-sm font-medium mb-1">{stat.label}</h3>
                  <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-3 gap-5">
            {/* Revenue Evolution Chart */}
            <div className="col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">Évolution des revenus</h3>
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="7">7 derniers jours</option>
                  <option value="30">30 derniers jours</option>
                  <option value="90">90 derniers jours</option>
                </select>
              </div>
              
              {/* Simple Line Chart */}
              <div className="relative h-64 mt-4">
                <svg width="100%" height="100%" className="overflow-visible">
                  {/* Grid lines */}
                  {[10, 20, 30, 40].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={`${100 - (y / 50) * 100}%`}
                      x2="100%"
                      y2={`${100 - (y / 50) * 100}%`}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                  ))}
                  
                  {/* Y-axis labels */}
                  {[10, 20, 30, 40].map((y) => (
                    <text
                      key={y}
                      x="0"
                      y={`${100 - (y / 50) * 100}%`}
                      fill="#64748b"
                      fontSize="12"
                      dy="4"
                    >
                      {y}k
                    </text>
                  ))}
                  
                  {/* Line path */}
                  <path
                    d={revenueData
                      .map((point, i) => {
                        const x = (point.day / 30) * 100;
                        const y = 100 - (point.value / 50) * 100;
                        return `${i === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="url(#lineGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Area fill */}
                  <path
                    d={`
                      M ${(revenueData[0].day / 30) * 100}% ${100 - (revenueData[0].value / 50) * 100}%
                      ${revenueData
                        .slice(1)
                        .map((point) => {
                          const x = (point.day / 30) * 100;
                          const y = 100 - (point.value / 50) * 100;
                          return `L ${x}% ${y}%`;
                        })
                        .join(' ')}
                      L ${(revenueData[revenueData.length - 1].day / 30) * 100}% 100%
                      L ${(revenueData[0].day / 30) * 100}% 100%
                      Z
                    `}
                    fill="url(#areaGradient)"
                  />
                  
                  {/* Gradient definitions */}
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Flux financiers Pie Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">Répartition des flux financiers</h3>
                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                  <MoreVertical size={20} />
                </button>
              </div>
              
              {/* Pie Chart */}
              <div className="flex items-center justify-center mb-6">
                <svg width="220" height="220" viewBox="0 0 220 220">
                  <circle
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="40"
                    strokeDasharray="167.55 502.65"
                    transform="rotate(-90 110 110)"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="40"
                    strokeDasharray="125.66 544.54"
                    strokeDashoffset="-167.55"
                    transform="rotate(-90 110 110)"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="40"
                    strokeDasharray="83.77 586.43"
                    strokeDashoffset="-293.21"
                    transform="rotate(-90 110 110)"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="40"
                    strokeDasharray="125.66 544.54"
                    strokeDashoffset="-376.98"
                    transform="rotate(-90 110 110)"
                  />
                  <circle cx="110" cy="110" r="55" fill="white" />
                </svg>
              </div>
              
              {/* Legend */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm text-slate-600">Solidarité</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">33.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <span className="text-sm text-slate-600">Entrepreneuriat</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">25%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm text-slate-600">Éducation</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">16.7%</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                    <span className="text-sm text-slate-600">Autres</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">25%</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Help Button */}
      <button className="fixed bottom-8 right-8 bg-blue-600 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-xl hover:bg-blue-700 transition-all hover:scale-110">
        <span className="text-2xl">?</span>
        <span className="ml-1 text-xs">Aide</span>
      </button>
    </div>
  );
}