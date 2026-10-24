import { createFileRoute } from "@tanstack/react-router";

import { SalonsPage } from "@/components/pages/SalonsPage";

export const Route = createFileRoute("/salons")({
  head: () => ({ meta: [{ title: "Salons · Controlled Chaos" }] }),
  component: SalonsPage,
});
