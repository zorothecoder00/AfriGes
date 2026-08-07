"use client";

import CalendrierEditorial from "@/components/marketing/CalendrierEditorial";

export default function SocialMediaPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Social Media</h2>
        <p className="text-slate-500 text-sm mt-0.5">Calendrier de publications par réseau, agence, produit, responsable (CDC §27-28).</p>
      </div>
      <CalendrierEditorial />
    </div>
  );
}
