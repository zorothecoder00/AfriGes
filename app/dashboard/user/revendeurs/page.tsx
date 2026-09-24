"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Wallet, Package, ShoppingCart, Search, RefreshCw, Printer,
  Store, Menu, X, Plus, Minus, Trash2, Loader2, Truck, FileText,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import AccountMenuButton from "@/components/AccountMenuButton";
import CongesNavButton from "@/components/CongesNavButton";
import MessagesLink from "@/components/MessagesLink";
import DashboardBackButton from "@/components/DashboardBackButton";
import SidebarLogo from "@/components/SidebarLogo";
import { useApi } from "@/hooks/useApi";
import { formatCurrency, formatDate } from "@/lib/format";

import AppLoader from "@/components/AppLoader";
interface ProfilRevendeurData {
  raisonSociale: string; nif: string | null; rccm: string | null; adresse: string | null; ville: string | null;
  contactNom: string | null; contactTelephone: string | null;
  pointDeVente: { nom: string } | null;
  user: { telephone: string | null };
}
interface CommandeRevendeurData { id: number; reference: string; statut: string; totalTTC: number | string; createdAt: string }

/**
 * Espace Revendeur (CDC digitalisation §5.6) — réécrit intégralement : la
 * version précédente appelait /api/user/credits et /api/user/creditsAlimentaires,
 * deux routes qui n'existent pas (reliquat du modèle "membre"/Wallet pré-refonte).
 * Cette version consomme les vraies routes /api/revendeur/* (profil, produits au
 * prix grille GROS, commandes, relevé de compte).
 */

interface Produit { produitId: number; nom: string; codeProduit: string | null; stock: number; prixUnitaire: number }
interface CartLigne { produitId: number; nom: string; prixUnitaire: number; quantite: number }

const STATUT_CDE_LABEL: Record<string, { label: string; badge: string }> = {
  BROUILLON: { label: "Brouillon", badge: "bg-slate-100 text-slate-600" },
  CONFIRMEE: { label: "Confirmée", badge: "bg-blue-100 text-blue-700" },
  LIVREE: { label: "Livrée", badge: "bg-emerald-100 text-emerald-700" },
  FACTUREE: { label: "Facturée", badge: "bg-purple-100 text-purple-700" },
  ANNULEE: { label: "Annulée", badge: "bg-red-100 text-red-600" },
};

export default function RevendeurPage() {
  const [activeTab, setActiveTab] = useState<"apercu" | "produits" | "commandes" | "releve">("apercu");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLigne[]>([]);

  const { data: profilData, loading: profilLoading, refetch: refetchProfil } = useApi<{ data: ProfilRevendeurData; stats: { nbFactures: number; totalFacture: number; totalPaye: number; soldeDu: number } }>("/api/revendeur/profil");
  const { data: produitsData, loading: produitsLoading, refetch: refetchProduits } = useApi<{ data: Produit[] }>(`/api/revendeur/produits${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const { data: commandesData, refetch: refetchCommandes } = useApi<{ data: CommandeRevendeurData[] }>("/api/revendeur/commandes");
  const { data: releveData } = useApi<{ data: { id: number; numero: string; statut: string; dateEmission: string; montantTTC: number; montantPaye: number }[]; stats: { nbFactures: number; totalFacture: number; totalPaye: number; soldeDu: number; premierAchat: string | null } }>("/api/revendeur/releve");

  const profil = profilData?.data;
  const stats = profilData?.stats;
  const produits = produitsData?.data ?? [];
  const commandes = commandesData?.data ?? [];

  const [submittingCommande, setSubmittingCommande] = useState(false);

  function ajouterAuPanier(p: Produit) {
    setCart((c) => {
      const existe = c.find((l) => l.produitId === p.produitId);
      if (existe) return c.map((l) => l.produitId === p.produitId ? { ...l, quantite: l.quantite + 1 } : l);
      return [...c, { produitId: p.produitId, nom: p.nom, prixUnitaire: p.prixUnitaire, quantite: 1 }];
    });
    toast.success(`${p.nom} ajouté à la commande`);
  }

  function majQuantite(produitId: number, delta: number) {
    setCart((c) => c.map((l) => l.produitId === produitId ? { ...l, quantite: Math.max(1, l.quantite + delta) } : l));
  }

  function retirerDuPanier(produitId: number) {
    setCart((c) => c.filter((l) => l.produitId !== produitId));
  }

  const totalPanier = cart.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);

  async function passerCommande() {
    if (!cart.length) return;
    setSubmittingCommande(true);
    try {
      const r = await fetch("/api/revendeur/commandes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lignes: cart.map((l) => ({ produitId: l.produitId, quantite: l.quantite })) }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || "Erreur"); return; }
      toast.success(`Commande ${j.data.reference} créée`);
      setCart([]);
      refetchCommandes();
      setActiveTab("commandes");
    } finally { setSubmittingCommande(false); }
  }

  const isLoading = profilLoading && !profilData;

  if (isLoading) {
    return (
      <AppLoader message="Chargement de votre espace…" />
    );
  }

  if (!profil) {
    return (
      <div className="min-h-screen bg-[#dbe7f5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 max-w-md text-center">
          <Store className="w-12 h-12 text-rose-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 mb-2">Compte revendeur non configuré</h2>
          <p className="text-sm text-slate-500">Votre compte n&apos;a pas encore de profil revendeur ouvert. Contactez l&apos;administrateur.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "apercu" as const, label: "Aperçu", icon: Store },
    { key: "produits" as const, label: "Produits", icon: Package },
    { key: "commandes" as const, label: `Commandes${cart.length ? ` (${cart.length})` : ""}`, icon: ShoppingCart },
    { key: "releve" as const, label: "Relevé de compte", icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-[#dbe7f5] font-['DM_Sans',sans-serif] lg:flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-rose-950 bg-gradient-to-b from-rose-800 to-rose-950 text-white flex flex-col transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:flex-shrink-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {/* Logo centré — la sidebar occupe toute la hauteur de l'écran et porte le logo */}
        <div className="flex-shrink-0 flex justify-center bg-white border-b border-white/10 py-2">
          <SidebarLogo className="h-36" />
        </div>
        <div className="h-16 flex items-center justify-between gap-3 px-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">

            <DashboardBackButton />
            <h1 className="text-base font-bold truncate flex items-center gap-2"><Store size={18} className="text-white/80" /> Espace Revendeur</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white flex-shrink-0"><X size={20} /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.key ? "bg-white/15 text-white shadow-inner" : "text-rose-100/80 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={17} /> {tab.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="topbar-couleur topbar-rose shadow-sm border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700"><Menu size={22} /></button>
            <div className="hidden lg:block" />
            <div className="flex items-center gap-3">
              <MessagesLink />
              <CongesNavButton />
              <NotificationBell href="/dashboard/user/notifications" />
              <AccountMenuButton settingsHref="/dashboard/user/parametres" inline />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {activeTab === "apercu" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 mb-1">{profil.raisonSociale}</h2>
                  <p className="text-slate-500">{profil.pointDeVente ? `Rattaché à ${profil.pointDeVente.nom}` : "Aucun point de vente de rattachement"}</p>
                </div>
                <button onClick={() => refetchProfil()} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 text-sm font-medium"><RefreshCw size={16} /> Actualiser</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg shadow-rose-200">
                  <p className="text-rose-100 text-sm mb-1">Total facturé</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalFacture ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm mb-1">Solde dû</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(stats?.soldeDu ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <p className="text-slate-500 text-sm mb-1">Factures émises</p>
                  <p className="text-2xl font-bold text-slate-800">{stats?.nbFactures ?? 0}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800">Ma fiche professionnelle</h3>
                  <a href="/api/revendeur/profil/pdf?variante=CARTE" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"><Printer size={13} /> Imprimer ma carte</a>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <p><span className="text-slate-400">NIF :</span> {profil.nif || "—"}</p>
                  <p><span className="text-slate-400">RCCM :</span> {profil.rccm || "—"}</p>
                  <p><span className="text-slate-400">Adresse :</span> {profil.adresse || "—"}</p>
                  <p><span className="text-slate-400">Ville :</span> {profil.ville || "—"}</p>
                  <p><span className="text-slate-400">Contact :</span> {profil.contactNom || "—"}</p>
                  <p><span className="text-slate-400">Téléphone :</span> {profil.contactTelephone || profil.user.telephone || "—"}</p>
                </div>
              </div>
            </>
          )}

          {activeTab === "produits" && (
            <div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 mb-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input type="text" placeholder="Rechercher un produit..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 bg-slate-50" />
                </div>
              </div>
              {produitsLoading && <p className="text-sm text-slate-400">Chargement…</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {produits.map((p) => (
                  <div key={p.produitId} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all">
                    <p className="font-bold text-slate-800 mb-1">{p.nom}</p>
                    {p.codeProduit && <p className="text-xs text-slate-400 font-mono mb-2">{p.codeProduit}</p>}
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-slate-600">Prix revendeur</span>
                      <span className="font-bold text-rose-600">{formatCurrency(p.prixUnitaire)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-4">
                      <span className="text-slate-600">Stock</span>
                      <span className="font-semibold text-emerald-600">{p.stock} unités</span>
                    </div>
                    <button onClick={() => ajouterAuPanier(p)} className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5">
                      <Plus size={16} /> Ajouter à la commande
                    </button>
                  </div>
                ))}
                {!produitsLoading && produits.length === 0 && (
                  <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-sm border border-slate-100">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Aucun produit disponible</p>
                    <button onClick={() => refetchProduits()} className="mt-3 text-sm text-rose-600 hover:underline">Réessayer</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "commandes" && (
            <div className="space-y-6">
              {cart.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-rose-200">
                  <h3 className="font-bold text-slate-800 mb-4">Commande en cours</h3>
                  <div className="space-y-2 mb-4">
                    {cart.map((l) => (
                      <div key={l.produitId} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                        <span className="flex-1 text-sm text-slate-700">{l.nom}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => majQuantite(l.produitId, -1)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-100"><Minus size={12} /></button>
                          <span className="w-8 text-center text-sm font-semibold">{l.quantite}</span>
                          <button onClick={() => majQuantite(l.produitId, 1)} className="p-1 bg-white border border-slate-200 rounded hover:bg-slate-100"><Plus size={12} /></button>
                        </div>
                        <span className="w-24 text-right text-sm font-bold text-slate-700">{formatCurrency(l.prixUnitaire * l.quantite)}</span>
                        <button onClick={() => retirerDuPanier(l.produitId)} className="p-1 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="font-bold text-slate-800">Total : {formatCurrency(totalPanier)}</span>
                    <button onClick={passerCommande} disabled={submittingCommande} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                      {submittingCommande ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />} Passer la commande
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                  <h3 className="font-bold text-slate-800">Mes commandes ({commandes.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {commandes.map((c) => {
                    const st = STATUT_CDE_LABEL[c.statut] ?? { label: c.statut, badge: "bg-slate-100 text-slate-600" };
                    return (
                      <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">{c.reference}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(c.createdAt)}</p>
                        </div>
                        <span className="font-bold text-slate-800">{formatCurrency(c.totalTTC)}</span>
                        <a href={`/api/revendeur/commandes/${c.id}/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Imprimer le bon de commande">
                          <Printer size={16} />
                        </a>
                        {(c.statut === "CONFIRMEE" || c.statut === "LIVREE" || c.statut === "FACTUREE") && (
                          <a href={`/api/revendeur/commandes/${c.id}/bon-livraison/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Imprimer le bon de livraison">
                            <Truck size={16} />
                          </a>
                        )}
                        {c.statut === "FACTUREE" && (
                          <a href={`/api/revendeur/commandes/${c.id}/facture/pdf`} target="_blank" rel="noreferrer" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Imprimer la facture">
                            <FileText size={16} />
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {commandes.length === 0 && <div className="px-6 py-12 text-center text-slate-500">Aucune commande — ajoutez des produits depuis l&apos;onglet Produits.</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "releve" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">Relevé de compte</h3>
                <PrintReleveButton />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center">
                  <p className="text-xs text-slate-500">Factures</p>
                  <p className="text-2xl font-bold text-slate-800">{releveData?.stats.nbFactures ?? 0}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center">
                  <p className="text-xs text-slate-500">Total facturé</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(releveData?.stats.totalFacture ?? 0)}</p>
                </div>
                <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100 text-center">
                  <p className="text-xs text-rose-600">Solde dû</p>
                  <p className="text-2xl font-bold text-rose-700">{formatCurrency(releveData?.stats.soldeDu ?? 0)}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {(releveData?.data ?? []).map((f) => {
                    const solde = Number(f.montantTTC) - Number(f.montantPaye);
                    return (
                      <div key={f.id} className="px-6 py-4 flex items-center gap-4">
                        <FileText size={18} className="text-slate-300" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{f.numero}</p>
                          <p className="text-xs text-slate-400">{formatDate(f.dateEmission)}</p>
                        </div>
                        <span className="font-bold text-slate-800">{formatCurrency(f.montantTTC)}</span>
                        <span className={`text-xs font-semibold ${solde > 0 ? "text-red-500" : "text-emerald-600"}`}>{solde > 0 ? `${formatCurrency(solde)} dû` : "Soldée"}</span>
                      </div>
                    );
                  })}
                  {(releveData?.data ?? []).length === 0 && <div className="px-6 py-12 text-center text-slate-500">Aucune facture pour le moment.</div>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}

function PrintReleveButton() {
  return (
    <a href="/api/revendeur/releve/pdf" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 shadow-sm text-sm font-medium"><Printer size={16} /> Imprimer</a>
  );
}
