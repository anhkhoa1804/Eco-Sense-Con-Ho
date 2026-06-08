import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createRepositories } from "@/lib/repositories";
import ProfileLoading from "./loading";

async function ProfileContent() {
  const { user, profile, scope } = await getSessionContext();
  if (!user || !profile || !scope) {
    return null;
  }

  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const stations = await repos.stations.getAll(scope);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-3xl tracking-tight">Profile</h2>
        <p className="mt-2 text-muted">Account details and assigned stations.</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>User info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><span className="text-muted">Email:</span> {profile.email}</p>
          <p><span className="text-muted">Role:</span> {profile.role ?? "farmer"}</p>
          <p><span className="text-muted">Phone:</span> {profile.phone ?? "Not linked yet"}</p>
        </CardContent>
      </Card>

      <section>
        <h3 className="mb-4 font-serif text-2xl">Assigned stations</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {stations.map((station) => (
            <Card key={station.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>{station.name}</CardTitle>
                <Badge variant={station.status === "active" ? "success" : "warning"}>{station.status}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted">{station.id}</p>
                <Link href={`/stations/${station.id}`} className="mt-3 inline-block text-accent underline-offset-4 hover:underline">
                  View station
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <SignOutButton />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AppShell activePath="/profile">
      <Suspense fallback={<ProfileLoading />}>
        <ProfileContent />
      </Suspense>
    </AppShell>
  );
}
