// app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function PATCH(req: Request) {
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

  await prisma.notification.updateMany({
    where: {
      userId: parseInt(session.user.id),
      lue: false,
    },
    data: {
      lue: true,
      dateLecture: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
