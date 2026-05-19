// app/api/notifications/route.ts
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

  const { searchParams } = new URL(req.url);
  const page  = Number(searchParams.get("page")  ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const lue   = searchParams.get("lue");

  const notifications = await prisma.notification.findMany({
    where: {
      userId: effectiveUserId,
      ...(lue !== null && { lue: lue === "true" }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ data: notifications });
}

export async function DELETE(_req: Request) {
  const session = await getAuthSession();

  if (!session || !session.user?.id) {
    return NextResponse.json(
      {
        success: false,
        message: "Non autorisé",
      },
      { status: 401 }   
    );
  }

  await prisma.notification.deleteMany({
    where: {
      userId: parseInt(session.user.id),
    },
  });

  return NextResponse.json({ success: true });
}

