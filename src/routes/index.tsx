import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Controlled Chaos — Coming soon" },
      { name: "description", content: "Controlled Chaos is coming soon." },
      { property: "og:title", content: "Controlled Chaos — Coming soon" },
      { property: "og:description", content: "Controlled Chaos is coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
        Controlled Chaos
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">Coming soon</p>
    </main>
  );
}
