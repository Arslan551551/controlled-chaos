import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/components/pages/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports · Controlled Chaos" }] }),
  component: ReportsPage,
});
