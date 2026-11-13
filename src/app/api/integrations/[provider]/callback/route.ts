import { NextResponse } from "next/server";
import { finishGoogleCallback } from "@/server/integrations";
import { memberIdsFor, requireUser } from "@/server/guard";

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const url = new URL(request.url);
  const user = await requireUser();
  const ids = await memberIdsFor(user.id);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "127.0.0.1:43123";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const back = (path: string) => NextResponse.redirect(new URL(path, `${proto}://${host}`));
  if (provider !== "google") return back("/studio/connections?error=integration");
  try {
    await finishGoogleCallback(user, ids, url.searchParams.get("code") || "", url.searchParams.get("state") || "");
    return back("/studio/connections?notice=connected");
  } catch {
    return back("/studio/connections?error=integration");
  }
}
