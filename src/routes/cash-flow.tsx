import { createFileRoute } from "@tanstack/react-router";

import { CashFlowPage } from "@/components/pages/CashFlowPage";

export const Route = createFileRoute("/cash-flow")({
  head: () => ({ meta: [{ title: "Cash Flow · Controlled Chaos" }] }),
  component: CashFlowPage,
});
