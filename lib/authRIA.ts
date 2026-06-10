import { getAuthSession } from "@/lib/auth";

export async function getRIASession() {
  const session = await getAuthSession();
  if (!session) return null;
  const role = session.user.role;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return session;
  return null;
}
