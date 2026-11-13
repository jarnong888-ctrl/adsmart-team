import "server-only";
import { redirect } from "next/navigation";
import { getLocale, requireUser, resolveWorkspaces } from "@/server/guard";

export async function studioContext() {
  const user = await requireUser();
  const locale = await getLocale();
  const resolved = await resolveWorkspaces(user.id);
  if (!resolved.current) redirect("/studio/workspace");
  return { user, locale, memberships: resolved.memberships, workspace: resolved.current };
}
