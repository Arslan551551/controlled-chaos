import { createFileRoute } from "@tanstack/react-router";

import { OutflowsPage } from "@/components/pages/OutflowsPage";

export const Route = createFileRoute("/stock-outflows")({
  head: () => ({ meta: [{ title: "Stock Outflow Recon · Controlled Chaos" }] }),
  component: OutflowsPage,
});
