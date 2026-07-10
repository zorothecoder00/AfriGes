"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Boxes, Pencil, Info, Tag, MapPin, DollarSign, History as HistoryIcon,
  Package, Barcode, QrCode, Truck, PackageCheck, Repeat,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { TYPE_PRIX_LABEL } from "@/lib/tarificationLabels";
import HistoriquePrixProduit from "@/components/HistoriquePrixProduit";
import LotsProduit from "@/components/catalogue/LotsProduit";
import SubstitutsProduit from "@/components/catalogue/SubstitutsProduit";
import ProduitFormModal, { type Referentiels } from "@/components/catalogue/ProduitFormModal";

interface Ref { id: number; nom: string; symbole?: string }
interface Fiche {
  id: number; codeProduit: string | null; reference: string | null; nom: string; nomCommercial: string | null;
  description: string | null; statut: string; prixUnitaire: number; prixAchat: number | null; alerteStock: number;
  codeBarre: string | null; qrCode: string | null; paysOrigine: string | null;
  poids: number | null; volume: number | null; dimensions: string | null; couleur: string | null; saveur: string | null;
  conditionnement: string | null; imagePrincipaleUrl: string | null; imagesSecondaires: string[];
  ficheTechniqueUrl: string | null; videoUrl: string | null;
  famille: Ref | null; sousFamille: Ref | null; categorieProduit: Ref | null; sousCategorie: Ref | null;
  marque: Ref | null; fournisseurPrincipal: Ref | null; uniteVente: Ref | null; uniteAchat: Ref | null;
  _count: { historiquePrix: number };
}
interface PrixLigne {
  id: number; type: string; montant: number; devise: string; portee: string; auto: boolean; actif: boolean;
  ville: string | null; region: string | null; dateDebut: string | null; dateFin: string | null;
  pointDeVente: { id: number; nom: string } | null;
}
interface TableauPrix {
  types: { type: string; label: string }[];
  global: Record<string, number | null>;
  agences: { id: number; nom: string; type: string; prix: Record<string, number | null> }[];
}
interface Dispo {
  pointDeVenteId: number; agence: string; type: string; disponible: boolean; quantite: number; reserve: number;
  enTransit: number; endommage: number; stockMin: number | null; stockMax: number | null; seuilCritique: number | null;
  rayon: string | null; etagere: string | null; allee: string | null; configure: boolean;
  etat: { niveau: string; couleur: string; label: string };
}
interface PromoRow {
  id: number; code: string; nom: string; cible: string; typeRemise: string; remise: string;
  segment: string | null; dateDebut: string; dateFin: string; statut: string;
  pointDeVente: { id: number; nom: string } | null; client: { id: number; nom: string; prenom: string } | null;
}

const STATUT_STYLE: Record<string, string> = {
  ACTIF: "bg-emerald-100 text-emerald-700 border-emerald-200",
  EN_ATTENTE: "bg-amber-100 text-amber-700 border-amber-200",
  SUSPENDU: "bg-orange-100 text-orange-700 border-orange-200",
  MASQUE: "bg-slate-100 text-slate-500 border-slate-200",
  ARCHIVE: "bg-gray-100 text-gray-400 border-gray-200",
};
const COULEUR_DOT: Record<string, string> = { rouge: "bg-rose-500", orange: "bg-amber-500", vert: "bg-emerald-500" };
const PROMO_STYLE: Record<string, string> = {
  EN_COURS: "bg-emerald-100 text-emerald-700", PROGRAMMEE: "bg-blue-100 text-blue-700",
  EXPIREE: "bg-gray-100 text-gray-400", INACTIVE: "bg-slate-100 text-slate-500",
};
const PORTEE_LABEL: Record<string, string> = { GLOBAL: "Global", AGENCE: "Agence", VILLE: "Ville", REGION: "Région" };

type Tab = "infos" | "prix" | "dispo" | "lots" | "substituts" | "promos" | "historique";

function Ligne({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-800 text-right">{value}</span>
    </div>
  );
}

export default function FicheProduitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("infos");
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [prix, setPrix] = useState<PrixLigne[]>([]);
  const [tableau, setTableau] = useState<TableauPrix | null>(null);
  const [dispo, setDispo] = useState<Dispo[]>([]);
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refs, setRefs] = useState<Referentiels | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rF, rP, rT, rD, rPr] = await Promise.all([
        fetch(`/api/admin/catalogue/produits/${id}`),
        fetch(`/api/admin/catalogue/produits/${id}/prix`),
        fetch(`/api/admin/catalogue/produits/${id}/tableau-prix`),
        fetch(`/api/admin/catalogue/produits/${id}/disponibilite`),
        fetch(`/api/admin/catalogue/produits/${id}/promotions`),
      ]);
      const jF = await rF.json();
      if (!rF.ok) throw new Error(jF.message ?? "Produit introuvable");
      setFiche(jF.data);
      setPrix((await rP.json()).data ?? []);
      setTableau((await rT.json()).data ?? null);
      setDispo((await rD.json()).data ?? []);
      setPromos((await rPr.json()).data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/catalogue/referentiels").then((r) => r.json()).then((j) => setRefs(j.data)).catch(() => {});
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement…</div>;
  }
  if (!fiche) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Produit introuvable.</div>;
  }

  const marge = fiche.prixAchat != null ? fiche.prixUnitaire - fiche.prixAchat : null;
  const margeTaux = fiche.prixAchat != null && fiche.prixAchat > 0 ? (marge! / fiche.prixAchat) * 100 : null;
  const classification = [fiche.famille?.nom, fiche.sousFamille?.nom, fiche.categorieProduit?.nom, fiche.sousCategorie?.nom, fiche.marque?.nom].filter(Boolean).join(" · ");

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "infos", label: "Informations", icon: <Info className="w-4 h-4" /> },
    { key: "prix", label: "Prix", icon: <DollarSign className="w-4 h-4" />, count: prix.length },
    { key: "dispo", label: "Disponibilité", icon: <MapPin className="w-4 h-4" />, count: dispo.filter((d) => d.configure).length },
    { key: "lots", label: "Lots & péremption", icon: <PackageCheck className="w-4 h-4" /> },
    { key: "substituts", label: "Substituts", icon: <Repeat className="w-4 h-4" /> },
    { key: "promos", label: "Promotions", icon: <Tag className="w-4 h-4" />, count: promos.length },
    { key: "historique", label: "Historique prix", icon: <HistoryIcon className="w-4 h-4" />, count: fiche._count.historiquePrix },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Link href="/dashboard/admin/catalogue/produits" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> Retour au catalogue
        </Link>

        {/* En-tête produit */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-5 flex-wrap">
          <div className="w-24 h-24 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
            {fiche.imagePrincipaleUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={fiche.imagePrincipaleUrl} alt="" className="w-full h-full object-cover" />
              : <Boxes className="w-10 h-10 text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900">{fiche.nom}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLE[fiche.statut] ?? ""}`}>{fiche.statut}</span>
            </div>
            {fiche.nomCommercial && <p className="text-sm text-gray-500">{fiche.nomCommercial}</p>}
            <p className="text-[11px] text-gray-400 font-mono mt-1">{fiche.codeProduit ?? "—"}{fiche.reference ? ` · ${fiche.reference}` : ""}</p>
            {classification && <p className="text-xs text-gray-500 mt-1">{classification}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm">
              <Pencil className="w-4 h-4" /> Modifier
            </button>
            <div className="text-right">
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(fiche.prixUnitaire)}</p>
              {fiche.prixAchat != null && (
                <p className="text-xs text-gray-400">Achat {formatCurrency(fiche.prixAchat)}
                  {marge != null && <span className={marge >= 0 ? "text-emerald-600" : "text-rose-500"}> · marge {formatCurrency(marge)}{margeTaux != null ? ` (${Math.round(margeTaux)}%)` : ""}</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t.icon} {t.label}
              {t.count != null && t.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Onglet Informations */}
        {tab === "infos" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3"><Package className="w-4 h-4 text-blue-500" /> Identification & classification</h3>
              <Ligne label="Nom commercial" value={fiche.nomCommercial} />
              <Ligne label="Description" value={fiche.description} />
              <Ligne label="Code produit" value={fiche.codeProduit} />
              <Ligne label="Référence" value={fiche.reference} />
              <Ligne label="Code-barres" value={fiche.codeBarre && <span className="inline-flex items-center gap-1"><Barcode className="w-3.5 h-3.5" /> {fiche.codeBarre}</span>} />
              <Ligne label="QR code" value={fiche.qrCode && <span className="inline-flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> {fiche.qrCode}</span>} />
              <Ligne label="Famille" value={fiche.famille?.nom} />
              <Ligne label="Sous-famille" value={fiche.sousFamille?.nom} />
              <Ligne label="Catégorie" value={fiche.categorieProduit?.nom} />
              <Ligne label="Sous-catégorie" value={fiche.sousCategorie?.nom} />
              <Ligne label="Marque" value={fiche.marque?.nom} />
              <Ligne label="Fournisseur principal" value={fiche.fournisseurPrincipal?.nom && <span className="inline-flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> {fiche.fournisseurPrincipal.nom}</span>} />
              <Ligne label="Pays d'origine" value={fiche.paysOrigine} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-blue-500" /> Caractéristiques</h3>
              <Ligne label="Unité de vente" value={fiche.uniteVente ? `${fiche.uniteVente.nom}${fiche.uniteVente.symbole ? ` (${fiche.uniteVente.symbole})` : ""}` : null} />
              <Ligne label="Unité d'achat" value={fiche.uniteAchat ? `${fiche.uniteAchat.nom}${fiche.uniteAchat.symbole ? ` (${fiche.uniteAchat.symbole})` : ""}` : null} />
              <Ligne label="Conditionnement" value={fiche.conditionnement} />
              <Ligne label="Poids" value={fiche.poids != null ? `${fiche.poids} kg` : null} />
              <Ligne label="Volume" value={fiche.volume != null ? `${fiche.volume} L` : null} />
              <Ligne label="Dimensions" value={fiche.dimensions} />
              <Ligne label="Couleur" value={fiche.couleur} />
              <Ligne label="Saveur" value={fiche.saveur} />
              <Ligne label="Seuil d'alerte global" value={fiche.alerteStock ? `${fiche.alerteStock}` : null} />
              {fiche.imagesSecondaires?.length > 0 && (
                <div className="pt-3">
                  <p className="text-xs text-gray-400 mb-2">Images secondaires</p>
                  <div className="flex gap-2 flex-wrap">
                    {fiche.imagesSecondaires.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-100" />
                    ))}
                  </div>
                </div>
              )}
              {(fiche.ficheTechniqueUrl || fiche.videoUrl) && (
                <div className="pt-3 flex gap-3 text-sm">
                  {fiche.ficheTechniqueUrl && <a href={fiche.ficheTechniqueUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Fiche technique</a>}
                  {fiche.videoUrl && <a href={fiche.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Vidéo</a>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Prix */}
        {tab === "prix" && (
          <div className="space-y-4">
            {/* Tableau multi-agences (§11) */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Prix effectif par agence</h3>
                <p className="text-xs text-gray-400">Prix résolu pour chaque agence (spécifique agence, sinon global).</p>
              </div>
              {!tableau || tableau.types.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Aucun prix paramétré.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold sticky left-0 bg-gray-50">Agence</th>
                        {tableau.types.map((t) => <th key={t.type} className="text-right px-4 py-2.5 font-semibold whitespace-nowrap">{t.label}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr className="bg-blue-50/40 font-medium">
                        <td className="px-4 py-2.5 sticky left-0 bg-blue-50/40">Global (référence)</td>
                        {tableau.types.map((t) => <td key={t.type} className="px-4 py-2.5 text-right">{tableau.global[t.type] != null ? formatCurrency(tableau.global[t.type]!) : "—"}</td>)}
                      </tr>
                      {tableau.agences.map((a) => (
                        <tr key={a.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 sticky left-0 bg-white">{a.nom} {a.type === "DEPOT_CENTRAL" && <span className="text-[10px] text-gray-400">(dépôt)</span>}</td>
                          {tableau.types.map((t) => {
                            const v = a.prix[t.type]; const g = tableau.global[t.type];
                            const specifique = v != null && v !== g;
                            return <td key={t.type} className={`px-4 py-2.5 text-right ${specifique ? "font-semibold text-blue-700" : "text-gray-600"}`}>{v != null ? formatCurrency(v) : "—"}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Lignes de prix détaillées */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Lignes de prix</h3></div>
              {prix.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">Aucune ligne de prix.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold">Type</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Portée</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Montant</th>
                        <th className="text-center px-4 py-2.5 font-semibold">État</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {prix.map((p) => (
                        <tr key={p.id} className={p.actif ? "" : "opacity-50"}>
                          <td className="px-4 py-2.5">{TYPE_PRIX_LABEL[p.type as keyof typeof TYPE_PRIX_LABEL] ?? p.type} {p.auto && <span className="text-[9px] px-1 py-0.5 rounded bg-violet-100 text-violet-600 ml-1">AUTO</span>}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">{PORTEE_LABEL[p.portee] ?? p.portee}{p.pointDeVente ? ` · ${p.pointDeVente.nom}` : ""}{p.ville ? ` · ${p.ville}` : ""}{p.region ? ` · ${p.region}` : ""}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatCurrency(p.montant)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.actif ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>{p.actif ? "Actif" : "Inactif"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Disponibilité */}
        {tab === "dispo" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-400 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Agence</th>
                    <th className="text-center px-4 py-2.5 font-semibold">État</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Dispo.</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Réservé</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Transit</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Min/Max</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Emplacement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dispo.map((d) => (
                    <tr key={d.pointDeVenteId} className={`hover:bg-gray-50/60 ${d.configure ? "" : "opacity-50"}`}>
                      <td className="px-4 py-2.5">
                        {d.agence} {d.type === "DEPOT_CENTRAL" && <span className="text-[10px] text-gray-400">(dépôt)</span>}
                        {!d.disponible && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500 ml-1">non commercialisé</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          <span className={`w-2 h-2 rounded-full ${COULEUR_DOT[d.etat.couleur] ?? "bg-gray-300"}`} /> {d.etat.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{d.quantite}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{d.reserve}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{d.enTransit}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">{d.stockMin ?? "—"} / {d.stockMax ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{[d.rayon, d.etagere, d.allee].filter(Boolean).join(" · ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Onglet Promotions */}
        {tab === "promos" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {promos.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400"><Tag className="w-8 h-8 mx-auto mb-2 opacity-40" /> Aucune promotion ne couvre ce produit.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {promos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">{p.nom} <span className="text-[11px] text-gray-400 font-mono">{p.code}</span></p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.dateDebut).toLocaleDateString("fr-FR")} → {new Date(p.dateFin).toLocaleDateString("fr-FR")}
                        {p.pointDeVente ? ` · ${p.pointDeVente.nom}` : ""}
                        {p.segment ? ` · ${p.segment === "RIA" ? "Communauté RIA" : "Ordinaire"}` : ""}
                        {p.client ? ` · ${p.client.prenom} ${p.client.nom}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-blue-700">{p.remise}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${PROMO_STYLE[p.statut] ?? ""}`}>{p.statut.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-5 py-3 border-t border-gray-50 text-right">
              <Link href="/dashboard/admin/catalogue/promotions" className="text-sm text-blue-600 hover:underline">Gérer les promotions →</Link>
            </div>
          </div>
        )}

        {/* Onglet Lots & péremption */}
        {tab === "lots" && <LotsProduit produitId={fiche.id} />}

        {/* Onglet Substituts */}
        {tab === "substituts" && <SubstitutsProduit produitId={fiche.id} />}

        {/* Onglet Historique */}
        {tab === "historique" && <HistoriquePrixProduit produitId={fiche.id} />}
      </div>

      {editOpen && (
        <ProduitFormModal
          produitId={fiche.id}
          refs={refs}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); router.refresh(); load(); }}
        />
      )}
    </div>
  );
}
