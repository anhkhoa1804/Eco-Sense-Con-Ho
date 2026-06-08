"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) {
    return null;
  }

  return (
    <Card className="mb-6 border-accent/20">
      <CardHeader>
        <CardTitle>Install Eco-Sense</CardTitle>
        <CardDescription>Add the farmer dashboard to your home screen for offline-ready access.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-3">
        <Button
          onClick={async () => {
            await deferredPrompt.prompt();
            setDeferredPrompt(null);
          }}
        >
          Install app
        </Button>
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Not now
        </Button>
      </CardContent>
    </Card>
  );
}
