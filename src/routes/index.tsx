import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/pages/DashboardPage";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · Controlled Chaos" }] }),
  component: DashboardPage,
});
