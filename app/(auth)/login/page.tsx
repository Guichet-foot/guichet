"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    searchParams.get("expired") === "1" ? "Mot de passe expiré. Contactez votre administrateur." : ""
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Erreur de connexion");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active, password_expires_at")
      .eq("id", user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      setError("Profil introuvable. Contactez votre administrateur.");
      setLoading(false);
      return;
    }

    if (!profile.active) {
      await supabase.auth.signOut();
      setError("Compte désactivé. Contactez votre administrateur.");
      setLoading(false);
      return;
    }

    if (profile.password_expires_at && new Date(profile.password_expires_at) < new Date()) {
      await supabase.auth.signOut();
      setError("Mot de passe expiré. Contactez votre administrateur.");
      setLoading(false);
      return;
    }

    let destination = "/dashboard";
    if (profile.role === "caissier") destination = "/vente";
    if (profile.role === "portier") destination = "/scanner";
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4 sm:p-8 lg:p-12">
      <div className="flex w-full max-w-5xl rounded-2xl shadow-lg overflow-hidden border border-border/50">
        {/* Left column — image */}
        <div className="hidden lg:block lg:w-1/2 relative min-h-[600px]">
          <Image
            src="/imagelogin.jpg"
            alt="Guichet Foot"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Right column — form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 sm:px-12 bg-white">
          <div className="w-full max-w-md space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <Image
                src="/login-logo.png"
                alt="Guichet Foot"
                width={320}
                height={80}
                className="h-20 w-auto"
                priority
              />
            </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-ink font-heading">
              Connectez-vous à votre compte
            </h1>
            <p className="text-muted-foreground text-sm">
              Accédez à votre espace pour gérer vos zones, stades, équipes et matches.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-ink">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Entrez votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="pl-10 h-12 rounded-xl border-border text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-ink">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className="pl-10 pr-10 h-12 rounded-xl border-border text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger text-center bg-red-50 p-3 rounded-xl">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold text-base"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}
