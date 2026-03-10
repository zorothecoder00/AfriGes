import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/authAdmin";
import { auditLog } from "@/lib/notifications";
import bcrypt from "bcryptjs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const callerRole    = session.user.role; // "ADMIN" | "SUPER_ADMIN"
    const isSuperAdmin  = callerRole === "SUPER_ADMIN";
    const callerId      = parseInt(session.user.id);

    const { id }   = await params;
    const targetId = parseInt(id);
    const body     = await req.json();
    const { action, motif, module, permission, granted, notes } = body;

    const target = await prisma.user.findUnique({
      where:  { id: targetId },
      select: { id: true, nom: true, prenom: true, email: true, etat: true, role: true },
    });
    if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    // Un admin ne peut pas agir sur un SUPER_ADMIN (sauf si lui-même est SUPER_ADMIN)
    if (!isSuperAdmin && target.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Action non autorisée : vous ne pouvez pas gérer un Super Administrateur" },
        { status: 403 }
      );
    }

    // Auto-action interdite
    if (targetId === callerId && ["suspend", "force_disconnect"].includes(action)) {
      return NextResponse.json({ error: "Action impossible sur votre propre compte" }, { status: 400 });
    }

    // Suppression définitive — SUPER_ADMIN uniquement
    if (action === "delete_permanent" && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Seul un Super Administrateur peut supprimer définitivement un utilisateur" },
        { status: 403 }
      );
    }

    switch (action) {

      case "reset_password": {
        const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
        const tempPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        const hash = await bcrypt.hash(tempPassword, 12);
        await prisma.user.update({ where: { id: targetId }, data: { passwordHash: hash } });
        await prisma.securityLog.create({ data: {
          userId: targetId, userEmail: target.email, action: "PASSWORD_RESET",
          details: `Réinitialisé par ${callerRole} #${callerId}${motif ? ` — ${motif}` : ""}`,
        }});
        await auditLog(prisma, callerId, "ADMIN_RESET_PASSWORD", "User", targetId);
        return NextResponse.json({ success: true, tempPassword, message: "Mot de passe réinitialisé" });
      }

      case "suspend": {
        await prisma.user.update({ where: { id: targetId }, data: { etat: "SUSPENDU" } });
        await prisma.securityLog.create({ data: {
          userId: targetId, userEmail: target.email, action: "ACCOUNT_LOCKED",
          details: `Suspendu par ${callerRole} #${callerId}${motif ? ` — Motif : ${motif}` : ""}`,
        }});
        await auditLog(prisma, callerId, "ADMIN_SUSPEND_USER", "User", targetId);
        return NextResponse.json({ success: true, message: "Compte suspendu" });
      }

      case "unsuspend": {
        await prisma.user.update({ where: { id: targetId }, data: { etat: "ACTIF" } });
        await prisma.securityLog.create({ data: {
          userId: targetId, userEmail: target.email, action: "ACCOUNT_UNLOCKED",
          details: `Réactivé par ${callerRole} #${callerId}${motif ? ` — ${motif}` : ""}`,
        }});
        await auditLog(prisma, callerId, "ADMIN_UNSUSPEND_USER", "User", targetId);
        return NextResponse.json({ success: true, message: "Compte réactivé" });
      }

      case "force_disconnect": {
        await prisma.securityLog.create({ data: {
          userId: targetId, userEmail: target.email, action: "FORCE_DISCONNECT",
          details: `Déconnexion forcée par ${callerRole} #${callerId}${motif ? ` — ${motif}` : ""}`,
        }});
        await auditLog(prisma, callerId, "ADMIN_FORCE_DISCONNECT", "User", targetId);
        return NextResponse.json({ success: true, message: "Déconnexion forcée enregistrée" });
      }

      case "set_permission": {
        if (!module || !permission)
          return NextResponse.json({ error: "module et permission requis" }, { status: 400 });
        // ADMIN ne peut pas modifier les permissions des rôles critiques (SUPER_ADMIN)
        if (!isSuperAdmin && target.role === "SUPER_ADMIN")
          return NextResponse.json({ error: "Vous ne pouvez pas modifier les permissions d'un Super Administrateur" }, { status: 403 });

        await prisma.userPermission.upsert({
          where:  { userId_module_permission: { userId: targetId, module, permission } },
          create: { userId: targetId, module, permission, granted: granted ?? true, grantedBy: callerId, notes: notes ?? null },
          update: { granted: granted ?? true, grantedBy: callerId, notes: notes ?? null },
        });
        await auditLog(prisma, callerId, "ADMIN_SET_PERMISSION", "UserPermission", targetId);
        return NextResponse.json({ success: true, message: "Permission mise à jour" });
      }

      case "remove_permission": {
        if (!module || !permission)
          return NextResponse.json({ error: "module et permission requis" }, { status: 400 });
        if (!isSuperAdmin && target.role === "SUPER_ADMIN")
          return NextResponse.json({ error: "Vous ne pouvez pas modifier les permissions d'un Super Administrateur" }, { status: 403 });

        await prisma.userPermission.deleteMany({ where: { userId: targetId, module, permission } });
        await auditLog(prisma, callerId, "ADMIN_REMOVE_PERMISSION", "UserPermission", targetId);
        return NextResponse.json({ success: true, message: "Permission supprimée" });
      }

      case "delete_permanent": {
        // Réservé SUPER_ADMIN uniquement (déjà vérifié avant le switch)
        await prisma.user.delete({ where: { id: targetId } });
        await auditLog(prisma, callerId, "SUPERADMIN_DELETE_USER", "User", targetId);
        return NextResponse.json({ success: true, message: "Utilisateur supprimé définitivement" });
      }

      default:
        return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("POST /api/superadmin/users/[id]/action", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
