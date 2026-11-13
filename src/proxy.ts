import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("adsmart_session")?.value;
  const { pathname } = request.nextUrl;
  const needsSession = pathname.startsWith("/studio") || pathname.startsWith("/admin");
  if (needsSession && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/studio/:path*", "/admin/:path*"],
};
