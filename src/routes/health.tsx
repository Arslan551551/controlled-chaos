import { createFileRoute } from "@tanstack/react-router";

import { HealthPage } from "@/components/pages/HealthPage";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Company Health · Controlled Chaos" }] }),
  component: HealthPage,
});
