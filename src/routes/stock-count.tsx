import { createFileRoute } from "@tanstack/react-router";

import { StockCountPage } from "@/components/pages/StockCountPage";

export const Route = createFileRoute("/stock-count")({
  head: () => ({ meta: [{ title: "Stock Count · Controlled Chaos" }] }),
  component: StockCountPage,
});
