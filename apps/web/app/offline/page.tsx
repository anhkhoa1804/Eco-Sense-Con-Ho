export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-border bg-card/90 p-6 text-center">
        <h1 className="font-serif text-2xl">You are offline</h1>
        <p className="mt-2 text-muted">Cached pages remain available. Reconnect to sync live telemetry.</p>
      </div>
    </div>
  );
}
