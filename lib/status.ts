// =====================================================
// 🎨 STYLES (Statuts + Rôles)
// =====================================================

const STATUS_STYLES: Record<string, string> = {
  // ==========================
  // 📌 STATUTS
  // ==========================
  ACTIF: "bg-green-100 text-green-800 border-green-200",
  ACTIVE: "bg-green-100 text-green-800 border-green-200",
  PAYEE: "bg-green-100 text-green-800 border-green-200",
  EN_ATTENTE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  INACTIF: "bg-gray-100 text-gray-800 border-gray-200",
  SUSPENDU: "bg-red-100 text-red-800 border-red-200",
  SUSPENDUE: "bg-red-100 text-red-800 border-red-200",
  EXPIREE: "bg-red-100 text-red-800 border-red-200",
  EXPIRE: "bg-red-100 text-red-800 border-red-200",
  EPUISE: "bg-orange-100 text-orange-800 border-orange-200",
  TERMINEE: "bg-blue-100 text-blue-800 border-blue-200",
  APPROUVE: "bg-blue-100 text-blue-800 border-blue-200",
  REJETE: "bg-red-100 text-red-800 border-red-200",
  REMBOURSE_PARTIEL: "bg-indigo-100 text-indigo-800 border-indigo-200",
  REMBOURSE_TOTAL: "bg-green-100 text-green-800 border-green-200",
  BROUILLON: "bg-gray-100 text-gray-800 border-gray-200",
  ANNULEE: "bg-red-100 text-red-800 border-red-200",

  // ==========================    
  // 👤 ROLES USER
  // ==========================
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
  ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
  USER: "bg-emerald-100 text-emerald-700 border-emerald-200",

  // ==========================
  // 🏢 ROLES GESTIONNAIRES
  // ==========================
  RESPONSABLE_POINT_DE_VENTE: "bg-indigo-100 text-indigo-700 border-indigo-200",
  RESPONSABLE_COMMUNAUTE: "bg-pink-100 text-pink-700 border-pink-200",
  REVENDEUR: "bg-orange-100 text-orange-700 border-orange-200",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "bg-cyan-100 text-cyan-700 border-cyan-200",
  MAGAZINIER: "bg-teal-100 text-teal-700 border-teal-200",
  CAISSIER: "bg-blue-100 text-blue-700 border-blue-200",
  COMMERCIAL: "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPTABLE: "bg-violet-100 text-violet-700 border-violet-200",
  AUDITEUR_INTERNE: "bg-yellow-100 text-yellow-700 border-yellow-200",
  RESPONSABLE_VENTE_CREDIT: "bg-rose-100 text-rose-700 border-rose-200",
  CONTROLEUR_TERRAIN: "bg-lime-100 text-lime-700 border-lime-200",
  AGENT_TERRAIN: "bg-sky-100 text-sky-700 border-sky-200",
  RESPONSABLE_ECONOMIQUE: "bg-amber-100 text-amber-700 border-amber-200",
  RESPONSABLE_MARKETING: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  ACTIONNAIRE: "bg-slate-100 text-slate-700 border-slate-200",
};

// =====================================================
// 🎯 GET STYLE
// =====================================================

export function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
}

// =====================================================
// 🏷 LABELS
// =====================================================

const STATUS_LABELS: Record<string, string> = {
  // Statuts
  ACTIF: "Actif",
  ACTIVE: "Active",
  PAYEE: "Payée",
  EN_ATTENTE: "En attente",
  INACTIF: "Inactif",
  SUSPENDU: "Suspendu",
  SUSPENDUE: "Suspendue",
  EXPIREE: "Expirée",
  EXPIRE: "Expiré",
  EPUISE: "Épuisé",
  TERMINEE: "Terminée",
  APPROUVE: "Approuvé",
  REJETE: "Rejeté",
  REMBOURSE_PARTIEL: "Remb. partiel",
  REMBOURSE_TOTAL: "Remboursé",
  BROUILLON: "Brouillon",
  ANNULEE: "Annulée",

  // Fréquences
  MENSUEL: "Mensuel",
  ANNUEL: "Annuel",
  HEBDOMADAIRE: "Hebdomadaire",

  // Roles User
  USER: "Utilisateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super Admin",

  // Roles Gestionnaires
  RESPONSABLE_POINT_DE_VENTE: "Responsable point de vente",
  RESPONSABLE_COMMUNAUTE: "Responsable communauté",
  REVENDEUR: "Revendeur",
  AGENT_LOGISTIQUE_APPROVISIONNEMENT: "Agent logistique",
  MAGAZINIER: "Magazinier",
  CAISSIER: "Caissier",
  COMMERCIAL: "Commercial",
  COMPTABLE: "Comptable",
  AUDITEUR_INTERNE: "Auditeur interne",
  RESPONSABLE_VENTE_CREDIT: "Responsable vente crédit",
  CONTROLEUR_TERRAIN: "Contrôleur terrain",
  AGENT_TERRAIN: "Agent terrain",
  RESPONSABLE_ECONOMIQUE: "Responsable économique",
  RESPONSABLE_MARKETING: "Responsable marketing",
  ACTIONNAIRE: "Actionnaire",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
