// app/api/notifications/route.ts
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

  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page") ?? 1);
  const limit = Number(searchParams.get("limit") ?? 20);
  const lue = searchParams.get("lue");

  const notifications = await prisma.notification.findMany({
    where: {
      userId: parseInt(session?.user.id),
      ...(lue !== null && { lue: lue === "true" }),
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ data: notifications });
}

export async function DELETE(req: Request) {
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

