"use client";

/**
 * Affiche le badge de segment (RIA / Ordinaire) et les tags d'un client.
 * Utilisé en lecture seule dans tous les dashboards user gestionnaires.
 *
 * Props:
 *  - segment  : "ORDINAIRE" | "RIA" | null | undefined
 *  - tags     : tableau de { tag: { id, nom, couleur } }
 *  - maxTags  : nombre max de tags affichés avant "+n" (défaut 3)
 *  - showOrd  : afficher le badge "Ordinaire" (défaut false — on ne l'affiche
 *               que si on veut le montrer explicitement, pour ne pas surcharger l'UI)
 */

interface TagItem { tag: { id: number; nom: string; couleur: string } }

interface Props {
  segment?:  string | null;
  tags?:     TagItem[];
  maxTags?:  number;
  showOrd?:  boolean;
}

export default function ClientSegmentTags({ segment, tags = [], maxTags = 3, showOrd = false }: Props) {
  const isRIA     = segment === "RIA";
  const visible   = tags.slice(0, maxTags);
  const overflow  = tags.length - maxTags;

  if (!isRIA && !showOrd && tags.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-1 mt-0.5">
      {/* Badge segment */}
      {isRIA && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 leading-none">
          ★ RIA
        </span>
      )}
      {!isRIA && showOrd && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 leading-none">
          Ordinaire
        </span>
      )}

      {/* Tags */}
      {visible.map(({ tag }) => (
        <span
          key={tag.id}
          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white leading-none"
          style={{ backgroundColor: tag.couleur }}
        >
          {tag.nom}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-slate-400 font-medium">+{overflow}</span>
      )}
    </div>
  );
}
