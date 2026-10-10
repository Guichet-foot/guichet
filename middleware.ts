import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Forces a fresh Vercel build (new asset hashes) to rule out any stale-cache
// explanation for the mobile tab-click bug fix not appearing to take effect.

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-.*|logo.*|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf)$).*)",
  ],
};
