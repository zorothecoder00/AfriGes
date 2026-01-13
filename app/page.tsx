import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth"
import { Role } from "@/types"

export default async function Home() {
  const session = await getAuthSession()

  // Pas connecté
  if (!session) {
    redirect("/auth/login")
  }

  const role = session.user.role

  switch (role) {
    case Role.SUPER_ADMIN:
    case Role.ADMIN:
      redirect("/dashboard/admin")

    case Role.USER:
      redirect("/dashboard/user")

    default:
      redirect("/unauthorized")
  }
}


