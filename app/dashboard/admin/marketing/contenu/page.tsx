"use client";

import BibliothequeContenu from "@/components/marketing/BibliothequeContenu";

export default function BibliothequeMarketingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Bibliothèque Marketing</h2>
        <p className="text-slate-500 text-sm mt-0.5">Photos, vidéos, affiches, flyers, catalogues — centralisés, catégorisés, liés aux campagnes (CDC §29-30).</p>
      </div>
      <BibliothequeContenu />
    </div>
  );
}
