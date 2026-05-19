// app/api/notifications/unread/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { resolveViewAs } from "@/lib/viewAs";

export async function GET(req: NextRequest) {
  const session = await getAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json({ success: false, message: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";
  const viewAs  = isAdmin ? resolveViewAs(req) : null;
  const effectiveUserId = viewAs?.userId ?? parseInt(session.user.id);

  const count = await prisma.notification.count({
    where: {
      userId: effectiveUserId,
      lue: false,
    },
  });

  return NextResponse.json({ data: count });
}
