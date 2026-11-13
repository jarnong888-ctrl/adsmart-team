import { NextResponse } from "next/server";
import { isProviderId } from "@/lib/integrations/catalog";
import { beginConnect } from "@/server/integrations";
import { memberIdsFor, requireUser, resolveWorkspaces } from "@/server/guard";

function redirectTo(request: Request, target: string) {
  if (target.startsWith("http://") || target.startsWith("https://")) return NextResponse.redirect(target);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "127.0.0.1:43123";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return NextResponse.redirect(new URL(target, `${proto}://${host}`));
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (!isProviderId(provider)) return redirectTo(request, "/studio/connections?error=integration");
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const { current } = await resolveWorkspaces(user.id);
  if (!current) return redirectTo(request, "/studio/connections?error=missing");
  try {
    const next = await beginConnect(user, current.id, ids, provider);
    return redirectTo(request, next.url);
  } catch {
    return redirectTo(request, "/studio/connections?error=integration");
  }
}
