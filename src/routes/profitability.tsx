import { createFileRoute } from "@tanstack/react-router";

import { ProfitabilityPage } from "@/components/pages/ProfitabilityPage";

export const Route = createFileRoute("/profitability")({
  head: () => ({ meta: [{ title: "Profitability · Controlled Chaos" }] }),
  component: ProfitabilityPage,
});
