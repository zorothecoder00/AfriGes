import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";

const MODULES_DEFAUT = [
  { key: "caisse",       nom: "Caisse & Paiements",       description: "Sessions de caisse, opérations, clôtures" },
  { key: "stock",        nom: "Gestion du stock",          description: "Inventaire, mouvements, ajustements" },
  { key: "packs",        nom: "Packs & Souscriptions",     description: "Gestion des packs clients et versements" },
  { key: "ventes",       nom: "Ventes directes",           description: "Ventes et réceptions produits" },
  { key: "logistique",   nom: "Logistique & Appro",        description: "Approvisionnements, transferts, bons de sortie" },
  { key: "comptabilite", nom: "Comptabilité",              description: "Exercices, écritures, TVA, rapprochements" },
  { key: "rapports",     nom: "Rapports & Export",         description: "Tableaux de bord et exports CSV" },
  { key: "assemblees",   nom: "Assemblées & Dividendes",   description: "Gestion des assemblées et distributions" },
  { key: "messages",     nom: "Messagerie interne",        description: "Messages entre gestionnaires" },
  { key: "terrain",      nom: "Agents de terrain",         description: "Collectes, prospection, livraisons terrain" },
];

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    // Seed les modules manquants
    for (const m of MODULES_DEFAUT) {
      await prisma.systemModule.upsert({
        where:  { key: m.key },
        create: { ...m, actif: true },
        update: {},
      });
    }

    const modules = await prisma.systemModule.findMany({ orderBy: { nom: "asc" } });
    return NextResponse.json({ success: true, data: modules });
  } catch (error) {
    console.error("GET /api/superadmin/modules", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const superAdminId = parseInt(session.user.id);
    const { key, actif } = await req.json();
    if (!key || actif === undefined) return NextResponse.json({ error: "key et actif requis" }, { status: 400 });

    await prisma.systemModule.update({ where: { key }, data: { actif, updatedBy: superAdminId } });
    await auditLog(prisma, superAdminId, actif ? "SUPERADMIN_MODULE_ACTIVATED" : "SUPERADMIN_MODULE_DISABLED", "SystemModule");

    return NextResponse.json({ success: true, message: `Module ${actif ? "activé" : "désactivé"}` });
  } catch (error) {
    console.error("PATCH /api/superadmin/modules", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
