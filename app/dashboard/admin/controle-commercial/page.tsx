"use client";

import { useState } from "react";
import { toast } from "sonner";
import RetourLien from "@/components/RetourLien";
import {
  TrendingUp, ShoppingCart, Users, Package, Store, CreditCard, Wallet,
  AlertTriangle, PhoneCall, PackageX, MessageSquareWarning, RefreshCw, BarChart3, Gauge, FileSpreadsheet, FileText,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import KpiCard from "@/components/ui/KpiCard";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { exportMultiSheetXlsx, type XlsxSheetSpec } from "@/lib/exportXlsx";
import { printToPdf, tableHtml, kpisHtml } from "@/lib/exportPdf";

/** Contrôle commercial & reporting (CDC digitalisation §5.9). */

type Periode = "jour" | "semaine" | "mois";
type Vue = "dashboard" | "ventes" | "agents" | "produits" | "agences" | "credit" | "encaissements" | "impayes" | "recouvrement" | "retours" | "reclamations" | "performances";

const TABS: { key: Vue; label: string; icon: typeof TrendingUp }[] = [
  { key: "dashboard", label: "Tableau de bord", icon: BarChart3 },
  { key: "ventes", label: "Ventes", icon: TrendingUp },
  { key: "agents", label: "Par agent", icon: Users },
  { key: "produits", label: "Par produit", icon: Package },
  { key: "agences", label: "Par agence", icon: Store },
  { key: "credit", label: "Ventes à crédit", icon: CreditCard },
  { key: "encaissements", label: "Encaissements", icon: Wallet },
  { key: "impayes", label: "Impayés", icon: AlertTriangle },
  { key: "recouvrement", label: "Recouvrement", icon: PhoneCall },
  { key: "retours", label: "Retours", icon: PackageX },
  { key: "reclamations", label: "Réclamations", icon: MessageSquareWarning },
  { key: "performances", label: "Performances", icon: Gauge },
];

interface PDV { id: number; nom: string; code: string }

const PERIODE_LABEL: Record<Periode, string> = { jour: "Jour", semaine: "Semaine", mois: "Mois" };

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function ControleCommercialPage() {
  const [tab, setTab] = useState<Vue>("dashboard");
  const [periode, setPeriode] = useState<Periode>("jour");
  const [date, setDate] = useState(todayIso());
  const [pointDeVenteId, setPointDeVenteId] = useState("");

  const params = new URLSearchParams({ vue: tab, periode, date });
  if (pointDeVenteId) params.set("pointDeVenteId", pointDeVenteId);

  const { data, loading, refetch } = useApi<{ data: unknown; plage: { debut: string; fin: string }; pdvs: PDV[]; vue: Vue }>(
    `/api/admin/controle-commercial?${params.toString()}`
  );
  const pdvs = data?.pdvs ?? [];
  // Le payload en cache peut encore correspondre à l'onglet précédent le temps
  // qu'un changement d'onglet déclenche le refetch (useApi ne vide pas `data`
  // à chaque changement d'URL) — sans ce garde-fou, VueVentes/VueAgents/etc.
  // reçoivent la forme de données d'un autre onglet et plantent sur un .map.
  // Même chose pour la période/date/agence : tant que `loading` est vrai, `data`
  // correspond encore à l'ancien filtre → on affiche le spinner plutôt que des
  // chiffres périmés qui donnent l'impression que le filtre n'agit pas.
  const dataPret = !!data && data.vue === tab && !loading;

  // ── Export Excel / PDF de la vue affichée ───────────────────────────────
  const libelleVue = TABS.find((t) => t.key === tab)?.label ?? "";
  const filtresExport = (): [string, string][] => {
    const agence = pdvs.find((p) => String(p.id) === pointDeVenteId);
    return [
      ["Vue", libelleVue],
      // L'onglet Impayés liste toutes les échéances en retard, quelle que soit la période.
      ["Période", tab === "impayes" ? "Toutes les échéances en retard" : PERIODE_LABEL[periode]],
      ...(tab === "impayes" || !data?.plage ? [] : [["Du", formatDateShort(data.plage.debut)], ["Au", formatDateShort(data.plage.fin)]] as [string, string][]),
      ["Agence", agence ? `${agence.nom} (${agence.code})` : "Toutes les agences"],
    ];
  };

  async function exporterExcel() {
    if (!dataPret || !data) return;
    const m = modeleExport(tab, data.data);
    const feuilles: XlsxSheetSpec[] = [
      { sheetName: "Filtres", kind: "matrix", rows: [["Filtre", "Valeur"], ...filtresExport()] },
      ...(m.kpis.length ? [{ sheetName: "Indicateurs", kind: "matrix" as const, columnTypes: [undefined, "number", undefined] as ("number" | undefined)[],
        rows: [["Indicateur", "Valeur", "Unité"], ...m.kpis.map((x) => [x.label, x.valeur, x.unite])] }] : []),
      ...m.tables.map((t): XlsxSheetSpec => ({ sheetName: nomOnglet(t.titre), kind: "matrix", columnTypes: t.types.map((c) => (c === "text" ? undefined : c)),
        rows: [t.headers, ...t.rows.map((r) => r.map((c, i) => (t.types[i] === "date" ? new Date(String(c)) : c)))] })),
    ];
    if (feuilles.every((f) => f.sheetName === "Filtres" || f.rows.length <= 1)) { toast.info("Aucune donnée à exporter sur cette période."); return; }
    await exportMultiSheetXlsx(feuilles, `controle-commercial-${tab}-${todayIso()}.xlsx`);
  }

  function exporterPdf() {
    if (!dataPret || !data) return;
    const m = modeleExport(tab, data.data);
    printToPdf(`Contrôle commercial — ${libelleVue}`, [
      { content: `<p class="meta">${filtresExport().map(([a, b]) => `${a} : ${b}`).join(" · ")}</p>` },
      ...(m.kpis.length ? [{ content: kpisHtml(m.kpis.map((x) => ({ label: x.label, value: valeurKpi(x) }))) }] : []),
      ...m.tables.map((t) => ({
        heading: t.titre,
        content: t.rows.length
          ? tableHtml(t.headers, t.rows.map((r) => r.map((c, i) => valeurCellule(c, t.types[i]))))
          : "<p>Aucune donnée sur cette période.</p>",
      })),
    ]);
  }

  return (
    <div className="md:p-6 max-w-6xl mx-auto space-y-4">
      <RetourLien />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Contrôle commercial & reporting</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pilotage de l&apos;activité commerciale : ventes, encaissements, crédits, impayés, retours et réclamations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon={<FileSpreadsheet size={15} />} onClick={exporterExcel} disabled={!dataPret} title="Exporter la vue affichée en Excel">Excel</Button>
          <Button variant="secondary" size="sm" icon={<FileText size={15} />} onClick={exporterPdf} disabled={!dataPret} title="Exporter la vue affichée en PDF">PDF</Button>
          <Button variant="ghost" size="sm" onClick={refetch} loading={loading} className="!p-2.5 border border-slate-200 dark:border-slate-700" icon={<RefreshCw size={16} />} title="Rafraîchir" />
        </div>
      </div>

      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
            {(["jour", "semaine", "mois"] as Periode[]).map((p) => (
              <button key={p} onClick={() => setPeriode(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periode === p ? "bg-primary-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                {PERIODE_LABEL[p]}
              </button>
            ))}
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm" />
          <select value={pointDeVenteId} onChange={(e) => setPointDeVenteId(e.target.value)}
            className="max-w-full min-w-0 px-3 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm">
            <option value="">Toutes les agences</option>
            {pdvs.map((p) => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
          </select>
          {data?.plage && (
            <span className="text-xs text-slate-400 ml-auto">
              {formatDateShort(data.plage.debut)} → {formatDateShort(data.plage.fin)}
            </span>
          )}
        </div>
      </Card>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${tab === t.key ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {!dataPret && (
        <div className="flex items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <RefreshCw size={20} className="animate-spin mr-2" /> Chargement…
        </div>
      )}

      {dataPret && data && (
        <>
          {tab === "dashboard" && <VueDashboard d={data.data as DashboardData} />}
          {tab === "ventes" && <VueVentes d={data.data as VentesData} />}
          {tab === "agents" && <VueAgents d={data.data as AgentLigne[]} />}
          {tab === "produits" && <VueProduits d={data.data as ProduitLigne[]} />}
          {tab === "agences" && <VueAgences d={data.data as AgenceLigne[]} />}
          {tab === "credit" && <VueCredit d={data.data as CreditData} />}
          {tab === "encaissements" && <VueEncaissements d={data.data as EncaissementsData} />}
          {tab === "impayes" && <VueImpayes d={data.data as ImpayesData} />}
          {tab === "recouvrement" && <VueRecouvrement d={data.data as RecouvrementData} />}
          {tab === "retours" && <VueRetours d={data.data as RetoursData} />}
          {tab === "reclamations" && <VueReclamations d={data.data as ReclamationsData} />}
          {tab === "performances" && <VuePerformances d={data.data as PerformancesData} />}
        </>
      )}
    </div>
  );
}

// ── Types de données par vue ─────────────────────────────────────────────

interface VentesData { nombreVentes: number; ca: number; encaisse: number; panierMoyen: number; parJour: { jour: string; ca: number; nombre: number }[] }
interface AgentLigne { agentId: number; agent: { nom: string; prenom: string } | null; nombreVentes: number; ca: number }
interface ProduitLigne { produitId: number | null; nom: string; codeProduit: string | null; quantite: number; montant: number }
interface AgenceLigne { pointDeVenteId: number; pointDeVente: { nom: string; code: string } | null; nombreVentes: number; ca: number }
interface CreditData { nombreVentesCredit: number; caCredit: number; nouveauxCredits: number; montantNouveauxCredits: number; montantRembourseSurNouveaux: number; soldeRestantSurNouveaux: number }
interface EncaissementsData { totalEncaisse: number; encaisseVentes: number; parModePaiementVentes: { mode: string; montant: number }[]; encaisseRemboursementsCredit: number; nombreRemboursementsCredit: number }
interface ImpayesData { nombreEcheancesEnRetard: number; montantTotalDu: number; penalitesTotal: number; parClient: { client: { nom: string; prenom: string; telephone: string | null }; nombreEcheances: number; montantDu: number; penalites: number }[] }
interface RecouvrementData { nombreActions: number; parType: { type: string; nombre: number }[]; parStatut: { statut: string; nombre: number }[] }
interface RetoursData { nombreRetours: number; quantiteTotale: number; parStatut: { statut: string; nombre: number }[] }
interface ReclamationsData { nombreReclamations: number; parStatut: { statut: string; nombre: number }[]; parType: { type: string; nombre: number }[] }
interface PerformancesData { ca: number; nombreVentes: number; panierMoyen: number; tauxCredit: number; tauxRetour: number; tauxReclamation: number }
interface DashboardData {
  ventes: VentesData; credit: CreditData; encaissements: EncaissementsData;
  impayes: ImpayesData; recouvrement: RecouvrementData; retours: RetoursData; reclamations: ReclamationsData;
}

// ── Export Excel / PDF ────────────────────────────────────────────────────
// Chaque vue est décrite une fois pour l'export : indicateurs (valeur numérique + unité, pour Excel
// exploitable) et tableaux typés (mêmes libellés que l'écran).

type Unite = "FCFA" | "%" | "";
type TypeCol = "text" | "number" | "currency" | "date";
interface ExportKpi { label: string; valeur: number; unite: Unite }
interface ExportTable { titre: string; headers: string[]; types: TypeCol[]; rows: (string | number)[][] }
interface ExportModele { kpis: ExportKpi[]; tables: ExportTable[] }

const k = (label: string, valeur: number, unite: Unite = ""): ExportKpi => ({ label, valeur, unite });
const nomComplet = (p: { prenom: string; nom: string } | null | undefined, repli: string) => (p ? `${p.prenom} ${p.nom}` : repli);

function modeleExport(vue: Vue, brut: unknown): ExportModele {
  switch (vue) {
    case "dashboard": {
      const d = brut as DashboardData;
      return { tables: [], kpis: [
        k("Chiffre d'affaires", d.ventes.ca, "FCFA"), k("Nombre de ventes", d.ventes.nombreVentes), k("Panier moyen", d.ventes.panierMoyen, "FCFA"),
        k("Total encaissé", d.encaissements.totalEncaisse, "FCFA"), k("Ventes à crédit", d.credit.caCredit, "FCFA"),
        k("Impayés (montant dû)", d.impayes.montantTotalDu, "FCFA"), k("Échéances en retard", d.impayes.nombreEcheancesEnRetard),
        k("Actions de recouvrement", d.recouvrement.nombreActions), k("Retours marchandise", d.retours.nombreRetours),
        k("Réclamations", d.reclamations.nombreReclamations),
      ] };
    }
    case "ventes": {
      const d = brut as VentesData;
      return {
        kpis: [k("Chiffre d'affaires", d.ca, "FCFA"), k("Nombre de ventes", d.nombreVentes), k("Panier moyen", d.panierMoyen, "FCFA"), k("Encaissé", d.encaisse, "FCFA")],
        tables: [{ titre: "Détail par jour", headers: ["Jour", "Ventes", "CA"], types: ["date", "number", "currency"], rows: d.parJour.map((j) => [j.jour, j.nombre, j.ca]) }],
      };
    }
    case "agents": {
      const d = brut as AgentLigne[];
      return { kpis: [], tables: [{ titre: "Ventes par agent", headers: ["Agent", "Ventes", "CA"], types: ["text", "number", "currency"], rows: d.map((a) => [nomComplet(a.agent, `#${a.agentId}`), a.nombreVentes, a.ca]) }] };
    }
    case "produits": {
      const d = brut as ProduitLigne[];
      return { kpis: [], tables: [{ titre: "Ventes par produit", headers: ["Produit", "Code", "Quantité", "Montant"], types: ["text", "text", "number", "currency"], rows: d.map((p) => [p.nom, p.codeProduit ?? "", p.quantite, p.montant]) }] };
    }
    case "agences": {
      const d = brut as AgenceLigne[];
      return { kpis: [], tables: [{ titre: "Ventes par agence", headers: ["Agence", "Code", "Ventes", "CA"], types: ["text", "text", "number", "currency"], rows: d.map((a) => [a.pointDeVente?.nom ?? `#${a.pointDeVenteId}`, a.pointDeVente?.code ?? "", a.nombreVentes, a.ca]) }] };
    }
    case "credit": {
      const d = brut as CreditData;
      return { tables: [], kpis: [
        k("Ventes réglées à crédit", d.caCredit, "FCFA"), k("Nombre de ventes à crédit", d.nombreVentesCredit), k("Nouveaux crédits ouverts", d.nouveauxCredits),
        k("Montant des nouveaux crédits", d.montantNouveauxCredits, "FCFA"), k("Déjà remboursé (nouveaux)", d.montantRembourseSurNouveaux, "FCFA"),
        k("Solde restant (nouveaux)", d.soldeRestantSurNouveaux, "FCFA"),
      ] };
    }
    case "encaissements": {
      const d = brut as EncaissementsData;
      return {
        kpis: [k("Total encaissé", d.totalEncaisse, "FCFA"), k("Encaissé sur ventes", d.encaisseVentes, "FCFA"), k("Remboursements crédit encaissés", d.encaisseRemboursementsCredit, "FCFA"), k("Nombre de remboursements", d.nombreRemboursementsCredit)],
        tables: [{ titre: "Par mode de paiement", headers: ["Mode", "Montant"], types: ["text", "currency"], rows: d.parModePaiementVentes.map((m) => [m.mode, m.montant]) }],
      };
    }
    case "impayes": {
      const d = brut as ImpayesData;
      return {
        kpis: [k("Échéances en retard", d.nombreEcheancesEnRetard), k("Montant total dû", d.montantTotalDu, "FCFA"), k("Pénalités cumulées", d.penalitesTotal, "FCFA")],
        tables: [{ titre: "Impayés par client", headers: ["Client", "Téléphone", "Échéances", "Montant dû", "Pénalités"], types: ["text", "text", "number", "currency", "currency"],
          rows: d.parClient.map((c) => [nomComplet(c.client, "—"), c.client.telephone ?? "", c.nombreEcheances, c.montantDu, c.penalites]) }],
      };
    }
    case "recouvrement": {
      const d = brut as RecouvrementData;
      return {
        kpis: [k("Actions de recouvrement", d.nombreActions)],
        tables: [
          { titre: "Par type d'action", headers: ["Type", "Nombre"], types: ["text", "number"], rows: d.parType.map((t) => [t.type, t.nombre]) },
          { titre: "Par statut", headers: ["Statut", "Nombre"], types: ["text", "number"], rows: d.parStatut.map((s) => [s.statut, s.nombre]) },
        ],
      };
    }
    case "retours": {
      const d = brut as RetoursData;
      return {
        kpis: [k("Retours marchandise", d.nombreRetours), k("Articles retournés", d.quantiteTotale)],
        tables: [{ titre: "Par statut", headers: ["Statut", "Nombre"], types: ["text", "number"], rows: d.parStatut.map((s) => [s.statut, s.nombre]) }],
      };
    }
    case "reclamations": {
      const d = brut as ReclamationsData;
      return {
        kpis: [k("Réclamations", d.nombreReclamations)],
        tables: [
          { titre: "Par statut", headers: ["Statut", "Nombre"], types: ["text", "number"], rows: d.parStatut.map((s) => [s.statut, s.nombre]) },
          { titre: "Par type", headers: ["Type", "Nombre"], types: ["text", "number"], rows: d.parType.map((t) => [t.type, t.nombre]) },
        ],
      };
    }
    case "performances": {
      const d = brut as PerformancesData;
      return { tables: [], kpis: [
        k("Chiffre d'affaires", d.ca, "FCFA"), k("Nombre de ventes", d.nombreVentes), k("Panier moyen", d.panierMoyen, "FCFA"),
        k("Taux de vente à crédit", Number(d.tauxCredit.toFixed(1)), "%"), k("Taux de retour", Number(d.tauxRetour.toFixed(1)), "%"),
        k("Taux de réclamation", Number(d.tauxReclamation.toFixed(1)), "%"),
      ] };
    }
  }
}

const valeurKpi = (x: ExportKpi) =>
  x.unite === "FCFA" ? formatCurrency(x.valeur) : x.unite === "%" ? `${x.valeur.toFixed(1)} %` : x.valeur.toLocaleString("fr-FR");

const valeurCellule = (v: string | number, type: TypeCol) =>
  type === "currency" ? formatCurrency(Number(v)) : type === "date" ? formatDateShort(String(v)) : type === "number" ? Number(v).toLocaleString("fr-FR") : String(v);

/** Nom d'onglet Excel valide (31 caractères max, sans \ / ? * [ ] :). */
const nomOnglet = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

// ── Rendus par vue ────────────────────────────────────────────────────────

function VueDashboard({ d }: { d: DashboardData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard label="Chiffre d'affaires" value={d.ventes.ca} format={formatCurrency} icon={<TrendingUp size={20} />} accent="primary" sub={`${d.ventes.nombreVentes} vente(s)`} />
      <KpiCard label="Panier moyen" value={d.ventes.panierMoyen} format={formatCurrency} icon={<ShoppingCart size={20} />} accent="teal" />
      <KpiCard label="Total encaissé" value={d.encaissements.totalEncaisse} format={formatCurrency} icon={<Wallet size={20} />} accent="success" />
      <KpiCard label="Ventes à crédit" value={d.credit.caCredit} format={formatCurrency} icon={<CreditCard size={20} />} accent="purple" sub={`${d.credit.nombreVentesCredit} vente(s)`} />
      <KpiCard label="Impayés (échéances en retard)" value={d.impayes.montantTotalDu} format={formatCurrency} icon={<AlertTriangle size={20} />} accent="error" sub={`${d.impayes.nombreEcheancesEnRetard} échéance(s)`} />
      <KpiCard label="Actions de recouvrement" value={d.recouvrement.nombreActions} icon={<PhoneCall size={20} />} accent="warning" />
      <KpiCard label="Retours marchandise" value={d.retours.nombreRetours} icon={<PackageX size={20} />} accent="neutral" sub={`${d.retours.quantiteTotale} article(s)`} />
      <KpiCard label="Réclamations" value={d.reclamations.nombreReclamations} icon={<MessageSquareWarning size={20} />} accent="brand" />
    </div>
  );
}

function VueVentes({ d }: { d: VentesData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Chiffre d'affaires" value={d.ca} format={formatCurrency} icon={<TrendingUp size={20} />} accent="primary" />
        <KpiCard label="Nombre de ventes" value={d.nombreVentes} icon={<ShoppingCart size={20} />} accent="teal" />
        <KpiCard label="Panier moyen" value={d.panierMoyen} format={formatCurrency} icon={<ShoppingCart size={20} />} accent="success" />
        <KpiCard label="Encaissé" value={d.encaisse} format={formatCurrency} icon={<Wallet size={20} />} accent="purple" />
      </div>
      <Card title="Détail par jour">
        <Table headers={["Jour", "Ventes", "CA"]} rows={d.parJour.map((j) => [formatDateShort(j.jour), String(j.nombre), formatCurrency(j.ca)])} />
      </Card>
    </div>
  );
}

function VueAgents({ d }: { d: AgentLigne[] }) {
  return (
    <Card title="Ventes par agent">
      <Table headers={["Agent", "Ventes", "CA"]} rows={d.map((a) => [a.agent ? `${a.agent.prenom} ${a.agent.nom}` : `#${a.agentId}`, String(a.nombreVentes), formatCurrency(a.ca)])} />
    </Card>
  );
}

function VueProduits({ d }: { d: ProduitLigne[] }) {
  return (
    <Card title="Ventes par produit">
      <Table headers={["Produit", "Quantité", "Montant"]} rows={d.map((p) => [p.nom + (p.codeProduit ? ` (${p.codeProduit})` : ""), String(p.quantite), formatCurrency(p.montant)])} />
    </Card>
  );
}

function VueAgences({ d }: { d: AgenceLigne[] }) {
  return (
    <Card title="Ventes par agence">
      <Table headers={["Agence", "Ventes", "CA"]} rows={d.map((a) => [a.pointDeVente ? `${a.pointDeVente.nom} (${a.pointDeVente.code})` : `#${a.pointDeVenteId}`, String(a.nombreVentes), formatCurrency(a.ca)])} />
    </Card>
  );
}

function VueCredit({ d }: { d: CreditData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <KpiCard label="Ventes réglées à crédit" value={d.caCredit} format={formatCurrency} icon={<CreditCard size={20} />} accent="purple" sub={`${d.nombreVentesCredit} vente(s)`} />
      <KpiCard label="Nouveaux crédits ouverts" value={d.nouveauxCredits} icon={<CreditCard size={20} />} accent="primary" />
      <KpiCard label="Montant des nouveaux crédits" value={d.montantNouveauxCredits} format={formatCurrency} icon={<Wallet size={20} />} accent="teal" />
      <KpiCard label="Déjà remboursé (nouveaux)" value={d.montantRembourseSurNouveaux} format={formatCurrency} icon={<Wallet size={20} />} accent="success" />
      <KpiCard label="Solde restant (nouveaux)" value={d.soldeRestantSurNouveaux} format={formatCurrency} icon={<AlertTriangle size={20} />} accent="warning" />
    </div>
  );
}

function VueEncaissements({ d }: { d: EncaissementsData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total encaissé" value={d.totalEncaisse} format={formatCurrency} icon={<Wallet size={20} />} accent="success" />
        <KpiCard label="Encaissé sur ventes" value={d.encaisseVentes} format={formatCurrency} icon={<ShoppingCart size={20} />} accent="primary" />
        <KpiCard label="Remboursements crédit encaissés" value={d.encaisseRemboursementsCredit} format={formatCurrency} icon={<CreditCard size={20} />} accent="purple" sub={`${d.nombreRemboursementsCredit} remboursement(s)`} />
      </div>
      <Card title="Répartition par mode de paiement (ventes)">
        <Table headers={["Mode", "Montant"]} rows={d.parModePaiementVentes.map((m) => [m.mode, formatCurrency(m.montant)])} />
      </Card>
    </div>
  );
}

function VueImpayes({ d }: { d: ImpayesData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Échéances en retard" value={d.nombreEcheancesEnRetard} icon={<AlertTriangle size={20} />} accent="error" />
        <KpiCard label="Montant total dû" value={d.montantTotalDu} format={formatCurrency} icon={<Wallet size={20} />} accent="error" />
        <KpiCard label="Pénalités cumulées" value={d.penalitesTotal} format={formatCurrency} icon={<AlertTriangle size={20} />} accent="warning" />
      </div>
      <Card title="État des impayés par client">
        <Table headers={["Client", "Téléphone", "Échéances", "Montant dû", "Pénalités"]}
          rows={d.parClient.map((c) => [`${c.client.prenom} ${c.client.nom}`, c.client.telephone ?? "—", String(c.nombreEcheances), formatCurrency(c.montantDu), formatCurrency(c.penalites)])} />
      </Card>
    </div>
  );
}

function VueRecouvrement({ d }: { d: RecouvrementData }) {
  return (
    <div className="space-y-4">
      <KpiCard label="Actions de recouvrement" value={d.nombreActions} icon={<PhoneCall size={20} />} accent="warning" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Par type d'action"><Table headers={["Type", "Nombre"]} rows={d.parType.map((t) => [t.type, String(t.nombre)])} /></Card>
        <Card title="Par statut"><Table headers={["Statut", "Nombre"]} rows={d.parStatut.map((s) => [s.statut, String(s.nombre)])} /></Card>
      </div>
    </div>
  );
}

function VueRetours({ d }: { d: RetoursData }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Retours marchandise" value={d.nombreRetours} icon={<PackageX size={20} />} accent="neutral" />
        <KpiCard label="Articles retournés" value={d.quantiteTotale} icon={<Package size={20} />} accent="neutral" />
      </div>
      <Card title="Par statut"><Table headers={["Statut", "Nombre"]} rows={d.parStatut.map((s) => [s.statut, String(s.nombre)])} /></Card>
    </div>
  );
}

function VueReclamations({ d }: { d: ReclamationsData }) {
  return (
    <div className="space-y-4">
      <KpiCard label="Réclamations" value={d.nombreReclamations} icon={<MessageSquareWarning size={20} />} accent="brand" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Par statut"><Table headers={["Statut", "Nombre"]} rows={d.parStatut.map((s) => [s.statut, String(s.nombre)])} /></Card>
        <Card title="Par type"><Table headers={["Type", "Nombre"]} rows={d.parType.map((t) => [t.type, String(t.nombre)])} /></Card>
      </div>
    </div>
  );
}

function VuePerformances({ d }: { d: PerformancesData }) {
  const fmtPct = (n: number) => `${n.toFixed(1)} %`;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <KpiCard label="Chiffre d'affaires" value={d.ca} format={formatCurrency} icon={<TrendingUp size={20} />} accent="primary" />
      <KpiCard label="Nombre de ventes" value={d.nombreVentes} icon={<ShoppingCart size={20} />} accent="teal" />
      <KpiCard label="Panier moyen" value={d.panierMoyen} format={formatCurrency} icon={<ShoppingCart size={20} />} accent="success" />
      <KpiCard label="Taux de vente à crédit" value={d.tauxCredit} format={fmtPct} icon={<CreditCard size={20} />} accent="purple" />
      <KpiCard label="Taux de retour" value={d.tauxRetour} format={fmtPct} icon={<PackageX size={20} />} accent="warning" />
      <KpiCard label="Taux de réclamation" value={d.tauxReclamation} format={fmtPct} icon={<MessageSquareWarning size={20} />} accent="brand" />
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-slate-400 italic">Aucune donnée sur cette période.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 dark:border-slate-700">
            {headers.map((h) => <th key={h} className="pb-2 pr-4 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
              {r.map((c, j) => <td key={j} className="py-2 pr-4 text-slate-700 dark:text-slate-200">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
