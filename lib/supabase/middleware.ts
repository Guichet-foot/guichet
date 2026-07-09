import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;

  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl.includes("placeholder")
  ) {
    if (
      pathname === "/login" ||
      pathname === "/fondateur" ||
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
    if (pathname === "/login" || pathname === "/fondateur") return supabaseResponse;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fondateur login page
  if (pathname === "/fondateur") {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "fondateur") {
        return NextResponse.redirect(new URL("/fondateur/dashboard", request.url));
      }
    }
    return supabaseResponse;
  }

  // Regular login page
  if (pathname === "/login") {
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile) return supabaseResponse;

      let redirectUrl = "/dashboard";
      if (profile.role === "caissier") redirectUrl = "/vente";
      if (profile.role === "portier") redirectUrl = "/scanner";
      if (profile.role === "fondateur") redirectUrl = "/fondateur/dashboard";
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
    const loginUrl = pathname.startsWith("/fondateur/") ? "/fondateur" : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // Use admin client to read profile — bypasses RLS, avoids query failures
  // causing session destruction via signOut()
  let profile: { role: string; active: boolean; password_expires_at?: string | null } | null = null;
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey && supabaseUrl) {
      const adminDb = createSupabaseClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await adminDb
        .from("profiles")
        .select("role, active, password_expires_at")
        .eq("id", user.id)
        .single();
      profile = data;
    }
  } catch {
    // DB unreachable — let the request through; page-level auth will handle it
  }

  // Profile genuinely not found or DB unavailable — redirect without destroying session
  // (user can reload and session will still be valid)
  if (!profile) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Account explicitly deactivated by an admin — revoke session
  if (!profile.active) {
    await supabase.auth.signOut();
    const signOutResponse = NextResponse.redirect(new URL("/login", request.url));
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
        signOutResponse.cookies.delete(cookie.name);
      }
    });
    return signOutResponse;
  }

  // Password expiration — revoke session and redirect with error param
  if (profile.password_expires_at && new Date(profile.password_expires_at) < new Date()) {
    await supabase.auth.signOut();
    const expiredResponse = NextResponse.redirect(new URL("/login?expired=1", request.url));
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
        expiredResponse.cookies.delete(cookie.name);
      }
    });
    return expiredResponse;
  }

  // Fondateur routes
  const isFondateurRoute = pathname.startsWith("/fondateur/");
  if (isFondateurRoute && profile.role !== "fondateur") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const adminRoutes = [
    "/dashboard", "/equipes", "/utilisateurs",
    "/zones", "/billets", "/matchs", "/finances", "/rapports", "/parametres",
    "/invendus", "/cartes", "/parametres-odcav", "/parametres-c3",
  ];

  // Fondateur has their own dashboard — redirect them away from the admin /dashboard
  // (which would create a loop: page calls requireRole without fondateur → redirect /dashboard → repeat)
  if (profile.role === "fondateur" && pathname === "/dashboard") {
    return NextResponse.redirect(new URL("/fondateur/dashboard", request.url));
  }

  // Fondateur may access their own routes (/fondateur/*) OR other admin routes (/matchs, /billets, etc.)
  // but NOT /dashboard (handled above)
  const fondateurAllowedAdminRoutes = adminRoutes.filter((r) => r !== "/dashboard");
  const isAdminRouteForFondateur = fondateurAllowedAdminRoutes.some((r) => pathname.startsWith(r));
  if (profile.role === "fondateur" && !isFondateurRoute && !isAdminRouteForFondateur) {
    return NextResponse.redirect(new URL("/fondateur/dashboard", request.url));
  }
  const caissierRoutes = ["/vente", "/mes-ventes"];
  const portierRoutes = ["/scanner"];

  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r));
  const isCaissierRoute = caissierRoutes.some((r) => pathname.startsWith(r));
  const isPortierRoute = portierRoutes.some((r) => pathname.startsWith(r));

  // president_odcav, super_admin, tresorier have the same routing
  const isAdminRole = ["president_odcav", "super_admin", "admin_zone", "c3", "tresorier"].includes(profile.role);

  if (profile.role === "portier") {
    if (!isPortierRoute) {
      return NextResponse.redirect(new URL("/scanner", request.url));
    }
    return supabaseResponse;
  }

  if (profile.role === "caissier" && (isAdminRoute || pathname.startsWith("/scanner"))) {
    return NextResponse.redirect(new URL("/vente", request.url));
  }

  // president_odcav / tresorier redirect for non-admin, non-fondateur routes
  if (
    (profile.role === "president_odcav" || profile.role === "tresorier") &&
    !isFondateurRoute &&
    !isAdminRoute
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    isCaissierRoute &&
    !["caissier", "admin_zone", "super_admin", "c3"].includes(profile.role)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    let redirectUrl = "/dashboard";
    if (profile.role === "caissier") redirectUrl = "/vente";
    if (profile.role === "fondateur") redirectUrl = "/fondateur/dashboard";
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }

  return supabaseResponse;
}
