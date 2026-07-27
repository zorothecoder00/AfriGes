import { NextResponse } from "next/server";
import { Prisma, TypeFournisseur } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLogistiqueSession } from "@/lib/authLogistique";
import { getAuthSession } from "@/lib/auth";
import { auditLog } from "@/lib/notifications";
import { getRequestMeta } from "@/lib/requestMeta";

export async function getSession() {
  const logistique = await getLogistiqueSession();
  if (logistique) return logistique;
  const s = await getAuthSession();
  if (s && (s.user.role === "ADMIN" || s.user.role === "SUPER_ADMIN")) return s;
  return null;
}

/**
 * GET /api/logistique/fournisseurs
 * Liste des fournisseurs enregistrés. Query: search?, actif?, type?
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const search = ( searchParams.get("search") || "" ).trim();
    const actifQ = searchParams.get("actif");
    const type   = searchParams.get("type") as TypeFournisseur | null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (actifQ !== null && actifQ !== "") where.actif = actifQ === "true";
    if (type) where.type = type;
    if (search) where.OR = [
      { nom:       { contains: search, mode: "insensitive" } },
      { code:      { contains: search, mode: "insensitive" } },
      { contact:   { contains: search, mode: "insensitive" } },
      { telephone: { contains: search, mode: "insensitive" } },
      { pays:      { contains: search, mode: "insensitive" } },
    ];

    const fournisseurs = await prisma.fournisseur.findMany({
      where,
      orderBy: { nom: "asc" },
      include: { _count: { select: { receptions: true, contrats: true } } },
    });

    return NextResponse.json({ data: fournisseurs });
  } catch (error) {
    console.error("GET /logistique/fournisseurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/logistique/fournisseurs
 * Créer un fournisseur. Génère automatiquement le code FRN-000001.
 * Body: { nom, type?, contact?, telephone?, email?, adresse?, notes?,
 *         pays?, region?, devise?, banque?, iban?, rccm?, nif?, numeroTva? }
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, type, contact, telephone, email, adresse, notes,
      pays, region, devise, banque, iban, rccm, nif, numeroTva } = body;
    if (!nom) return NextResponse.json({ error: "nom est obligatoire" }, { status: 400 });

    const data = {
      nom,
      type: type ? (type as TypeFournisseur) : null,
      contact: contact || null, telephone: telephone || null, email: email || null,
      adresse: adresse || null, notes: notes || null,
      pays: pays || null, region: region || null, devise: devise || null,
      banque: banque || null, iban: iban || null,
      rccm: rccm || null, nif: nif || null, numeroTva: numeroTva || null,
    };

    // Génération du code fournisseur (FRN-000001) avec retry en cas de collision.
    for (let attempt = 0; attempt < 6; attempt++) {
      const count = await prisma.fournisseur.count();
      const code = `FRN-${String(count + 1 + attempt).padStart(6, "0")}`;
      try {
        const fournisseur = await prisma.$transaction(async (tx) => {
          const f = await tx.fournisseur.create({ data: { ...data, code } });
          await auditLog(tx, parseInt(session.user.id), "FOURNISSEUR_CREE", "Fournisseur", f.id, undefined, getRequestMeta(req));
          return f;
        });
        return NextResponse.json({ data: fournisseur }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    return NextResponse.json({ error: "Impossible de générer un code fournisseur unique" }, { status: 500 });
  } catch (error) {
    console.error("POST /logistique/fournisseurs:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
