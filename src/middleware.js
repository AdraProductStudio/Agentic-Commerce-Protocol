import { NextResponse } from "next/server";

export function middleware(req) {
  const pathname = req.nextUrl.pathname;
  const token = req.cookies.get("auth_token")?.value;
  const legacyPages = ["/cart", "/success", "/cancel", "/auth-payload"];

  if (legacyPages.some((page) => pathname === page || pathname.startsWith(`${page}/`))) {
    const target = token ? "/home" : "/login";
    return NextResponse.redirect(new URL(target, req.url));
  }

  if (pathname.startsWith("/home") && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/cart/:path*", "/success/:path*", "/cancel/:path*", "/auth-payload/:path*"],
};
