const STATUS_STYLES: Record<string, string> = {
  ACTIF: "bg-green-100 text-green-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAYEE: "bg-green-100 text-green-800",
  EN_ATTENTE: "bg-yellow-100 text-yellow-800",
  INACTIF: "bg-gray-100 text-gray-800",
  SUSPENDU: "bg-red-100 text-red-800",
  SUSPENDUE: "bg-red-100 text-red-800",
  EXPIREE: "bg-red-100 text-red-800",
  EXPIRE: "bg-red-100 text-red-800",
  EPUISE: "bg-orange-100 text-orange-800",
  TERMINEE: "bg-blue-100 text-blue-800",
  APPROUVE: "bg-blue-100 text-blue-800",
  REJETE: "bg-red-100 text-red-800",
  REMBOURSE_PARTIEL: "bg-indigo-100 text-indigo-800",
  REMBOURSE_TOTAL: "bg-green-100 text-green-800",
  BROUILLON: "bg-gray-100 text-gray-800",
  ANNULEE: "bg-red-100 text-red-800",
};

export function getStatusStyle(status: string): string {
  return STATUS_STYLES[status] ?? "bg-gray-100 text-gray-800";
}

const STATUS_LABELS: Record<string, string> = {
  ACTIF: "Actif",
  ACTIVE: "Active",
  PAYEE: "Payee",
  EN_ATTENTE: "En attente",
  INACTIF: "Inactif",
  SUSPENDU: "Suspendu",
  SUSPENDUE: "Suspendue",
  EXPIREE: "Expiree",
  EXPIRE: "Expire",
  EPUISE: "Epuise",
  TERMINEE: "Terminee",
  APPROUVE: "Approuve",
  REJETE: "Rejete",
  REMBOURSE_PARTIEL: "Remb. partiel",
  REMBOURSE_TOTAL: "Rembourse",
  BROUILLON: "Brouillon",
  ANNULEE: "Annulee",
  MENSUEL: "Mensuel",
  ANNUEL: "Annuel",
  HEBDOMADAIRE: "Hebdomadaire",
  AGENT: "Agent",
  SUPERVISEUR: "Superviseur",
  CAISSIER: "Caissier",
  USER: "Utilisateur",
  ADMIN: "Administrateur",
  SUPER_ADMIN: "Super Admin",
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
