import { createFileRoute } from "@tanstack/react-router";

import { MarketingPage } from "@/components/pages/MarketingPage";

export const Route = createFileRoute("/marketing")({
  head: () => ({ meta: [{ title: "Marketing · Controlled Chaos" }] }),
  component: MarketingPage,
});
