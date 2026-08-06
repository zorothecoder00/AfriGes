"use client";

import { useState } from "react";
import BibliothequeContenu from "@/components/marketing/BibliothequeContenu";
import CalendrierEditorial from "@/components/marketing/CalendrierEditorial";

export default function ContenuPage() {
  const [vue, setVue] = useState<"bibliotheque" | "calendrier">("bibliotheque");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Contenu</h2>
          <p className="text-slate-500 text-sm mt-0.5">Bibliothèque de médias et calendrier éditorial.</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setVue("bibliotheque")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${vue === "bibliotheque" ? "bg-white shadow-sm" : "text-slate-500"}`}>Bibliothèque</button>
          <button onClick={() => setVue("calendrier")} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${vue === "calendrier" ? "bg-white shadow-sm" : "text-slate-500"}`}>Calendrier</button>
        </div>
      </div>
      {vue === "bibliotheque" ? <BibliothequeContenu /> : <CalendrierEditorial />}
    </div>
  );
}
