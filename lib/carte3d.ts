import type { MouseEvent } from "react";

/**
 * Cartes « documents » (centre de commandement, documents commerciaux de l'agent terrain) :
 * fond constant soutenu — pour ressortir sur le fond bleu clair des pages, texte blanc —
 * alterné d'une carte à l'autre, et survol 3D qui incline la carte vers le curseur.
 */
export const TEINTES_CARTE = [
  "bg-indigo-700 border-indigo-800",
  "bg-emerald-700 border-emerald-800",
  "bg-orange-700 border-orange-800",
  "bg-sky-700 border-sky-800",
  "bg-rose-700 border-rose-800",
  "bg-violet-700 border-violet-800",
];

export function teinteCarte(index: number): string {
  return TEINTES_CARTE[index % TEINTES_CARTE.length];
}

/** Classes communes : ombre, préparation 3D et transition du survol. */
export const CLASSES_CARTE_3D =
  "border shadow-sm [transform-style:preserve-3d] will-change-transform transition-[transform,box-shadow] duration-200 ease-out hover:shadow-2xl hover:shadow-slate-400/40";

/** onMouseMove : la carte s'incline vers le curseur (perspective + rotateX/Y), se soulève et grossit légèrement. */
export function inclinerCarte(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 → 0.5
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.transform = `perspective(700px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px) scale(1.02)`;
}

/** onMouseLeave : retour à plat. */
export function redresserCarte(e: MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "";
}
