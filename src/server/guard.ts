import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import type { Locale } from "@/lib/i18n";

export async function currentUser() {
  const token = (await cookies()).get("adsmart_session")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("adsmart_locale")?.value;
  if (value === "zh" || value === "en") return value;
  const user = await currentUser();
  if (user?.locale === "zh" || user?.locale === "en") return user.locale;
  return "en";
}

export async function memberIdsFor(userId: string) {
  const rows = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return rows.map((row) => row.workspaceId);
}

export async function resolveWorkspaces(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { workspace: { name: "asc" } },
  });
  const cookie = (await cookies()).get("adsmart_workspace")?.value;
  const current = memberships.find((member) => member.workspaceId === cookie)?.workspace ?? memberships[0]?.workspace ?? null;
  return { memberships, current };
}
