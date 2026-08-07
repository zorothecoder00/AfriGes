"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import AfriSimeLogo from "@/components/AfriSimeLogo";

interface ChampFormulaire {
  cle: string;
  label: string;
  type: "text" | "tel" | "email" | "select";
  requis: boolean;
  options?: string[];
}
interface LandingPageData {
  titre: string; description: string | null; offreTexte: string | null;
  imageUrl: string | null; ctaLabel: string | null; ctaUrl: string | null;
  produit: { id: number; nom: string; prixUnitaire: number | string } | null;
  formulaire: { id: number; nom: string; champs: ChampFormulaire[] } | null;
}

export default function LandingPagePublique() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const qr = searchParams.get("qr");

  const [data, setData] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [merci, setMerci] = useState(false);

  useEffect(() => {
    fetch(`/api/marketing/lp/${params.slug}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const j = await r.json();
        setData(j.data as LandingPageData);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.formulaire) return;
    for (const c of data.formulaire.champs) {
      if (c.requis && !valeurs[c.cle]?.trim()) { toast.error(`${c.label} est requis`); return; }
    }
    setEnvoi(true);
    try {
      const r = await fetch(`/api/marketing/lp/${params.slug}/soumettre`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donnees: valeurs, qr: qr || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setMerci(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau");
    } finally {
      setEnvoi(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (notFound || !data) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <p className="text-slate-400 text-center">Cette page n&apos;est plus disponible.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-fuchsia-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm p-2"><AfriSimeLogo className="w-full h-full object-contain" /></div>
        </div>

        {data.imageUrl && <img src={data.imageUrl} alt={data.titre} className="w-full rounded-2xl mb-5 object-cover max-h-64" />}

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">{data.titre}</h1>
        {data.description && <p className="text-slate-500 text-center mb-4">{data.description}</p>}
        {data.offreTexte && (
          <div className="bg-fuchsia-600 text-white text-center rounded-xl py-3 px-4 font-semibold mb-6">{data.offreTexte}</div>
        )}

        {data.ctaLabel && data.ctaUrl && (
          <a href={data.ctaUrl} className="block text-center bg-slate-900 text-white rounded-xl py-3 font-semibold mb-6">{data.ctaLabel}</a>
        )}

        {data.formulaire && (
          merci ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-800">Merci !</p>
              <p className="text-sm text-slate-500">Votre demande a bien été enregistrée, nous vous contacterons rapidement.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              {data.formulaire.champs.map((c) => (
                <label key={c.cle} className="block">
                  <span className="text-xs font-semibold text-slate-500">{c.label}{c.requis ? " *" : ""}</span>
                  {c.type === "select" ? (
                    <select value={valeurs[c.cle] ?? ""} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                      <option value="">— choisir —</option>
                      {(c.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={c.type} value={valeurs[c.cle] ?? ""} onChange={(e) => setValeurs((v) => ({ ...v, [c.cle]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500" />
                  )}
                </label>
              ))}
              <button type="submit" disabled={envoi}
                className="w-full inline-flex items-center justify-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-50 text-white rounded-xl py-3 font-semibold">
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
