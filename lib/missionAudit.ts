import { prisma } from "@/lib/prisma";

export interface ChecklistItem {
  id: string;
  question: string;
  reponse: "OUI" | "NON" | null;
  commentaire: string;
}

// Checklist par défaut pour l'audit d'un financement (exemple du CDC)
export const CHECKLIST_FINANCEMENT_DEFAULT: Omit<ChecklistItem, "reponse" | "commentaire">[] = [
  { id: "clients_existent",      question: "Les clients existent-ils ?" },
  { id: "marchandises_livrees",  question: "Les marchandises ont-elles été livrées ?" },
  { id: "prix_conformes",        question: "Les prix sont-ils conformes ?" },
  { id: "montants_justifies",    question: "Les montants financés sont-ils justifiés ?" },
  { id: "recouvrements_corrects",question: "Les recouvrements sont-ils corrects ?" },
];

export function checklistInitiale(items: Omit<ChecklistItem, "reponse" | "commentaire">[]): ChecklistItem[] {
  return items.map((it) => ({ ...it, reponse: null, commentaire: "" }));
}

export async function genRefAudit(): Promise<string> {
  const count = await prisma.missionAuditRIA.count();
  const annee = new Date().getFullYear();
  return `AUD-${annee}-${String(count + 1).padStart(5, "0")}`;
}
