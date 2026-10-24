import { createFileRoute } from "@tanstack/react-router";

import { DistributorsPage } from "@/components/pages/DistributorsPage";

export const Route = createFileRoute("/distributors")({
  head: () => ({ meta: [{ title: "Distributors · Controlled Chaos" }] }),
  component: DistributorsPage,
});
