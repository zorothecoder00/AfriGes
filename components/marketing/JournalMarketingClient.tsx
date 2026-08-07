"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Loader2, Send, Eye, MessageSquareReply, Ticket, ShoppingBag, CalendarDays, ClipboardList } from "lucide-react";

interface EvenementJournal {
  type: "MESSAGE_ENVOYE" | "MESSAGE_LU" | "MESSAGE_REPONSE" | "COUPON_UTILISE" | "ACHAT" | "EVENEMENT_PARTICIPATION" | "FORMULAIRE_SOUMIS";
  date: string; titre: string; detail: string | null; campagneNom: string | null; montant: number | null;
}

const ICONE: Record<string, typeof Send> = {
  MESSAGE_ENVOYE: Send, MESSAGE_LU: Eye, MESSAGE_REPONSE: MessageSquareReply,
  COUPON_UTILISE: Ticket, ACHAT: ShoppingBag, EVENEMENT_PARTICIPATION: CalendarDays, FORMULAIRE_SOUMIS: ClipboardList,
};
const COULEUR: Record<string, string> = {
  MESSAGE_ENVOYE: "text-slate-500 bg-slate-100", MESSAGE_LU: "text-indigo-600 bg-indigo-50",
  MESSAGE_REPONSE: "text-purple-600 bg-purple-50", COUPON_UTILISE: "text-amber-600 bg-amber-50",
  ACHAT: "text-emerald-600 bg-emerald-50", EVENEMENT_PARTICIPATION: "text-blue-600 bg-blue-50",
  FORMULAIRE_SOUMIS: "text-fuchsia-600 bg-fuchsia-50",
};

/** Journal marketing unifié d'un client (CDC §76) — campagne reçue → message → ouverture → interaction → coupon → achat. */
export default function JournalMarketingClient({ clientId }: { clientId: number }) {
  const [evenements, setEvenements] = useState<EvenementJournal[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/marketing/clients/${clientId}/journal`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (ok) setEvenements(j.data); else setErreur(j.error ?? "Erreur"); })
      .catch(() => setErreur("Chargement impossible"));
  }, [clientId]);

  if (erreur) return <p className="text-sm text-slate-400 py-8 text-center">{erreur}</p>;
  if (!evenements) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  if (evenements.length === 0) return <p className="text-sm text-slate-400 py-8 text-center">Aucune interaction marketing pour l&apos;instant.</p>;

  return (
    <div className="space-y-2">
      {evenements.map((e, i) => {
        const Icon = ICONE[e.type] ?? Send;
        return (
          <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-white border border-slate-100 rounded-xl">
            <span className={`p-1.5 rounded-lg shrink-0 ${COULEUR[e.type]}`}><Icon className="w-3.5 h-3.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{e.titre}</p>
              <p className="text-xs text-slate-400">
                {formatDate(e.date)}
                {e.campagneNom ? ` · ${e.campagneNom}` : ""}
                {e.detail ? ` · ${e.detail}` : ""}
              </p>
            </div>
            {e.montant != null && <span className="text-sm font-semibold text-slate-700 shrink-0">{formatCurrency(e.montant)}</span>}
          </div>
        );
      })}
    </div>
  );
}
