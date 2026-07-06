import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

/**
 * ==========================
 * /api/me/profile
 * ==========================
 * Profil du compte connecté : consultation (GET) et mise à jour (PATCH) de ses
 * propres informations — nom, prénom, email, téléphone, adresse, photo.
 * (Le mot de passe passe par /api/user/change-password.)
 *
 * Email : saisie libre (Gmail inclus). On normalise en minuscules — c'est la forme
 * que renvoie Google au login, donc un email = son Gmail exact garde la connexion
 * Google opérationnelle (authOptions associe les comptes Google par email).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// La photo est stockée en data URL (base64) dans User.photo → compatible serverless
// (pas d'écriture disque). On borne la taille pour ne pas gonfler la base.
const MAX_PHOTO_CHARS = 900_000; // ≈ 650 Ko d'image encodée

export async function GET() {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
    select: {
      id: true, nom: true, prenom: true, email: true, photo: true,
      telephone: true, adresse: true, role: true, dateAdhesion: true,
      passwordHash: true,
      gestionnaire: { select: { role: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  return NextResponse.json({
    data: {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      photo: user.photo,
      telephone: user.telephone,
      adresse: user.adresse,
      role: user.role,
      gestionnaireRole: user.gestionnaire?.role ?? null,
      dateAdhesion: user.dateAdhesion,
      hasPassword: !!user.passwordHash,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await getAuthSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const id = Number(session.user.id);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};

  if (typeof body.nom === "string") {
    const v = body.nom.trim();
    if (!v) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    data.nom = v;
  }
  if (typeof body.prenom === "string") {
    const v = body.prenom.trim();
    if (!v) return NextResponse.json({ error: "Le prénom est requis" }, { status: 400 });
    data.prenom = v;
  }
  if (typeof body.telephone === "string") {
    data.telephone = body.telephone.trim() || null;
  }
  if (typeof body.adresse === "string") {
    data.adresse = body.adresse.trim() || null;
  }
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Cette adresse email est déjà utilisée" }, { status: 409 });
    }
    data.email = email;
  }
  if (body.photo !== undefined) {
    if (body.photo === null || body.photo === "") {
      data.photo = null;
    } else if (typeof body.photo === "string" && body.photo.startsWith("data:image/")) {
      if (body.photo.length > MAX_PHOTO_CHARS) {
        return NextResponse.json({ error: "Photo trop volumineuse (réduisez la taille)" }, { status: 413 });
      }
      data.photo = body.photo;
    } else {
      return NextResponse.json({ error: "Photo invalide" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, nom: true, prenom: true, email: true, photo: true,
        telephone: true, adresse: true, role: true,
      },
    });

    await prisma.auditLog.create({
      data: { userId: id, action: "MAJ_PROFIL", entite: "User", entiteId: id },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    // Collision d'unicité email (course entre la vérif et l'update)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Cette adresse email est déjà utilisée" }, { status: 409 });
    }
    console.error("PATCH /api/me/profile", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
  }
}
