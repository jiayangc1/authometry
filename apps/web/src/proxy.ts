import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("authometry_admin_access") ||
    request.cookies.has("authometry_admin_refresh");
  if (!hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview/:path*",
    "/applications/:path*",
    "/users/:path*",
    "/sessions/:path*",
    "/traces/:path*",
    "/scopes/:path*",
    "/policies/:path*",
    "/events/:path*",
    "/deployments/:path*",
    "/settings/:path*",
    "/developer/:path*",
    "/dev/:path*",
    "/select-workspace",
  ],
};
