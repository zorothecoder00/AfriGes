import { prisma } from "@/lib/prisma";

/**
 * Référentiels publics pour filtrer la vitrine / borne (familles, catégories,
 * marques actives). Léger, sans données confidentielles, sans authentification.
 * Partagé entre la route API (filtrage client) et la page serveur (rendu initial ISR).
 */
export async function getReferentielsPublics() {
  const [familles, categories, marques] = await Promise.all([
    prisma.familleProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.categorieProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.marqueProduit.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  return { familles, categories, marques };
}
