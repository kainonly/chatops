import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isAuthenticated(request: NextRequest): boolean {
  return !!(
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token")
  );
}

export function proxy(request: NextRequest) {
  if (isAuthenticated(request)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // API 路由：返回 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 页面路由：重定向到登录页
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    // 需要鉴权的 API 路由（排除 Auth.js 端点）
    "/api/((?!auth).*)",
    // 需要鉴权的页面路由（排除 API、登录页和静态资源）
    "/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
