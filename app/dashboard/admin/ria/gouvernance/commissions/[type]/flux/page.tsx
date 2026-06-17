"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import Link from "next/link";
import { RefreshCw, FileText, Wallet, ArrowDownCircle, ArrowUpCircle, FileSearch } from "lucide-react";

interface DossierApprouve {
  id: number; reference: string; titre: string; statut: string;
  montantApprouve: number | null; dateValidation: string | null;
  _count: { missionsAudit: number };
}
interface Financement {
  id: number; reference: string; montantFinance: number; statut: string; dateFinancement: string;
  client: { nom: string; prenom: string }; _count: { missionsAudit: number };
}
interface Decaissement {
  id: number; montant: number; description: string | null; createdAt: string;
  financement: { id: number; reference: string; client: { nom: string; prenom: string } } | null;
}
interface Recouvrement {
  id: number; montant: number; createdAt: string;
  financement: { id: number; reference: string; client: { nom: string; prenom: string } } | null;
}
interface Data {
  dossiersApprouves: DossierApprouve[]; financements: Financement[];
  decaissements: Decaissement[]; recouvrements: Recouvrement[];
}

function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("fr-FR");
}

function MissionLink({ base, financementId, dossierICId, count }: { base: string; financementId?: number; dossierICId?: number; count: number }) {
  const params = new URLSearchParams();
  if (financementId) params.set("financementId", String(financementId));
  if (dossierICId) params.set("dossierICId", String(dossierICId));
  return (
    <Link href={`${base}?${params.toString()}`}
      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 shrink-0">
      <FileSearch className="w-3.5 h-3.5" /> {count > 0 ? `${count} mission(s)` : "Ouvrir une mission"}
    </Link>
  );
}

export default function AuditFluxPage() {
  const { type } = useParams() as { type: string };
  const { data, loading, refetch } = useApi<Data>("/api/admin/ria/commissions/gouvernance/audit-flux");

  if (type !== "audit-controle") return (
    <div className="p-6 text-center text-slate-400 text-sm">Section réservée à la Commission Audit & Contrôle.</div>
  );

  const missionsBase = `/dashboard/admin/ria/gouvernance/commissions/${type}/missions`;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Flux entrant</h1>
          <p className="text-sm text-slate-500">Reçu automatiquement : dossiers approuvés, financements, décaissements, recouvrements</p>
        </div>
        <button onClick={() => refetch()} className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-violet-600" /> Dossiers approuvés ({data.dossiersApprouves.length})</h2>
            <div className="space-y-2">
              {data.dossiersApprouves.map(d => (
                <div key={d.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{d.reference}</span>
                    <span className="text-slate-700">{d.titre}</span>
                    {d.montantApprouve && <span className="text-slate-500 ml-2">{fmt(d.montantApprouve)} FCFA</span>}
                  </div>
                  <MissionLink base={missionsBase} dossierICId={d.id} count={d._count.missionsAudit} />
                </div>
              ))}
              {data.dossiersApprouves.length === 0 && <p className="text-xs text-slate-400">Aucun dossier approuvé</p>}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" /> Financements réalisés ({data.financements.length})</h2>
            <div className="space-y-2">
              {data.financements.map(f => (
                <div key={f.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-mono text-xs text-slate-400 mr-2">{f.reference}</span>
                    <span className="text-slate-700">{f.client.prenom} {f.client.nom}</span>
                    <span className="text-slate-500 ml-2">{fmt(f.montantFinance)} FCFA</span>
                  </div>
                  <MissionLink base={missionsBase} financementId={f.id} count={f._count.missionsAudit} />
                </div>
              ))}
              {data.financements.length === 0 && <p className="text-xs text-slate-400">Aucun financement</p>}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-rose-600" /> Décaissements ({data.decaissements.length})</h2>
            <div className="space-y-2">
              {data.decaissements.map(m => (
                <div key={m.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <div>
                    {m.financement && <span className="font-mono text-xs text-slate-400 mr-2">{m.financement.reference}</span>}
                    <span className="text-slate-700">{m.description ?? "Décaissement"}</span>
                    <span className="text-slate-500 ml-2">{fmt(m.montant)} FCFA</span>
                  </div>
                  {m.financement && <MissionLink base={missionsBase} financementId={m.financement.id} count={0} />}
                </div>
              ))}
              {data.decaissements.length === 0 && <p className="text-xs text-slate-400">Aucun décaissement</p>}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-blue-600" /> Recouvrements ({data.recouvrements.length})</h2>
            <div className="space-y-2">
              {data.recouvrements.map(r => (
                <div key={r.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <div>
                    {r.financement && <span className="font-mono text-xs text-slate-400 mr-2">{r.financement.reference}</span>}
                    {r.financement && <span className="text-slate-700">{r.financement.client.prenom} {r.financement.client.nom}</span>}
                    <span className="text-slate-500 ml-2">{fmt(r.montant)} FCFA</span>
                  </div>
                  {r.financement && <MissionLink base={missionsBase} financementId={r.financement.id} count={0} />}
                </div>
              ))}
              {data.recouvrements.length === 0 && <p className="text-xs text-slate-400">Aucun recouvrement</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
