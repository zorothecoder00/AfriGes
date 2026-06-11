import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRIASession } from "@/lib/authRIA";
import bcrypt from "bcryptjs";

// ── GET — liste des investisseurs ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { searchParams } = req.nextUrl;
    const search = searchParams.get("search")?.trim() ?? "";
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const skip   = (page - 1) * limit;

    const where = {
      role: "INVESTISSEUR_RIA" as const,
      ...(search ? {
        OR: [
          { member: { nom:       { contains: search, mode: "insensitive" as const } } },
          { member: { prenom:    { contains: search, mode: "insensitive" as const } } },
          { member: { email:     { contains: search, mode: "insensitive" as const } } },
          { member: { telephone: { contains: search } } },
          { profilRIA: { numero: { contains: search, mode: "insensitive" as const } } },
        ],
      } : {}),
    };

    const [investisseurs, total] = await Promise.all([
      prisma.gestionnaire.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          member: {
            select: { id: true, nom: true, prenom: true, email: true, telephone: true, photo: true, adresse: true, etat: true, dateAdhesion: true },
          },
          profilRIA: {
            include: {
              portefeuilles: {
                where: { actif: true },
                select: {
                  id: true, reference: true, nom: true, actif: true,
                  capitalInvesti: true, capitalDisponible: true, capitalEngage: true,
                  capitalRecouvre: true, capitalBloque: true,
                  beneficesGeneres: true, beneficesDistribues: true, beneficesReinvestis: true,
                  fondSecurite: true,
                },
              },
            },
          },
        },
      }),
      prisma.gestionnaire.count({ where }),
    ]);

    return NextResponse.json({
      data: investisseurs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/admin/ria/investisseurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — créer un investisseur ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getRIASession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const body = await req.json();
    const { nom, prenom, email, telephone, adresse, profession, pays, pieceIdentiteUrl, notes, avecPortefeuille, nomPortefeuille } = body;

    if (!nom || !prenom || !email) {
      return NextResponse.json({ error: "nom, prenom et email sont obligatoires" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });

    const tmpPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = await bcrypt.hash(tmpPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nom, prenom, email,
          telephone: telephone ?? null,
          adresse: adresse ?? null,
          passwordHash,
          mustChangePassword: true,
          role: "USER",
        },
      });

      const gestionnaire = await tx.gestionnaire.create({
        data: { memberId: user.id, role: "INVESTISSEUR_RIA" },
      });

      const nbProfils = await tx.profilInvestisseurRIA.count();
      const profil = await tx.profilInvestisseurRIA.create({
        data: {
          gestionnaireId: gestionnaire.id,
          numero: `INV-${String(nbProfils + 1).padStart(5, "0")}`,
          profession: profession ?? null,
          pays: pays ?? null,
          pieceIdentiteUrl: pieceIdentiteUrl ?? null,
          notes: notes ?? null,
        },
      });

      let portefeuille = null;
      if (avecPortefeuille) {
        const count = await tx.portefeuilleRIA.count();
        portefeuille = await tx.portefeuilleRIA.create({
          data: {
            reference: `PF-${String(count + 1).padStart(5, "0")}`,
            profilRIAId: profil.id,
            nom: nomPortefeuille ?? "Portefeuille Principal",
          },
        });
      }

      return { user, gestionnaire, profil, portefeuille };
    });

    return NextResponse.json({ data: { ...result, tmpPassword } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/ria/investisseurs", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
