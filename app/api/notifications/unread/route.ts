// app/api/notifications/unread-count/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: Request) {
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

  const count = await prisma.notification.count({
    where: {
      userId: parseInt(session.user.id),
      lue: false,
    },
  });

  return NextResponse.json({ data: count });
}
