"use client";

import { generateUploadButton } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";
import { toast } from "sonner";
import { Paperclip, ExternalLink, AlertTriangle } from "lucide-react";
import { useApi } from "@/hooks/useApi";

const UploadButton = generateUploadButton<OurFileRouter>();

interface Piece { id: number; nom: string; url: string; nature: string }

/**
 * Pièces justificatives d'une fiche de décaissement (reçus, factures…) : liste + téléversement.
 * `alerte` : la fiche est payée et sans pièce → le demandeur ne pourra pas créer de nouvelle fiche
 * tant qu'il n'a pas joint ses justificatifs.
 */
export default function PiecesDecaissement({ ficheId, alerte, onChange }: { ficheId: number; alerte?: boolean; onChange?: () => void }) {
  const { data, refetch } = useApi<{ data: Piece[] }>(`/api/decaissements/${ficheId}/pieces`);
  const pieces = data?.data ?? [];

  return (
    <div className="pt-2 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> Pièces justificatives</p>
      {alerte && pieces.length === 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Aucune pièce jointe : joignez vos justificatifs (reçus, factures…) pour pouvoir créer une nouvelle fiche.
        </p>
      )}
      <ul className="space-y-1 mb-2">
        {pieces.map((p) => (
          <li key={p.id}>
            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"><ExternalLink className="w-3 h-3" /> {p.nom}</a>
          </li>
        ))}
        {pieces.length === 0 && !alerte && <li className="text-xs text-slate-400">Aucune pièce jointe.</li>}
      </ul>
      <UploadButton
        endpoint="pieceDecaissement"
        onClientUploadComplete={async (res) => {
          try {
            const r = await fetch(`/api/decaissements/${ficheId}/pieces`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pieces: res.map((f) => ({ nom: f.name, url: f.url, key: f.key, type: f.type, taille: f.size, nature: "RECU" })) }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) { toast.error(j.error ?? "Enregistrement des pièces impossible"); return; }
            toast.success("Pièces jointes enregistrées");
            refetch(); onChange?.();
          } catch { toast.error("Erreur réseau"); }
        }}
        onUploadError={(err) => { toast.error(`Envoi impossible : ${err.message}`); }}
        appearance={{
          button: "bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg",
          allowedContent: "text-slate-400 text-[10px] mt-0.5",
        }}
      />
    </div>
  );
}
