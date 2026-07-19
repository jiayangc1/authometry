import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/portal")) {
    const hasPortalSession = request.cookies.has("authometry_user_session");
    const loginPage = request.nextUrl.pathname === "/portal/login";
    if (!hasPortalSession && !loginPage) {
      const login = new URL("/portal/login", request.url);
      login.searchParams.set("returnTo", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    if (hasPortalSession && loginPage)
      return NextResponse.redirect(new URL("/portal", request.url));
    return NextResponse.next();
  }
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
    "/portal/:path*",
  ],
};
