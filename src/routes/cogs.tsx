import { createFileRoute } from "@tanstack/react-router";

import { CogsPage } from "@/components/pages/CogsPage";

export const Route = createFileRoute("/cogs")({
  head: () => ({ meta: [{ title: "COGS · Controlled Chaos" }] }),
  component: CogsPage,
});
