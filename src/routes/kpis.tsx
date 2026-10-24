import { createFileRoute } from "@tanstack/react-router";

import { KpisPage } from "@/components/pages/KpisPage";

export const Route = createFileRoute("/kpis")({
  head: () => ({ meta: [{ title: "Team KPIs · Controlled Chaos" }] }),
  component: KpisPage,
});
