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
    if (!supabase) {
      setError("Cấu hình hệ thống không hợp lệ (Supabase missing).");
      setLoading(false);
      return;
    }
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });

    setLoading(false);
    if (signInError) {
      setError("Không thể gửi liên kết đăng nhập. Vui lòng thử lại sau.");
      return;
    }

    setMessage("Đã gửi liên kết đăng nhập đến email của bạn.");
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Đăng nhập quản trị</CardTitle>
        <CardDescription>
          Dành cho người vận hành. Hệ thống sẽ gửi liên kết một lần đến email của bạn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Địa chỉ email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vd@coquan.vn"
            />
          </div>
          {error ? (
            <p className="text-sm text-critical" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-accent" role="status">
              {message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi liên kết đăng nhập"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
