import { createFileRoute } from "@tanstack/react-router";

import { SalesCashPage } from "@/components/pages/SalesCashPage";

export const Route = createFileRoute("/sales-cash")({
  head: () => ({ meta: [{ title: "Sales vs Cash · Controlled Chaos" }] }),
  component: SalesCashPage,
});
