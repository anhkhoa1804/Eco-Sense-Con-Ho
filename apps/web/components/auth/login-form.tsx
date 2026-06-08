"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Check your email for the magic link.");
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Farmer sign in</CardTitle>
        <CardDescription>
          Email magic link today. Phone OTP can be added later without changing this screen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="farmer@example.com"
            />
          </div>
          {error ? <p className="text-sm text-critical" role="alert">{error}</p> : null}
          {message ? <p className="text-sm text-accent" role="status">{message}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending link..." : "Send magic link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
