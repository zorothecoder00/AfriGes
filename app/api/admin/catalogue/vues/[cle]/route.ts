import { NextResponse } from "next/server";
import { ModeStockVue, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import { CHAMPS_CATALOGUE, vueRoleDefaut } from "@/lib/vuesCatalogue";
import { vueEffective } from "@/lib/vuesCatalogueServer";

type Ctx = { params: Promise<{ cle: string }> };

const CLES_CHAMPS = new Set(CHAMPS_CATALOGUE.map((c) => c.key));
const MODES: ModeStockVue[] = ["EXACT", "PALIER", "AUCUN"];

/**
 * Vue d'un rôle (Catalogue §22) — admin.
 * GET — vue effective (personnalisée ou par défaut).
 * PUT — enregistre la personnalisation ({ champsVisibles, modeStock, filtres })
 *       ou réinitialise aux valeurs par défaut ({ reset: true }).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const cle = (await params).cle;
  const vue = await vueEffective(cle);
  if (!vue) return NextResponse.json({ message: "Rôle de vue inconnu" }, { status: 404 });
  return NextResponse.json({ data: vue });
}

export async function PUT(req: Request, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ message: "Accès refusé" }, { status: 403 });

  const cle = (await params).cle;
  const defaut = vueRoleDefaut(cle);
  if (!defaut) return NextResponse.json({ message: "Rôle de vue inconnu" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Corps invalide" }, { status: 400 });
  const userId = Number(session.user.id);

  // Réinitialisation → suppression de la surcharge.
  if (body.reset === true) {
    await prisma.vueCatalogue.deleteMany({ where: { cle } });
    await auditLog(prisma, userId, "VUE_CATALOGUE_RESET", "VueCatalogue", 0);
    return NextResponse.json({ data: await vueEffective(cle) });
  }

  const champsVisibles = Array.isArray(body.champsVisibles)
    ? (body.champsVisibles as unknown[]).map(String).filter((k) => CLES_CHAMPS.has(k))
    : defaut.champsDefaut;
  const modeStock = MODES.includes(body.modeStock as ModeStockVue) ? (body.modeStock as ModeStockVue) : defaut.modeStock;
  const filtres = body.filtres != null ? (body.filtres as Prisma.InputJsonValue) : Prisma.JsonNull;

  const saved = await prisma.vueCatalogue.upsert({
    where: { cle },
    create: { cle, nom: defaut.nom, description: defaut.description, champsVisibles, modeStock, filtres },
    update: { champsVisibles, modeStock, filtres },
    select: { cle: true, champsVisibles: true, modeStock: true },
  });
  await auditLog(prisma, userId, "VUE_CATALOGUE_MAJ", "VueCatalogue", 0);

  return NextResponse.json({ data: saved });
}
