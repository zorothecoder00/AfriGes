"use client";

import { useState } from "react";
import QrCodesMarketing from "@/components/marketing/QrCodesMarketing";
import LandingPagesMarketing from "@/components/marketing/LandingPagesMarketing";
import FormulairesMarketing from "@/components/marketing/FormulairesMarketing";

type Vue = "landing" | "formulaires" | "qr";

export default function AcquisitionMarketingPage() {
  const [vue, setVue] = useState<Vue>("landing");

  return (
    <div className="space-y-4">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button onClick={() => setVue("landing")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "landing" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Landing pages</button>
        <button onClick={() => setVue("formulaires")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "formulaires" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>Formulaires</button>
        <button onClick={() => setVue("qr")} className={`px-4 py-1.5 text-xs font-semibold rounded-lg ${vue === "qr" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>QR Codes</button>
      </div>
      {vue === "landing" && <LandingPagesMarketing />}
      {vue === "formulaires" && <FormulairesMarketing />}
      {vue === "qr" && <QrCodesMarketing />}
    </div>
  );
}
