"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Lock, Mail } from "lucide-react";

export default function FondateurLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Identifiants incorrects");
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Erreur de connexion"); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "fondateur") {
      await supabase.auth.signOut();
      setError("Accès réservé au fondateur");
      setLoading(false);
      return;
    }

    router.push("/fondateur/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <Card className="w-full max-w-sm border-0 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <Image
            src="/login-logo.png"
            alt="Guichet Foot"
            width={180}
            height={45}
            className="h-12 w-auto mx-auto mb-2"
            priority
          />
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            Espace Fondateur
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" disabled={loading} className="pl-9 h-10" placeholder="Email fondateur" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={loading} className="pl-9 h-10" placeholder="••••••••" />
              </div>
            </div>
            {error && <p className="text-sm text-danger text-center bg-red-50 p-2 rounded">{error}</p>}
            <Button type="submit" className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connexion Fondateur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
