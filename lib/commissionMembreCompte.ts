import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { TypeCommissionRIA, RoleMembreCommissionRIA } from "@prisma/client";

// Rôle gestionnaire (confinement portail) dérivé du rôle de siège : un membre
// strict de commission est routé vers /dashboard/user/gouvernance.
export function gestionnaireRolePourSiege(
  role: RoleMembreCommissionRIA
): "PRESIDENT_COMMISSION_RIA" | "RAPPORTEUR_COMMISSION_RIA" {
  return role === "PRESIDENT" ? "PRESIDENT_COMMISSION_RIA" : "RAPPORTEUR_COMMISSION_RIA";
}

export class CompteMembreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface NouveauCompteInput {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  password?: string;
}

// Crée un compte « membre strict de commission » (identifiant + mot de passe) puis
// son siège, en une transaction : User(USER, mustChangePassword) + Gestionnaire
// (rôle commission mappé) + MembreCommissionRIA. Retourne le membre et, si le mot
// de passe a été auto-généré, le mot de passe temporaire à transmettre.
export async function creerCompteMembreCommission(opts: {
  typeCommission: TypeCommissionRIA;
  role: RoleMembreCommissionRIA;
  notes?: string | null;
  compte: NouveauCompteInput;
}) {
  const { nom, prenom, email, telephone, password } = opts.compte;
  if (!nom || !prenom || !email) {
    throw new CompteMembreError("nom, prénom et email sont obligatoires", 400);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new CompteMembreError("Cet email est déjà utilisé", 409);

  const motDePasseSaisi = typeof password === "string" && password.length >= 6 ? password : null;
  const motDePasse = motDePasseSaisi ?? Math.random().toString(36).slice(2, 10);
  const passwordHash = await bcrypt.hash(motDePasse, 10);
  const gestRole = gestionnaireRolePourSiege(opts.role);

  const membre = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        nom, prenom, email,
        telephone: telephone ?? null,
        passwordHash,
        mustChangePassword: true,
        role: "USER",
      },
    });
    await tx.gestionnaire.create({ data: { memberId: user.id, role: gestRole } });
    return tx.membreCommissionRIA.create({
      data: { typeCommission: opts.typeCommission, userId: user.id, role: opts.role, notes: opts.notes, actif: true },
      include: { user: { select: { id: true, nom: true, prenom: true, email: true } } },
    });
  });

  return { membre, motDePasseTemporaire: motDePasseSaisi ? null : motDePasse };
}
