import { createServerClient } from "@supabase/ssr";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    const signOutResponse = NextResponse.redirect(new URL("/login", request.url));
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
        signOutResponse.cookies.delete(cookie.name);
      }
    });
    return signOutResponse;
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

  // Fondateur may access their own dashboard (/fondateur/*) OR admin zone routes (/matchs, /billets, etc.)
  const isAdminRouteForFondateur = adminRoutes.some((r) => pathname.startsWith(r));
  if (profile.role === "fondateur" && !isFondateurRoute && !isAdminRouteForFondateur) {
    return NextResponse.redirect(new URL("/fondateur/dashboard", request.url));
  }
  const caissierRoutes = ["/vente", "/mes-ventes"];
  const portierRoutes = ["/scanner"];

  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r));
  const isCaissierRoute = caissierRoutes.some((r) => pathname.startsWith(r));
  const isPortierRoute = portierRoutes.some((r) => pathname.startsWith(r));

  // C3 is an admin-level role (same routing as admin_zone)
  const isAdminRole = ["super_admin", "admin_zone", "c3"].includes(profile.role);

  if (profile.role === "portier") {
    if (!isPortierRoute) {
      return NextResponse.redirect(new URL("/scanner", request.url));
    }
    return supabaseResponse;
  }

  if (profile.role === "caissier" && (isAdminRoute || pathname.startsWith("/scanner"))) {
    return NextResponse.redirect(new URL("/vente", request.url));
  }

  if (
    isCaissierRoute &&
    !["caissier", "admin_zone", "super_admin", "c3"].includes(profile.role)
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
