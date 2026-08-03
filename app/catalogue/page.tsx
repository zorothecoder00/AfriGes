import type { Metadata } from "next";
import { projeterCatalogue } from "@/lib/catalogueProjection";
import { getReferentielsPublics } from "@/lib/catalogueReferentielsPublics";
import { SOCIETE } from "@/lib/societe";
import CatalogueClient, { type Reponse } from "./CatalogueClient";

/**
 * Vitrine / borne publique du catalogue (Catalogue §21-24) — page SERVEUR.
 * Rendu initial (page 1, sans filtre) fait côté serveur pour le SEO et le
 * premier affichage ; revalidation périodique (ISR) car prix/stock changent
 * quelques fois par jour, pas à chaque requête. Le reste (recherche, filtres,
 * pagination) est géré par `CatalogueClient`.
 */
export const revalidate = 300; // 5 min

export const metadata: Metadata = {
  title: `Catalogue produits — ${SOCIETE.nom}`,
  description: `Découvrez les produits, prix et disponibilités ${SOCIETE.nom} : ${SOCIETE.activites.join(" · ")}.`,
  alternates: { canonical: "/catalogue" },
  robots: { index: true, follow: true }, // page publique : surcharge le noindex par défaut du root layout
  openGraph: {
    title: `Catalogue produits — ${SOCIETE.nom}`,
    description: `Découvrez les produits, prix et disponibilités ${SOCIETE.nom}.`,
    url: "/catalogue",
    siteName: SOCIETE.nom,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Catalogue produits — ${SOCIETE.nom}`,
    description: `Découvrez les produits, prix et disponibilités ${SOCIETE.nom}.`,
  },
};

export default async function CataloguePublicPage() {
  const [initialData, initialRefs] = await Promise.all([
    projeterCatalogue({ cle: "VISITEUR", page: 1, limit: 24 }),
    getReferentielsPublics(),
  ]);

  // `projeterCatalogue` renvoie des lignes non typées (projection dynamique selon
  // la vue) ; même contrat que `/api/catalogue/public` côté client (fetch → any).
  return <CatalogueClient initialData={initialData as unknown as Reponse | null} initialRefs={initialRefs} />;
}
