"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Lien de retour qui lit la requête (`?retour=/chemin`) pour revenir à la page d'où l'on vient :
 * le Centre de commandement (admin ou rôle gestionnaire) ajoute `retour` à ses liens ; sans ce
 * paramètre, retour au tableau de bord (`/dashboard`, qui redirige vers le dashboard du rôle).
 * Lecture via useSearchParams (à jour lors d'une navigation interne, contrairement à window.location) ;
 * le Suspense requis par Next est intégré ici, les pages n'ont rien à prévoir.
 */

export const RETOUR_PARAM = "retour";

/** Ajoute `retour` à une URL interne (en respectant une query string existante). */
export function avecRetour(url: string, retour: string): string {
  const [base, hash] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${RETOUR_PARAM}=${encodeURIComponent(retour)}${hash ? `#${hash}` : ""}`;
}

/** Valide une valeur de `retour` : chemin interne du dashboard uniquement (pas de redirection ouverte). */
export function retourValide(v: string | null): string | null {
  if (!v || v.includes("//") || v.includes("\\")) return null;
  return /^\/dashboard(\/[\w\-./]*)?(\?[\w\-./=&%]*)?$/.test(v) ? v : null;
}

/** Lit `retour` dans l'URL courante (côté client, au moment d'un clic). */
export function lireRetour(): string | null {
  if (typeof window === "undefined") return null;
  return retourValide(new URLSearchParams(window.location.search).get(RETOUR_PARAM));
}

interface Props {
  defaultHref?: string;
  defaultLabel?: string;
  className?: string;
  /** Flèche seule (le libellé devient l'infobulle) — pour les en-têtes où le lien est un bouton-icône. */
  iconOnly?: boolean;
}

const CLASSE_PAR_DEFAUT = "inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";

function Lien({ href, label, className, iconOnly }: { href: string; label: string; className: string; iconOnly: boolean }) {
  return (
    <Link href={href} className={className} title={label}>
      <ArrowLeft className={iconOnly ? "w-5 h-5 text-slate-600" : "w-4 h-4"} /> {!iconOnly && label}
    </Link>
  );
}

function LienAvecRequete({ defaultHref, defaultLabel, className, iconOnly }: Required<Props>) {
  const retour = retourValide(useSearchParams().get(RETOUR_PARAM));
  return retour
    ? <Lien href={retour} label={retour.includes("centre-commandement") ? "Retour au centre de commandement" : "Retour"} className={className} iconOnly={iconOnly} />
    : <Lien href={defaultHref} label={defaultLabel} className={className} iconOnly={iconOnly} />;
}

export default function RetourLien({
  defaultHref = "/dashboard",
  defaultLabel = "Retour au tableau de bord",
  className = CLASSE_PAR_DEFAUT,
  iconOnly = false,
}: Props) {
  return (
    <Suspense fallback={<Lien href={defaultHref} label={defaultLabel} className={className} iconOnly={iconOnly} />}>
      <LienAvecRequete defaultHref={defaultHref} defaultLabel={defaultLabel} className={className} iconOnly={iconOnly} />
    </Suspense>
  );
}
