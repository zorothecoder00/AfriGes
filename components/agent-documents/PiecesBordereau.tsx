"use client";

import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { X, Paperclip, ExternalLink } from "lucide-react";

const UploadButton = generateUploadButton<OurFileRouter>();

export type NaturePieceBordereau = "RELEVE_BANCAIRE" | "RECU" | "PIECE_CAISSE";

export interface PieceBordereauUploadee { url: string; key: string; nom: string; type: string; taille: number; nature: NaturePieceBordereau }

export const NATURE_PIECE_LABEL: Record<string, string> = {
  RELEVE_BANCAIRE: "Avis de virement", RECU: "Justificatif Mobile Money", PIECE_CAISSE: "Fiche journalière de collecte", AUTRE: "Autre pièce",
};

/** Téléversement d'une catégorie de pièces (uploadthing) ; la liste est pilotée par le parent. */
export function PiecesUploader({ nature, label, obligatoire, pieces, onChange }: {
  nature: NaturePieceBordereau; label: string; obligatoire?: boolean;
  pieces: PieceBordereauUploadee[]; onChange: (p: PieceBordereauUploadee[]) => void;
}) {
  const miennes = pieces.filter((p) => p.nature === nature);
  return (
    <div className="mt-1.5">
      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Paperclip className="w-3 h-3" /> {label}{obligatoire && " *"}</p>
      {miennes.map((p) => (
        <div key={p.key} className="flex items-center justify-between gap-2 px-2 py-1 mb-1 border border-emerald-200 bg-emerald-50 rounded text-xs">
          <span className="truncate">{p.nom}</span>
          <button type="button" onClick={() => onChange(pieces.filter((x) => x.key !== p.key))}><X className="w-3.5 h-3.5 text-slate-400" /></button>
        </div>
      ))}
      <UploadButton
        endpoint="pieceBordereauRemise"
        onClientUploadComplete={(res) => onChange([
          ...pieces,
          ...res.map((f) => ({ url: f.url, key: f.key, nom: f.name, type: f.type ?? "application/octet-stream", taille: f.size, nature })),
        ])}
        onUploadError={(err) => console.error("Upload error:", err)}
        appearance={{
          button: "bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg",
          allowedContent: "text-slate-400 text-[10px] mt-0.5",
        }}
      />
    </div>
  );
}

/** Pièces jointes d'un bordereau (lecture) : liens vers les fichiers. */
export function PiecesListe({ pieces }: { pieces?: { id: number; nom: string; url: string; nature: string }[] }) {
  if (!pieces || pieces.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Pièces jointes</p>
      <ul className="space-y-1">
        {pieces.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3 h-3" /> {NATURE_PIECE_LABEL[p.nature] ?? p.nature} — {p.nom}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
