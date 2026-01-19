// app/api/notifications/[uuid]/read/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id } = await context.params;

  await prisma.notification.updateMany({
    where: {
      uuid: id,
      userId: parseInt(session.user.id),
    },
    data: {
      lue: true,
      dateLecture: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
