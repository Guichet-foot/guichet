import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  // If Supabase is not configured, allow login page and static assets only
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("placeholder")
  ) {
    if (
      pathname === "/login" ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/manifest.json") ||
      pathname.startsWith("/icon-") ||
      pathname.startsWith("/logo")
    ) {
      return supabaseResponse;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — let through to login
    if (pathname === "/login") return supabaseResponse;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login") {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const redirectUrl =
        profile?.role === "caissier" ? "/vente" : "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return supabaseResponse;
  }

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/manifest.json") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/logo")
  ) {
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const adminRoutes = [
    "/dashboard",
    "/utilisateurs",
    "/zones",
    "/matchs",
    "/finances",
    "/rapports",
  ];
  const caissierRoutes = ["/vente", "/scanner", "/mes-ventes"];

  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r));
  const isCaissierRoute = caissierRoutes.some((r) => pathname.startsWith(r));

  if (isAdminRoute && profile.role === "caissier") {
    return NextResponse.redirect(new URL("/vente", request.url));
  }

  if (
    isCaissierRoute &&
    profile.role !== "caissier" &&
    profile.role !== "admin_zone"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    const redirectUrl =
      profile.role === "caissier" ? "/vente" : "/dashboard";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return supabaseResponse;
}
